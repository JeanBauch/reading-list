// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, test } from "vitest";
import {
  createReadingList,
  openDatabaseFile,
  type ReadingList,
} from "./reading-list";

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

function titlesBySection(readingList: ReadingList) {
  const sections = readingList.getSections();
  if (!sections.ok) throw new Error(sections.error.message);
  return Object.fromEntries(
    sections.value.map(({ status, books }) => [
      status,
      books.map((book) => book.title),
    ]),
  );
}

describe("cadastrar", () => {
  test("a Livro registered in Quero ler appears in the Fila with its Título and Autoria", () => {
    const { readingList } = inMemoryReadingList();

    const registered = readingList.register({
      title: "Dom Casmurro",
      authorship: "Machado de Assis",
      status: "want_to_read",
    });

    expect(registered).toMatchObject({
      ok: true,
      value: {
        title: "Dom Casmurro",
        authorship: "Machado de Assis",
        status: "want_to_read",
      },
    });
    expect(readingList.getSections()).toMatchObject({
      ok: true,
      value: [
        { status: "reading", books: [] },
        {
          status: "want_to_read",
          books: [{ title: "Dom Casmurro", authorship: "Machado de Assis" }],
        },
        { status: "read", books: [] },
        { status: "abandoned", books: [] },
      ],
    });
  });

  test("surrounding whitespace is removed, including line breaks, tabs and no-break spaces", () => {
    const { readingList } = inMemoryReadingList();

    const registered = readingList.register({
      title: "  Dom Casmurro  ",
      authorship: "\n\t Machado de Assis \t\n",
      status: "want_to_read",
    });

    expect(registered).toMatchObject({
      ok: true,
      value: { title: "Dom Casmurro", authorship: "Machado de Assis" },
    });
    expect(titlesBySection(readingList).want_to_read).toEqual(["Dom Casmurro"]);
  });

  test("a blank Título is refused and nothing is saved", () => {
    const { readingList } = inMemoryReadingList();

    expect(
      readingList.register({
        title: "   ",
        authorship: "Machado de Assis",
        status: "want_to_read",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "validation",
        fieldErrors: { title: "Informe o título." },
      },
    });
    expect(titlesBySection(readingList).want_to_read).toEqual([]);
  });

  test("blank Título and Autoria are both reported at once", () => {
    const { readingList } = inMemoryReadingList();

    expect(
      readingList.register({ title: "", authorship: " \t", status: "read" }),
    ).toEqual({
      ok: false,
      error: {
        kind: "validation",
        fieldErrors: {
          title: "Informe o título.",
          authorship: "Informe a autoria.",
        },
      },
    });
  });

  test("missing or non-text fields count as blank", () => {
    const { readingList } = inMemoryReadingList();

    expect(
      readingList.register({
        title: null,
        authorship: undefined,
        status: "read",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "validation",
        fieldErrors: {
          title: "Informe o título.",
          authorship: "Informe a autoria.",
        },
      },
    });
  });

  test("201 characters after trimming are refused for Título and Autoria", () => {
    const { readingList } = inMemoryReadingList();

    expect(
      readingList.register({
        title: ` ${"a".repeat(201)} `,
        authorship: "b".repeat(201),
        status: "want_to_read",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "validation",
        fieldErrors: {
          title: "O título deve ter no máximo 200 caracteres.",
          authorship: "A autoria deve ter no máximo 200 caracteres.",
        },
      },
    });
    expect(titlesBySection(readingList).want_to_read).toEqual([]);
  });

  test("exactly 200 characters are accepted, counting accented letters and simple emoji as one each", () => {
    const { readingList } = inMemoryReadingList();

    for (const text of [
      `  ${"a".repeat(200)}  `,
      "é".repeat(200),
      "📚".repeat(200),
    ]) {
      expect(
        readingList.register({
          title: text,
          authorship: text,
          status: "want_to_read",
        }),
      ).toMatchObject({ ok: true });
    }
    expect(titlesBySection(readingList).want_to_read).toHaveLength(3);
  });

  test("a Situação outside the four is refused with 'Situação inválida.' and nothing is saved", () => {
    const { readingList } = inMemoryReadingList();

    for (const status of ["paused", "Lido", "", null, 3]) {
      expect(
        readingList.register({
          title: "Dom Casmurro",
          authorship: "Machado de Assis",
          status,
        }),
      ).toEqual({
        ok: false,
        error: {
          kind: "validation",
          fieldErrors: { status: "Situação inválida." },
        },
      });
    }
    expect(titlesBySection(readingList)).toEqual({
      reading: [],
      want_to_read: [],
      read: [],
      abandoned: [],
    });
  });

  test("a Livro with the same Título and Autoria as another is accepted", () => {
    const { readingList } = inMemoryReadingList();
    const book = {
      title: "Dom Casmurro",
      authorship: "Machado de Assis",
      status: "want_to_read",
    };

    readingList.register(book);
    expect(readingList.register(book)).toMatchObject({ ok: true });
    expect(titlesBySection(readingList).want_to_read).toEqual([
      "Dom Casmurro",
      "Dom Casmurro",
    ]);
  });

  test("a storage failure while saving is reported with the save message", () => {
    const closed = new DatabaseSync(":memory:");
    closed.close();
    const readingList = createReadingList(
      () => closed,
      () => 0,
    );

    expect(
      readingList.register({
        title: "Dom Casmurro",
        authorship: "Machado de Assis",
        status: "want_to_read",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: "Não foi possível salvar. Tente novamente.",
      },
    });
  });
});

