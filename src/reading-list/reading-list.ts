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

/** Failures carry the final Portuguese message, ready to display. */
export type StorageFailure = { kind: "storage"; message: string };
export type ValidationFailure = {
  kind: "validation";
  fieldErrors: Partial<Record<"title" | "authorship" | "status", string>>;
};
export type InvalidStatusFailure = { kind: "invalid-status"; message: string };
export type NotFoundFailure = { kind: "not-found"; message: string };

export type Result<T, F> = { ok: true; value: T } | { ok: false; error: F };

/** Raw, untrusted values straight from a form or a direct POST. */
export type RegisterInput = {
  title: unknown;
  authorship: unknown;
  status: unknown;
};

export type ReadingList = {
  getSections(): Result<Section[], StorageFailure>;
  register(
    input: RegisterInput,
  ): Result<Book, ValidationFailure | StorageFailure>;
  /** Only Título and Autoria change: the Situação and the section order stay as they were. */
  edit(
    id: unknown,
    input: { title: unknown; authorship: unknown },
  ): Result<Book, ValidationFailure | NotFoundFailure | StorageFailure>;
  /** Choosing the Situação the Livro already has changes nothing, not even its change moment. */
  changeStatus(
    id: unknown,
    status: unknown,
  ): Result<Book, InvalidStatusFailure | NotFoundFailure | StorageFailure>;
};

/** Milliseconds since the epoch. Production uses the system clock; tests control it. */
export type Clock = () => number;

export const MESSAGES = {
  loadFailed: "Não foi possível carregar a lista de leitura.",
  saveFailed: "Não foi possível salvar. Tente novamente.",
  titleRequired: "Informe o título.",
  titleTooLong: "O título deve ter no máximo 200 caracteres.",
  authorshipRequired: "Informe a autoria.",
  authorshipTooLong: "A autoria deve ter no máximo 200 caracteres.",
  invalidStatus: "Situação inválida.",
  notFound: "Livro não encontrado.",
} as const;

const MAX_TEXT_LENGTH = 200;

function isStatus(value: unknown): value is Status {
  return (STATUSES as readonly unknown[]).includes(value);
}

/** Accepts a positive integer, or its decimal text as forms send it. */
function parseId(value: unknown): number | undefined {
  const id =
    typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : undefined;
}

const NOT_FOUND = {
  ok: false,
  error: { kind: "not-found", message: MESSAGES.notFound },
} as const;

/**
 * Trims with JavaScript's standard trim and checks the length in Unicode code points.
 * Returns the clean text, or the message for the field.
 */
function cleanText(
  value: unknown,
  messages: { required: string; tooLong: string },
): { text: string } | { error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return { error: messages.required };
  if ([...text].length > MAX_TEXT_LENGTH) return { error: messages.tooLong };
  return { text };
}

type Fields = { title: string; authorship: string };

function validateFields(input: {
  title: unknown;
  authorship: unknown;
}): { ok: true; fields: Fields } | { ok: false; error: ValidationFailure } {
  const title = cleanText(input.title, {
    required: MESSAGES.titleRequired,
    tooLong: MESSAGES.titleTooLong,
  });
  const authorship = cleanText(input.authorship, {
    required: MESSAGES.authorshipRequired,
    tooLong: MESSAGES.authorshipTooLong,
  });
  if ("text" in title && "text" in authorship) {
    return {
      ok: true,
      fields: { title: title.text, authorship: authorship.text },
    };
  }
  const fieldErrors: ValidationFailure["fieldErrors"] = {};
  if ("error" in title) fieldErrors.title = title.error;
  if ("error" in authorship) fieldErrors.authorship = authorship.error;
  return { ok: false, error: { kind: "validation", fieldErrors } };
}

const SCHEMA_VERSION = 1;

/** Display order of the sections: Lendo, Fila, Lido, Abandonado. */
const SECTION_ORDER: readonly Status[] = [
  "reading",
  "want_to_read",
  "read",
  "abandoned",
];

/**
 * The Fila follows registration (oldest first, insertion order on ties). The other sections
 * show the latest change of Situação first; the global change sequence breaks ties, so the
 * order stays deterministic even when the clock does not move.
 */
