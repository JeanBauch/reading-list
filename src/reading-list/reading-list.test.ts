// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, test } from "vitest";
import { createReadingList, openDatabaseFile } from "./reading-list";

function inMemoryReadingList() {
  const clock = { now: 1_000 };
  const readingList = createReadingList(
    () => new DatabaseSync(":memory:"),
    () => clock.now,
  );
  return { readingList, clock };
}

const tempDirs: string[] = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "reading-list-test-"));
  tempDirs.push(dir);
  return dir;
}
// Windows keeps open database files locked, so connections are closed before cleanup.
const openFiles: DatabaseSync[] = [];
function openTracked(path: string) {
  const db = openDatabaseFile(path);
  openFiles.push(db);
  return db;
}
afterEach(() => {
  for (const db of openFiles.splice(0)) {
    if (db.isOpen) db.close();
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("obter seções", () => {
  test("an empty Lista de leitura has the four sections, in order, all empty", () => {
    const { readingList } = inMemoryReadingList();

    expect(readingList.getSections()).toEqual({
      ok: true,
      value: [
        { status: "reading", books: [] },
        { status: "want_to_read", books: [] },
        { status: "read", books: [] },
        { status: "abandoned", books: [] },
      ],
    });
  });

  test("inaccessible storage is reported as a load failure, not as an empty list", () => {
    const closed = new DatabaseSync(":memory:");
    closed.close();
    const readingList = createReadingList(
      () => closed,
      () => 0,
    );

    expect(readingList.getSections()).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: "Não foi possível carregar a lista de leitura.",
      },
    });
  });

  test("a file that is not SQLite is a load failure and stays byte-for-byte intact", () => {
    const path = join(tempDir(), "reading-list.db");
    const garbage = Buffer.from("isto não é um banco SQLite\n".repeat(64));
    writeFileSync(path, garbage);
    const readingList = createReadingList(
      () => openTracked(path),
      () => 0,
    );

    expect(readingList.getSections()).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: "Não foi possível carregar a lista de leitura.",
      },
    });
    expect(readFileSync(path).equals(garbage)).toBe(true);
  });

  test("a SQLite file with an unrecognised schema version is a load failure and is not changed", () => {
    const path = join(tempDir(), "reading-list.db");
    const other = new DatabaseSync(path);
    other.exec("CREATE TABLE something_else (x); PRAGMA user_version = 7;");
    other.close();
    const before = readFileSync(path);
    const readingList = createReadingList(
      () => openTracked(path),
      () => 0,
    );

    expect(readingList.getSections()).toMatchObject({
      ok: false,
      error: { message: "Não foi possível carregar a lista de leitura." },
    });
    expect(readFileSync(path).equals(before)).toBe(true);
  });

  test("on first run the database file and its folder are created, with schema version 1", () => {
    const path = join(tempDir(), "data", "nested", "reading-list.db");
    const readingList = createReadingList(
      () => openTracked(path),
      () => 0,
    );

    expect(readingList.getSections()).toMatchObject({ ok: true });
    const created = new DatabaseSync(path, { readOnly: true });
    expect(created.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 1,
    });
    created.close();
  });
});
