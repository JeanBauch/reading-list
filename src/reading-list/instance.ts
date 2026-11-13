import { join } from "node:path";
import { createReadingList, openDatabaseFile } from "./reading-list";

/** Where the database lives: READING_LIST_DB_PATH, or data/reading-list.db at the project root. */
function databasePath(): string {
  return (
    process.env.READING_LIST_DB_PATH ??
    join(process.cwd(), "data", "reading-list.db")
  );
}

/**
 * The application's single Reading List: the configured database file and the system clock.
 * The connection opens on first use, at request time, so the production build never touches the file.
 */
export const readingList = createReadingList(
  () => openDatabaseFile(databasePath()),
  Date.now,
);
