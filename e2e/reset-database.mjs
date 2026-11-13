// Deletes the E2E database (and any SQLite side files) so each run starts from an empty Lista de leitura.
import { rmSync } from "node:fs";

const path = process.env.READING_LIST_DB_PATH;
if (!path) {
  throw new Error("READING_LIST_DB_PATH must point at the E2E database");
}
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  rmSync(path + suffix, { force: true });
}