function register(readingList: ReadingList, title: string, status: string) {
  const result = readingList.register({
    title,
    authorship: "Autoria",
    status,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe("ordenação", () => {
  test("the Fila lists Livros from the earliest registered to the latest", () => {
    const { readingList, clock } = inMemoryReadingList();

    clock.now = 1_000;
    register(readingList, "A", "want_to_read");
    clock.now = 2_000;
    register(readingList, "B", "want_to_read");

    expect(titlesBySection(readingList).want_to_read).toEqual(["A", "B"]);
  });

  test("Livros registered in the Fila at the same instant keep their registration order", () => {
    const { readingList } = inMemoryReadingList();

    register(readingList, "A", "want_to_read");
    register(readingList, "B", "want_to_read");
    register(readingList, "C", "want_to_read");

    expect(titlesBySection(readingList).want_to_read).toEqual(["A", "B", "C"]);
  });

  test("registering directly in Lendo, Lido or Abandonado puts the Livro at the top of that section", () => {
    const { readingList, clock } = inMemoryReadingList();

    for (const status of ["reading", "read", "abandoned"]) {
      clock.now = 1_000;
      register(readingList, `${status} older`, status);
      clock.now = 2_000;
      register(readingList, `${status} newer`, status);
    }

    expect(titlesBySection(readingList)).toEqual({
      reading: ["reading newer", "reading older"],
      want_to_read: [],
      read: ["read newer", "read older"],
      abandoned: ["abandoned newer", "abandoned older"],
    });
  });

  test("with the clock stopped, the Livro that entered a section last comes first", () => {
    const { readingList } = inMemoryReadingList();

    register(readingList, "A", "read");
    register(readingList, "B", "read");

    expect(titlesBySection(readingList).read).toEqual(["B", "A"]);
  });
});

describe("mudar Situação", () => {
  test("moving a Livro from the Fila to Lendo takes it out of the Fila and puts it at the top of Lendo", () => {
    const { readingList, clock } = inMemoryReadingList();
    clock.now = 1_000;
    register(readingList, "Já em Lendo", "reading");
    const book = register(readingList, "Dom Casmurro", "want_to_read");
    clock.now = 2_000;

    expect(readingList.changeStatus(book.id, "reading")).toMatchObject({
      ok: true,
      value: { title: "Dom Casmurro", status: "reading" },
    });
    expect(titlesBySection(readingList)).toMatchObject({
      reading: ["Dom Casmurro", "Já em Lendo"],
      want_to_read: [],
    });
  });

  test("every Situação can change to every other Situação", () => {
    const statuses = ["want_to_read", "reading", "read", "abandoned"];
    for (const from of statuses) {
      for (const to of statuses.filter((status) => status !== from)) {
        const { readingList } = inMemoryReadingList();
        const book = register(readingList, `${from} → ${to}`, from);

        expect(readingList.changeStatus(book.id, to)).toMatchObject({
          ok: true,
        });
        expect(titlesBySection(readingList)[to]).toEqual([`${from} → ${to}`]);
        expect(titlesBySection(readingList)[from]).toEqual([]);
      }
    }
  });

  test("choosing the Situação the Livro already has changes nothing", () => {
    const { readingList, clock } = inMemoryReadingList();
    clock.now = 1_000;
    const a = register(readingList, "A", "read");
    clock.now = 2_000;
    register(readingList, "B", "read");
    clock.now = 3_000;

    expect(readingList.changeStatus(a.id, "read")).toMatchObject({ ok: true });
    expect(titlesBySection(readingList).read).toEqual(["B", "A"]);
  });

  test("a Livro back in Quero ler returns to the Fila by its registration, not by the change", () => {
    const { readingList, clock } = inMemoryReadingList();
    clock.now = 1_000;
    const a = register(readingList, "A", "reading");
    clock.now = 2_000;
    register(readingList, "B", "want_to_read");
    clock.now = 3_000;

    readingList.changeStatus(a.id, "want_to_read");

    expect(titlesBySection(readingList).want_to_read).toEqual(["A", "B"]);
  });

  test("Livros moved at the same instant are shown with the latest change first", () => {
    const { readingList } = inMemoryReadingList();
    const a = register(readingList, "A", "want_to_read");
    const b = register(readingList, "B", "want_to_read");

    readingList.changeStatus(b.id, "read");
    readingList.changeStatus(a.id, "read");

    expect(titlesBySection(readingList).read).toEqual(["A", "B"]);
  });

  test("moving to read, Lido then Lendo (rereading) and Abandonado then Lendo (resuming) are accepted", () => {
    const { readingList, clock } = inMemoryReadingList();
    const book = register(readingList, "Dom Casmurro", "want_to_read");

    for (const [moment, status] of [
      [1, "read"],
      [2, "reading"],
      [3, "abandoned"],
      [4, "reading"],
    ] as const) {
      clock.now = moment;
      expect(readingList.changeStatus(book.id, status)).toMatchObject({
        ok: true,
        value: { status },
      });
    }
    expect(titlesBySection(readingList).reading).toEqual(["Dom Casmurro"]);
  });

  test("a Situação outside the four is refused with 'Situação inválida.' and nothing changes", () => {
    const { readingList } = inMemoryReadingList();
    const book = register(readingList, "Dom Casmurro", "want_to_read");

    for (const status of ["paused", "Lendo", "", null]) {
      expect(readingList.changeStatus(book.id, status)).toEqual({
        ok: false,
        error: { kind: "invalid-status", message: "Situação inválida." },
      });
    }
    expect(titlesBySection(readingList).want_to_read).toEqual(["Dom Casmurro"]);
  });

  test("changing a Livro that does not exist is refused with 'Livro não encontrado.'", () => {
    const { readingList } = inMemoryReadingList();
    register(readingList, "Dom Casmurro", "want_to_read");

    for (const id of [999, "999", "abc", null]) {
      expect(readingList.changeStatus(id, "read")).toEqual({
        ok: false,
        error: { kind: "not-found", message: "Livro não encontrado." },
      });
    }
    expect(titlesBySection(readingList).want_to_read).toEqual(["Dom Casmurro"]);
  });

  test("an identifier sent as text (as forms do) is accepted", () => {
    const { readingList } = inMemoryReadingList();
    const book = register(readingList, "Dom Casmurro", "want_to_read");

    expect(readingList.changeStatus(String(book.id), "read")).toMatchObject({
      ok: true,
    });
  });

  test("a storage failure is reported with the save message", () => {
    const closed = new DatabaseSync(":memory:");
    closed.close();
    const readingList = createReadingList(
      () => closed,
      () => 0,
    );

    expect(readingList.changeStatus(1, "read")).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: "Não foi possível salvar. Tente novamente.",
      },
    });
  });
});

