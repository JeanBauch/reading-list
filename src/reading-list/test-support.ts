import { DatabaseSync } from "node:sqlite";
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
