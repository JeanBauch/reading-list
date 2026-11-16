import { DatabaseSync, type StatementSync } from "node:sqlite";
import { createReadingList, type ReadingList } from "./reading-list";

/** A reading list on a fresh in-memory database, with a clock the test moves by hand. */
export function inMemoryReadingList() {
  const clock = { now: 1_000 };
  const readingList = createReadingList(
    () => new DatabaseSync(":memory:"),
    () => clock.now,
  );
  return { readingList, clock };
}

/** Database work done during a call: queries executed and rows they returned. */
export type QueryCount = { queries: number; rows: number };

/**
 * Like inMemoryReadingList, but counts the database work. A query is one `exec` or one run of a
 * prepared statement (`all`, `get`, `run`, `iterate`), so a statement prepared once and run for
 * each Livro still counts once per Livro. Preparing alone counts nothing.
 */
export function queryCountingReadingList() {
  const clock = { now: 1_000 };
  const count: QueryCount = { queries: 0, rows: 0 };
  const readingList = createReadingList(
    () => countingQueries(new DatabaseSync(":memory:"), count),
    () => clock.now,
  );

  /** The database work `work` does, ignoring everything done before it. */
  function queriesDuring(work: () => void): QueryCount {
    const before = { ...count };
    work();
    return {
      queries: count.queries - before.queries,
      rows: count.rows - before.rows,
    };
  }

  return { readingList, clock, queriesDuring };
}

function countingQueries(db: DatabaseSync, count: QueryCount): DatabaseSync {
  return afterCalls(db, {
    exec: () => {
      count.queries += 1;
    },
    prepare: (statement) =>
      countingStatement(statement as StatementSync, count),
  });
}

function countingStatement(
  statement: StatementSync,
  count: QueryCount,
): StatementSync {
  const countRows = (rows: unknown[]) => {
    count.queries += 1;
    count.rows += rows.length;
    return rows;
  };
  return afterCalls(statement, {
    all: (rows) => countRows(rows as unknown[]),
    get: (row) => {
      countRows(row === undefined ? [] : [row]);
      return row;
    },
    run: (changes) => {
      count.queries += 1;
      return changes;
    },
    iterate: (rows) => countRows([...(rows as Iterable<unknown>)]).values(),
  });
}

/**
 * Wraps a node:sqlite object so each listed method, after running on the object itself with the
 * caller's arguments, passes its result through the given function. Every other member is read
 * from (and every other method called on) the object itself, as native objects require.
 */
function afterCalls<T extends object>(
  target: T,
  after: Partial<Record<keyof T, (result: unknown) => unknown>>,
): T {
  return new Proxy(target, {
    get(object, property) {
      const value: unknown = Reflect.get(object, property, object);
      if (typeof value !== "function") return value;
      const then = after[property as keyof T];
      if (!then) return value.bind(object);
      return (...parameters: unknown[]) =>
        then(Reflect.apply(value, object, parameters));
    },
  });
}

/** The Títulos of each section, keyed by Situação, in the order the section shows them. */
export function titlesBySection(readingList: ReadingList) {
  const sections = readingList.getSections();
  if (!sections.ok) throw new Error(sections.error.message);
  return Object.fromEntries(
    sections.value.map(({ status, books }) => [
      status,
      books.map((book) => book.title),
    ]),
  );
}