describe("editar", () => {
  test("correcting the Título keeps the Livro in the same Situação and position", () => {
    const { readingList, clock } = inMemoryReadingList();
    clock.now = 1_000;
    const typo = register(readingList, "Dom Casmuro", "read");
    clock.now = 2_000;
    register(readingList, "B", "read");
    clock.now = 3_000;

    expect(
      readingList.edit(typo.id, {
        title: "Dom Casmurro",
        authorship: "Machado de Assis",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        title: "Dom Casmurro",
        authorship: "Machado de Assis",
        status: "read",
      },
    });
    expect(titlesBySection(readingList).read).toEqual(["B", "Dom Casmurro"]);
  });

  test("editing a Livro in the Fila keeps its place in the Fila", () => {
    const { readingList } = inMemoryReadingList();
    const a = register(readingList, "A", "want_to_read");
    register(readingList, "B", "want_to_read");

    readingList.edit(a.id, { title: "A editado", authorship: "Autoria" });

    expect(titlesBySection(readingList).want_to_read).toEqual([
      "A editado",
      "B",
    ]);
  });

  test("editing follows the registration rules: trimming, blank and 200 code points", () => {
    const { readingList } = inMemoryReadingList();
    const book = register(readingList, "Dom Casmurro", "want_to_read");

    expect(
      readingList.edit(book.id, { title: "", authorship: "Machado de Assis" }),
    ).toEqual({
      ok: false,
      error: { kind: "validation", fieldErrors: { title: "Informe o título." } },
    });
    expect(
      readingList.edit(book.id, {
        title: "Dom Casmurro",
        authorship: "b".repeat(201),
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "validation",
        fieldErrors: {
          authorship: "A autoria deve ter no máximo 200 caracteres.",
        },
      },
    });
    expect(titlesBySection(readingList).want_to_read).toEqual(["Dom Casmurro"]);

    expect(
      readingList.edit(book.id, {
        title: "\t Dom Casmurro \n",
        authorship: "  Machado de Assis ",
      }),
    ).toMatchObject({
      ok: true,
      value: { title: "Dom Casmurro", authorship: "Machado de Assis" },
    });
  });

  test("editing a Livro that does not exist is refused with 'Livro não encontrado.'", () => {
    const { readingList } = inMemoryReadingList();

    expect(
      readingList.edit(42, { title: "Dom Casmurro", authorship: "Machado" }),
    ).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Livro não encontrado." },
    });
  });

  test("a storage failure is reported with the save message", () => {
    const closed = new DatabaseSync(":memory:");
    closed.close();
    const readingList = createReadingList(
      () => closed,
      () => 0,
    );

    expect(
      readingList.edit(1, { title: "Dom Casmurro", authorship: "Machado" }),
    ).toEqual({
      ok: false,
      error: {
        kind: "storage",
        message: "Não foi possível salvar. Tente novamente.",
      },
    });
  });
});

describe("persistência", () => {
  test("after a restart the same Livros are in the same sections and order", () => {
    const path = join(tempDir(), "reading-list.db");
    const clock = { now: 1_000 };
    const before = createReadingList(
      () => openTracked(path),
      () => clock.now,
    );
    register(before, "Fila 1", "want_to_read");
    register(before, "Lido 1", "read");
    clock.now = 2_000;
    register(before, "Fila 2", "want_to_read");
    register(before, "Lido 2", "read");
    register(before, "Lendo 1", "reading");
    for (const db of openFiles.splice(0)) db.close();

    const after = createReadingList(
      () => openTracked(path),
      () => clock.now,
    );

    expect(titlesBySection(after)).toEqual({
      reading: ["Lendo 1"],
      want_to_read: ["Fila 1", "Fila 2"],
      read: ["Lido 2", "Lido 1"],
      abandoned: [],
    });
  });
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
