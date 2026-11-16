// @vitest-environment node
import { describe, expect, test } from "vitest";
import type { ReadingList } from "./reading-list";
import {
  inMemoryReadingList,
  queryCountingReadingList,
  titlesBySection,
} from "./test-support";

/**
 * Requirement "with 1.000 Livros the page loads and registering shows no noticeable delay".
 *
 * Two layers:
 *
 * 1. The requirement itself, in time. "No noticeable delay" is read as: the sections are read in
 *    under 50 ms and one Livro is registered in under 20 ms, both with 1.000 Livros. Each timing
 *    is the fastest of SAMPLES runs after one warm-up run, so a GC pause or a busy CI worker only
 *    slows some samples. Measured on a development machine (in-memory SQLite, fastest sample):
 *    reading about 0.7 ms, registering about 0.04 ms, so both limits leave a margin of hundreds
 *    of times and do not flake on a slow runner. They only catch a gross slowdown.
 * 2. Regressions, without timing. Counting the queries each call runs catches the slowdowns that
 *    are too small to time reliably (a per-Livro query costs about 1.3 to 4.8 ms, a re-read of
 *    the list on register about 0.36 to 0.8 ms): reading the sections runs as many queries with
 *    1.000 Livros as with 10, so a query per Livro fails it whether it prepares a statement each
 *    time or reuses one; registering reads back as many rows with 1.000 Livros as with 10, so a
 *    re-read of the list fails it. Sorting outside SQL is caught by the order test instead.
 */
const READ_LIMIT_MS = 50;
const REGISTER_LIMIT_MS = 20;
const SAMPLES = 10;
const BOOK_COUNT = 1_000;
const SMALL_BOOK_COUNT = 10;

/** The Situações the setup cycles through, Livro 0 first: Livro n gets SITUATION_CYCLE[n % 4]. */
const SITUATION_CYCLE = [
  "want_to_read",
  "reading",
  "read",
  "abandoned",
] as const;
const BOOKS_PER_SITUATION = BOOK_COUNT / SITUATION_CYCLE.length;

/** Registers `count` Livros, cycling the Situações, one clock tick apart. */
function fill(
  { readingList, clock }: { readingList: ReadingList; clock: { now: number } },
  count: number,
) {
  const ids: number[] = [];
  for (let index = 0; index < count; index++) {
    clock.now += 1;
    const registered = readingList.register({
      title: `Livro ${index}`,
      authorship: "Autoria",
      status: SITUATION_CYCLE[index % SITUATION_CYCLE.length],
    });
    if (!registered.ok) throw new Error(JSON.stringify(registered.error));
    ids.push(registered.value.id);
  }
  return ids;
}

function fullReadingList() {
  const list = inMemoryReadingList();
  return { ...list, ids: fill(list, BOOK_COUNT) };
}

/** A query-counting reading list holding `count` Livros. */
function countedReadingList(count: number) {
  const list = queryCountingReadingList();
  fill(list, count);
  return list;
}

function registerOneMore({
  readingList,
  clock,
}: {
  readingList: ReadingList;
  clock: { now: number };
}) {
  clock.now += 1;
  return readingList.register({
    title: "Mais um",
    authorship: "Autoria",
    status: "want_to_read",
  });
}

/** Runs the work once to warm up, then returns the fastest of SAMPLES timed runs. */
function fastestMs(work: () => void) {
  work();
  let fastest = Infinity;
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    work();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

describe("with 1.000 Livros", () => {
  test("getting the sections stays under the read limit", () => {
    const { readingList } = fullReadingList();
    const results: unknown[] = [];

    const elapsed = fastestMs(() => {
      results.push(readingList.getSections());
    });

    for (const result of results) expect(result).toMatchObject({ ok: true });
    expect(elapsed).toBeLessThan(READ_LIMIT_MS);
  });

  test("registering one more Livro stays under the register limit", () => {
    const list = fullReadingList();
    const results: unknown[] = [];

    const elapsed = fastestMs(() => {
      results.push(registerOneMore(list));
    });

    for (const result of results) expect(result).toMatchObject({ ok: true });
    expect(elapsed).toBeLessThan(REGISTER_LIMIT_MS);
  });

  test("getting the sections runs as many queries as with 10 Livros (no query per Livro)", () => {
    const small = countedReadingList(SMALL_BOOK_COUNT);
    const full = countedReadingList(BOOK_COUNT);

    const smallCount = small.queriesDuring(() =>
      small.readingList.getSections(),
    );
    const fullCount = full.queriesDuring(() => full.readingList.getSections());

    // The counter sees the reads: every Livro comes back exactly once.
    expect(fullCount.rows).toBe(BOOK_COUNT);
    expect(fullCount.queries).toBe(smallCount.queries);
  });

  test("registering one more Livro does the same database work as with 10 Livros (no re-read of the list)", () => {
    const small = countedReadingList(SMALL_BOOK_COUNT);
    const full = countedReadingList(BOOK_COUNT);

    const smallCount = small.queriesDuring(() => registerOneMore(small));
    const fullCount = full.queriesDuring(() => registerOneMore(full));

    expect(fullCount).toEqual(smallCount);
  });

  test("the sections keep their order: Fila oldest first, the others latest change first", () => {
    const { readingList, clock, ids } = fullReadingList();
    // Livro 0 (Quero ler) moves to Lido after every other change, so it must head Lido.
    clock.now += 1;
    expect(readingList.changeStatus(ids[0], "read")).toMatchObject({
      ok: true,
    });

    const titles = titlesBySection(readingList);

    expect(Object.keys(titles)).toEqual([
      "reading",
      "want_to_read",
      "read",
      "abandoned",
    ]);
    const filaWithoutLivro0 = BOOKS_PER_SITUATION - 1;
    expect(titles.want_to_read).toHaveLength(filaWithoutLivro0);
    expect(titles.want_to_read.slice(0, 3)).toEqual([
      "Livro 4",
      "Livro 8",
      "Livro 12",
    ]);
    expect(titles.want_to_read.at(-1)).toBe("Livro 996");
    expect(titles.reading.slice(0, 2)).toEqual(["Livro 997", "Livro 993"]);
    expect(titles.read.slice(0, 3)).toEqual([
      "Livro 0",
      "Livro 998",
      "Livro 994",
    ]);
    expect(titles.abandoned.slice(0, 2)).toEqual(["Livro 999", "Livro 995"]);
  });
});