const SECTION_SORT: Record<Status, string> = {
  want_to_read: "registered_at ASC, id ASC",
  reading: "status_changed_at DESC, change_sequence DESC",
  read: "status_changed_at DESC, change_sequence DESC",
  abandoned: "status_changed_at DESC, change_sequence DESC",
};

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

  /**
   * Runs database work that returns its own result, turning any storage error into a
   * storage failure carrying the given message.
   */
  function attempt<T, F>(
    work: (db: DatabaseSync) => Result<T, F>,
    message: string,
  ): Result<T, F | StorageFailure> {
    try {
      return work(database());
    } catch {
      return { ok: false, error: { kind: "storage", message } };
    }
  }

  function findBook(db: DatabaseSync, id: number | undefined) {
    if (id === undefined) return undefined;
    const row = db
      .prepare(`SELECT ${BOOK_COLUMNS} FROM books WHERE id = ?`)
      .get(id) as Book | undefined;
    return row && toBook(row);
  }

  return {
    getSections() {
      return attempt((db) => {
        const sections = SECTION_ORDER.map((status) => {
          const rows = db
            .prepare(
              `SELECT ${BOOK_COLUMNS} FROM books WHERE status = ?
               ORDER BY ${SECTION_SORT[status]}`,
            )
            .all(status) as Book[];
          return { status, books: rows.map(toBook) };
        });
        return { ok: true, value: sections };
      }, MESSAGES.loadFailed);
    },

    register(input) {
      const validated = validateFields(input);
      const { status } = input;
      if (!validated.ok || !isStatus(status)) {
        const fieldErrors = validated.ok ? {} : validated.error.fieldErrors;
        if (!isStatus(status)) fieldErrors.status = MESSAGES.invalidStatus;
        return { ok: false, error: { kind: "validation", fieldErrors } };
      }
      const { title, authorship } = validated.fields;

      return attempt((db) => {
        const moment = now();
        const row = db
          .prepare(
            `INSERT INTO books
               (title, authorship, status, registered_at, status_changed_at, change_sequence)
             VALUES (?, ?, ?, ?, ?, ${NEXT_CHANGE_SEQUENCE})
             RETURNING ${BOOK_COLUMNS}`,
          )
          .get(title, authorship, status, moment, moment) as Book;
        return { ok: true, value: toBook(row) };
      }, MESSAGES.saveFailed);
    },

    changeStatus(id, status) {
      if (!isStatus(status)) {
        return {
          ok: false,
          error: { kind: "invalid-status", message: MESSAGES.invalidStatus },
        };
      }
      const bookId = parseId(id);

      return attempt((db) => {
        const book = findBook(db, bookId);
        if (!book) return NOT_FOUND;
        if (book.status === status) return { ok: true, value: book };
        const row = db
          .prepare(
            `UPDATE books
             SET status = ?, status_changed_at = ?, change_sequence = ${NEXT_CHANGE_SEQUENCE}
             WHERE id = ?
             RETURNING ${BOOK_COLUMNS}`,
          )
          .get(status, now(), book.id) as Book;
        return { ok: true, value: toBook(row) };
      }, MESSAGES.saveFailed);
    },

    edit(id, input) {
      const validated = validateFields(input);
      if (!validated.ok) return validated;
      const { title, authorship } = validated.fields;
      const bookId = parseId(id);

      return attempt((db) => {
        const book = findBook(db, bookId);
        if (!book) return NOT_FOUND;
        const row = db
          .prepare(
            `UPDATE books SET title = ?, authorship = ? WHERE id = ?
             RETURNING ${BOOK_COLUMNS}`,
          )
          .get(title, authorship, book.id) as Book;
        return { ok: true, value: toBook(row) };
      }, MESSAGES.saveFailed);
    },
  };
}

/** Each effective change of Situação (registration included) takes the next number. */
const NEXT_CHANGE_SEQUENCE =
  "(SELECT coalesce(max(change_sequence), 0) + 1 FROM books)";

const BOOK_COLUMNS = "id, title, authorship, status";

/** Copies a row into a plain Book (rows from node:sqlite have a null prototype). */
function toBook({ id, title, authorship, status }: Book): Book {
  return { id, title, authorship, status };
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
