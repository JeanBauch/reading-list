// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { describe, expect, test } from "vitest";
import { createReadingList, STATUSES } from "./reading-list";

/**
 * Requirement "with 1.000 Livros the page loads and registering shows no noticeable delay".
 * Measured on a development machine: about 1.6 ms to read the list and 47 ms to register all
 * 1.000 Livros (under 0.1 ms each). The limits below are hundreds of times the measured read and the
 * single registration (about 0.2 ms), so a loaded CI runner never trips them, while a regression such as a
 * query per Livro or a missing sort in SQL, which costs seconds, still does.
 */
const READ_LIMIT_MS = 150;
const REGISTER_LIMIT_MS = 100;
const VOLUME = 1_000;

function fullReadingList() {
  const clock = { now: 1_000 };
  const readingList = createReadingList(
    () => new DatabaseSync(":memory:"),
    () => clock.now,
  );
  for (let index = 0; index < VOLUME; index++) {
    clock.now += 1;
    const registered = readingList.register({
      title: `Livro ${index}`,
      authorship: "Autoria",
      status: STATUSES[index % STATUSES.length],
    });
    if (!registered.ok) throw new Error("setup failed");
  }
  return { readingList, clock };
}

function elapsedMs(work: () => void) {
  const start = performance.now();
  work();
  return performance.now() - start;
}

describe("with 1.000 Livros", () => {
  test("getting the sections stays under the read limit", () => {
    const { readingList } = fullReadingList();

    const elapsed = elapsedMs(() => {
      expect(readingList.getSections()).toMatchObject({ ok: true });
    });

    expect(elapsed).toBeLessThan(READ_LIMIT_MS);
  });

  test("registering one more Livro stays under the register limit", () => {
    const { readingList, clock } = fullReadingList();
    clock.now += 1;

    const elapsed = elapsedMs(() => {
      expect(
        readingList.register({
          title: "Mais um",
          authorship: "Autoria",
          status: "want_to_read",
        }),
      ).toMatchObject({ ok: true });
    });

    expect(elapsed).toBeLessThan(REGISTER_LIMIT_MS);
  });

  test("the sections keep their order: Fila oldest first, the others latest change first", () => {
    const { readingList } = fullReadingList();
    // Livro 0 (Quero ler) moves to Lido last, so it must head Lido.
    readingList.changeStatus(1, "read");

    const result = readingList.getSections();
    if (!result.ok) throw new Error(result.error.message);
    const titles = Object.fromEntries(
      result.value.map(({ status, books }) => [
        status,
        books.map((book) => book.title),
      ]),
    );

    expect(result.value.map(({ status }) => status)).toEqual([
      "reading",
      "want_to_read",
      "read",
      "abandoned",
    ]);
    expect(titles.want_to_read).toHaveLength(250 - 1);
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
