import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Reading List module (Lista de leitura): the only gateway to the Leitor's data.
 * Every domain rule and every database access lives here. Server code only (ADR-0002).
 */

export const STATUSES = [
  "want_to_read",
  "reading",
  "read",
  "abandoned",
] as const;
export type Status = (typeof STATUSES)[number];

export type Book = {
  id: number;
  title: string;
  authorship: string;
  status: Status;
};

export type Section = { status: Status; books: Book[] };

export type Failure = { kind: "storage"; message: string };

export type Result<T, F extends Failure = Failure> =
  { ok: true; value: T } | { ok: false; error: F };

export type ReadingList = {
  getSections(): Result<Section[]>;
};

/** Milliseconds since the epoch. Production uses the system clock; tests control it. */
export type Clock = () => number;

export const MESSAGES = {
  loadFailed: "Não foi possível carregar a lista de leitura.",
} as const;

const SCHEMA_VERSION = 1;

/** Display order of the sections: Lendo, Fila, Lido, Abandonado. */
const SECTION_ORDER: readonly Status[] = [
  "reading",
  "want_to_read",
  "read",
  "abandoned",
];

/**
 * Opens (creating when missing) the database file and its folder.
 * An existing file is opened as is: it is never overwritten or recreated.
 */
export function openDatabaseFile(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  return new DatabaseSync(path);
}

/**
 * @param connect opens the database connection; called lazily on first use and
 *   again after a failure, so storage problems surface as results, never as throws.
 * @param now the time source.
 */
export function createReadingList(
  connect: () => DatabaseSync,
  now: Clock,
): ReadingList {
  let ready: DatabaseSync | undefined;
  let connection: DatabaseSync | undefined;

  function database(): DatabaseSync {
    if (ready) return ready;
    connection ??= connect();
    prepareSchema(connection);
    ready = connection;
    return ready;
  }

  function read<T>(work: (db: DatabaseSync) => T): Result<T> {
    try {
      return { ok: true, value: work(database()) };
    } catch {
      return {
        ok: false,
        error: { kind: "storage", message: MESSAGES.loadFailed },
      };
    }
  }

  void now;

  return {
    getSections() {
      return read((db) => {
        const rows = db
          .prepare(
            `SELECT id, title, authorship, status FROM books ORDER BY id`,
          )
          .all() as Book[];
        return SECTION_ORDER.map((status) => ({
          status,
          books: rows
            .filter((row) => row.status === status)
            .map(({ id, title, authorship, status }) => ({
              id,
              title,
              authorship,
              status,
            })),
        }));
      });
    },
  };
}

/**
 * Creates the schema in a brand-new database. Refuses (throws) when the database
 * is not SQLite or carries an unrecognised schema, so it is never written to.
 */
function prepareSchema(db: DatabaseSync): void {
  const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version === SCHEMA_VERSION) return;

  const { count } = db
    .prepare("SELECT count(*) AS count FROM sqlite_master")
    .get() as { count: number };
  if (version !== 0 || count !== 0) {
    throw new Error(`Unrecognised reading list schema (version ${version})`);
  }

  db.exec(`
    BEGIN;
    CREATE TABLE books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      authorship TEXT NOT NULL,
      status TEXT NOT NULL
        CHECK (status IN ('want_to_read', 'reading', 'read', 'abandoned')),
      registered_at INTEGER NOT NULL,
      status_changed_at INTEGER NOT NULL,
      change_sequence INTEGER NOT NULL
    );
    PRAGMA user_version = ${SCHEMA_VERSION};
    COMMIT;
  `);
}
