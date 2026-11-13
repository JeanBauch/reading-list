// @vitest-environment node
import { describe, expect, test } from "vitest";
import { inMemoryReadingList, titlesBySection } from "./test-support";

/**
 * Requirement "with 1.000 Livros the page loads and registering shows no noticeable delay".
 *
 * Each timing is the fastest of SAMPLES runs after one warm-up run, so a GC pause or a busy CI
 * worker only slows some samples, not the one that counts. Measured on a development machine
 * (in-memory SQLite, fastest sample):
 *
 * - reading the sections: about 0.7 ms. A per-Livro query that prepares a statement for each
 *   Livro costs about 4.8 ms, so the 3 ms read limit catches it with about 4x headroom over
 *   today. It does NOT catch a per-Livro query reusing one prepared statement (about 1.3 ms) or
 *   sorting in JavaScript instead of SQL (about 0.6 ms, no slower than today): both are too
 *   close to today's cost for a limit that must not flake on CI. Order regressions are caught
 *   by the order test below instead.
 * - registering one Livro on a full list: about 0.04 ms. A registration that also reads the
 *   whole list back costs about 0.36 ms with one query and about 0.8 ms through the sections,
 *   so the 0.2 ms register limit catches both with about 5x headroom over today. A smaller
 *   extra cost per registration (well under 0.2 ms) goes unnoticed.
 */
const READ_LIMIT_MS = 3;
const REGISTER_LIMIT_MS = 0.2;
const SAMPLES = 10;
const BOOK_COUNT = 1_000;

/** The Situações the setup cycles through, Livro 0 first: Livro n gets SITUATION_CYCLE[n % 4]. */
const SITUATION_CYCLE = [
  "want_to_read",
  "reading",
  "read",
  "abandoned",
] as const;
const BOOKS_PER_SITUATION = BOOK_COUNT / SITUATION_CYCLE.length;

function fullReadingList() {
  const { readingList, clock } = inMemoryReadingList();
  const ids: number[] = [];
  for (let index = 0; index < BOOK_COUNT; index++) {
    clock.now += 1;
    const registered = readingList.register({
      title: `Livro ${index}`,
      authorship: "Autoria",
      status: SITUATION_CYCLE[index % SITUATION_CYCLE.length],
    });
    if (!registered.ok) throw new Error(JSON.stringify(registered.error));
    ids.push(registered.value.id);
  }
  return { readingList, clock, ids };
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
    const { readingList, clock } = fullReadingList();
    const results: unknown[] = [];

    const elapsed = fastestMs(() => {
      clock.now += 1;
      results.push(
        readingList.register({
          title: "Mais um",
          authorship: "Autoria",
          status: "want_to_read",
        }),
      );
    });

    for (const result of results) expect(result).toMatchObject({ ok: true });
    expect(elapsed).toBeLessThan(REGISTER_LIMIT_MS);
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
