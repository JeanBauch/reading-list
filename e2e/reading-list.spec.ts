import { expect, test, type Page } from "@playwright/test";

// The run starts with an empty database (see playwright.config.ts) and tests run in order,
// so this one must stay first.
test("an empty Lista de leitura shows the four sections with their empty messages", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Lista de leitura");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lista de leitura" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Lendo",
    "Fila",
    "Lido",
    "Abandonado",
  ]);
  for (const [section, message] of [
    ["Lendo", "Nenhum livro em Lendo."],
    ["Fila", "Nenhum livro na Fila."],
    ["Lido", "Nenhum livro em Lido."],
    ["Abandonado", "Nenhum livro em Abandonado."],
  ]) {
    await expect(page.getByRole("region", { name: section })).toContainText(
      message,
    );
  }
});

async function register(
  page: Page,
  title: string,
  authorship: string,
  status?: string,
) {
  await form(page).getByLabel("Título", { exact: true }).fill(title);
  await form(page).getByLabel("Autoria", { exact: true }).fill(authorship);
  if (status)
    await form(page)
      .getByLabel("Situação", { exact: true })
      .selectOption({ label: status });
  await page.getByRole("button", { name: "Cadastrar" }).click();
}

function form(page: Page) {
  return page.getByRole("form", { name: "Cadastrar livro" });
}

function section(page: Page, name: string) {
  return page.getByRole("region", { name });
}

test("registering a Livro shows it in the Fila, clears the form and returns focus to Título", async ({
  page,
}) => {
  await page.goto("/");
  await expect(form(page).getByLabel("Situação", { exact: true })).toHaveValue(
    "want_to_read",
  );
  await expect(
    form(page)
      .getByLabel("Situação", { exact: true })
      .locator("option:checked"),
  ).toHaveText("Quero ler");

  await register(page, "Dom Casmurro", "Machado de Assis");

  await expect(section(page, "Fila").getByRole("listitem")).toHaveText([
    /Dom Casmurro.*Machado de Assis/,
  ]);
  await expect(form(page).getByLabel("Título", { exact: true })).toHaveValue(
    "",
  );
  await expect(form(page).getByLabel("Autoria", { exact: true })).toHaveValue(
    "",
  );
  await expect(form(page).getByLabel("Título", { exact: true })).toBeFocused();
});

test("registering directly in Lido puts the Livro at the top of Lido", async ({
  page,
}) => {
  await page.goto("/");

  await register(
    page,
    "Memórias Póstumas de Brás Cubas",
    "Machado de Assis",
    "Lido",
  );
  await expect(section(page, "Lido").getByRole("listitem")).toHaveCount(1);
  await register(
    page,
    "Belas Maldições",
    "Neil Gaiman e Terry Pratchett",
    "Lido",
  );

  await expect(section(page, "Lido").getByRole("listitem")).toHaveText([
    /Belas Maldições.*Neil Gaiman e Terry Pratchett/,
    /Memórias Póstumas de Brás Cubas/,
  ]);
});

test("validation errors appear next to their fields, keep what was typed and focus the first invalid field", async ({
  page,
}) => {
  await page.goto("/");

  await register(page, "  Quincas Borba  ", "   ");

  const authorship = form(page).getByLabel("Autoria", { exact: true });
  await expect(authorship).toHaveAccessibleDescription("Informe a autoria.");
  await expect(authorship).toBeFocused();
  await expect(form(page).getByLabel("Título", { exact: true })).toHaveValue(
    "  Quincas Borba  ",
  );
  await expect(section(page, "Fila")).not.toContainText("Quincas Borba");

  await form(page).getByLabel("Título", { exact: true }).fill("");
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(
    form(page).getByLabel("Título", { exact: true }),
  ).toHaveAccessibleDescription("Informe o título.");
  await expect(authorship).toHaveAccessibleDescription("Informe a autoria.");
  await expect(form(page).getByLabel("Título", { exact: true })).toBeFocused();
});

test("the browser does not validate natively: 201 characters reach the app's own message", async ({
  page,
}) => {
  await page.goto("/");

  await register(page, "a".repeat(201), "Autoria");

  await expect(
    form(page).getByLabel("Título", { exact: true }),
  ).toHaveAccessibleDescription("O título deve ter no máximo 200 caracteres.");
  await expect(form(page).getByLabel("Título", { exact: true })).toHaveValue(
    "a".repeat(201),
  );
});

test("a double click on Cadastrar registers the Livro only once", async ({
  page,
}) => {
  await page.goto("/");
  await form(page).getByLabel("Título", { exact: true }).fill("Clique duplo");
  await form(page).getByLabel("Autoria", { exact: true }).fill("Autoria");

  await page.getByRole("button", { name: "Cadastrar" }).dblclick();

  await expect(form(page).getByLabel("Título", { exact: true })).toHaveValue(
    "",
  );
  await page.reload();
  await expect(
    section(page, "Fila")
      .getByRole("listitem")
      .filter({ hasText: "Clique duplo" }),
  ).toHaveCount(1);
});

test("registered Livros are still there, in the same order, after reloading", async ({
  page,
}) => {
  await page.goto("/");

  await expect(section(page, "Fila").getByRole("listitem")).toHaveText([
    /Dom Casmurro/,
    /Clique duplo/,
  ]);
  await expect(section(page, "Lido").getByRole("listitem")).toHaveText([
    /Belas Maldições/,
    /Memórias Póstumas de Brás Cubas/,
  ]);
});

test("moving a Livro from the Fila to Lendo puts it at the top of Lendo and focuses that section", async ({
  page,
}) => {
  await page.goto("/");
  await register(page, "Já em Lendo", "Autoria", "Lendo");
  await expect(section(page, "Lendo").getByRole("listitem")).toHaveCount(1);

  await page
    .getByLabel("Situação de Dom Casmurro", { exact: true })
    .selectOption({ label: "Lendo" });
  await page.getByRole("button", { name: "Mover Dom Casmurro" }).click();

  await expect(section(page, "Lendo").getByRole("listitem")).toHaveText([
    /Dom Casmurro/,
    /Já em Lendo/,
  ]);
  await expect(section(page, "Fila")).not.toContainText("Dom Casmurro");
  await expect(page.getByRole("heading", { name: "Lendo" })).toBeFocused();

  await page.reload();
  await expect(section(page, "Lendo").getByRole("listitem")).toHaveText([
    /Dom Casmurro/,
    /Já em Lendo/,
  ]);
});

test("changing the selector with the keyboard without pressing Mover saves nothing", async ({
  page,
}) => {
  await page.goto("/");
  const selector = page.getByLabel("Situação de Clique duplo", { exact: true });

  // The list streams in hidden and is revealed a moment later; focusing it before the
  // reveal does nothing and the keys go to the page body.
  await expect(selector).toBeVisible();
  await selector.focus();
  await expect(selector).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(selector).not.toHaveValue("want_to_read");

  await page.reload();
  await expect(section(page, "Fila")).toContainText("Clique duplo");
  await expect(
    page.getByLabel("Situação de Clique duplo", { exact: true }),
  ).toHaveValue("want_to_read");
});

test("editing a Livro's Título keeps it in the same Situação and position", async ({
  page,
}) => {
  await page.goto("/");
  await register(page, "O Cortico", "Aluísio Azevedo", "Lido");
  await expect(section(page, "Lido").getByRole("listitem")).toHaveCount(3);
  await register(page, "Iracema", "José de Alencar", "Lido");
  await expect(section(page, "Lido").getByRole("listitem")).toHaveCount(4);

  await page
    .getByRole("button", { name: "Editar O Cortico", exact: true })
    .click();
  const editForm = page.getByRole("form", { name: "Editar O Cortico" });
  await expect(editForm.getByLabel("Título", { exact: true })).toHaveValue(
    "O Cortico",
  );
  await expect(editForm.getByLabel("Autoria", { exact: true })).toHaveValue(
    "Aluísio Azevedo",
  );
  await editForm.getByLabel("Título", { exact: true }).fill(" O Cortiço ");
  await editForm.getByRole("button", { name: "Salvar" }).click();

  await expect(section(page, "Lido").getByRole("listitem")).toHaveText([
    /Iracema/,
    /O Cortiço/,
    /Belas Maldições/,
    /Memórias Póstumas de Brás Cubas/,
  ]);
  await expect(
    page.getByRole("button", { name: "Editar O Cortiço", exact: true }),
  ).toBeFocused();

  await page.reload();
  await expect(section(page, "Lido").getByRole("listitem").nth(1)).toHaveText(
    /O Cortiço.*Aluísio Azevedo/,
  );
});

test("an invalid edit shows the error next to the field and changes nothing", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Editar Iracema", exact: true })
    .click();
  const editForm = page.getByRole("form", { name: "Editar Iracema" });
  await editForm.getByLabel("Título", { exact: true }).fill("   ");
  await editForm.getByRole("button", { name: "Salvar" }).click();

  await expect(
    editForm.getByLabel("Título", { exact: true }),
  ).toHaveAccessibleDescription("Informe o título.");
  await expect(editForm.getByLabel("Título", { exact: true })).toBeFocused();

  await page.reload();
  await expect(section(page, "Lido").getByRole("listitem").first()).toHaveText(
    /Iracema/,
  );
});

test("cancelling an edit keeps the previous Título and Autoria", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Editar Iracema", exact: true })
    .click();
  const editForm = page.getByRole("form", { name: "Editar Iracema" });
  await editForm.getByLabel("Título", { exact: true }).fill("Ubirajara");
  await editForm.getByLabel("Autoria", { exact: true }).fill("Outra pessoa");
  await editForm.getByRole("button", { name: "Cancelar" }).click();

  await expect(section(page, "Lido").getByRole("listitem").first()).toHaveText(
    /Iracema.*José de Alencar/,
  );
  await expect(
    page.getByRole("button", { name: "Editar Iracema", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(section(page, "Lido")).not.toContainText("Ubirajara");
});

function book(page: Page, sectionName: string, title: string) {
  return section(page, sectionName)
    .getByRole("listitem")
    .filter({ hasText: title });
}

test("Excluir asks for confirmation next to the Livro, and Cancelar keeps it", async ({
  page,
}) => {
  page.on("dialog", (dialog) => {
    throw new Error(`Unexpected native dialog: ${dialog.message()}`);
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Excluir Clique duplo" }).click();
  const item = book(page, "Fila", "Clique duplo");
  await expect(
    item.getByRole("button", { name: "Confirmar exclusão" }),
  ).toBeVisible();
  await item.getByRole("button", { name: "Cancelar" }).click();

  await expect(
    page.getByRole("button", { name: "Excluir Clique duplo" }),
  ).toBeFocused();
  await page.reload();
  await expect(section(page, "Fila")).toContainText("Clique duplo");
});

test("confirming removes the Livro for good and focuses the next Livro in the section", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Excluir O Cortiço" }).click();
  await book(page, "Lido", "O Cortiço")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();

  await expect(section(page, "Lido").getByRole("listitem")).toHaveText([
    /Iracema/,
    /Belas Maldições/,
    /Memórias Póstumas de Brás Cubas/,
  ]);
  await expect(book(page, "Lido", "Belas Maldições")).toBeFocused();
  await page.reload();
  await expect(page.getByRole("main")).not.toContainText("O Cortiço");
});

test("removing the last Livro of a section focuses the previous one", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("button", { name: "Excluir Memórias Póstumas de Brás Cubas" })
    .click();
  await book(page, "Lido", "Memórias Póstumas de Brás Cubas")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();

  await expect(section(page, "Lido").getByRole("listitem")).toHaveCount(2);
  await expect(book(page, "Lido", "Belas Maldições")).toBeFocused();
});

test("removing the only Livro of a section focuses the section heading, which shows the empty message", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Excluir Clique duplo" }).click();
  await book(page, "Fila", "Clique duplo")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();

  await expect(section(page, "Fila")).toContainText("Nenhum livro na Fila.");
  await expect(page.getByRole("heading", { name: "Fila" })).toBeFocused();
});

test("an abandoned Livro stays visible in Abandonado, unlike a removed one", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByLabel("Situação de Já em Lendo", { exact: true })
    .selectOption({ label: "Abandonado" });
  await page.getByRole("button", { name: "Mover Já em Lendo" }).click();

  await expect(section(page, "Abandonado")).toContainText("Já em Lendo");
  await expect(page.getByRole("heading", { name: "Abandonado" })).toBeFocused();
});

test("acting on a Livro removed in another tab shows 'Livro não encontrado.' next to it", async ({
  page,
}) => {
  await page.goto("/");
  const otherTab = await page.context().newPage();
  await otherTab.goto("/");
  await otherTab.getByRole("button", { name: "Excluir Iracema" }).click();
  await book(otherTab, "Lido", "Iracema")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();
  await expect(section(otherTab, "Lido")).not.toContainText("Iracema");

  await page
    .getByLabel("Situação de Iracema", { exact: true })
    .selectOption({ label: "Lendo" });
  await page.getByRole("button", { name: "Mover Iracema" }).click();

  const item = book(page, "Lido", "Iracema");
  await expect(item.getByRole("alert")).toHaveText("Livro não encontrado.");
  await expect(
    page.getByLabel("Situação de Iracema", { exact: true }),
  ).toHaveValue("read");
});

const CONNECTION_MESSAGE = "Não foi possível salvar. Tente novamente.";

/** Makes every Server Action request fail the way a dropped connection does. */
async function dropConnection(page: Page) {
  await page.route("**/*", (route) => {
    if (route.request().headers()["next-action"]) return route.abort();
    return route.continue();
  });
}

async function restoreConnection(page: Page) {
  await page.unroute("**/*");
}

function expectNoFrameworkErrorScreen(page: Page) {
  return Promise.all([
    expect(
      page.getByRole("heading", { level: 1, name: "Lista de leitura" }),
    ).toBeVisible(),
    expect(page.getByText("Application error")).toHaveCount(0),
  ]);
}

test("a lost connection while registering shows the message, keeps what was typed and allows trying again", async ({
  page,
}) => {
  await page.goto("/");
  await form(page).getByLabel("Título", { exact: true }).fill("Sem conexão");
  await form(page).getByLabel("Autoria", { exact: true }).fill("Autoria");
  await form(page)
    .getByLabel("Situação", { exact: true })
    .selectOption({ label: "Lendo" });

  await dropConnection(page);
  await page.getByRole("button", { name: "Cadastrar" }).click();

  await expect(form(page).getByRole("alert")).toHaveText(CONNECTION_MESSAGE);
  await expect(form(page).getByLabel("Situação", { exact: true })).toHaveValue(
    "reading",
  );
  await expect(form(page).getByLabel("Título", { exact: true })).toHaveValue(
    "Sem conexão",
  );
  await expect(form(page).getByLabel("Autoria", { exact: true })).toHaveValue(
    "Autoria",
  );
  await expect(page.getByRole("button", { name: "Cadastrar" })).toBeEnabled();
  await expectNoFrameworkErrorScreen(page);

  await restoreConnection(page);
  await form(page)
    .getByLabel("Situação", { exact: true })
    .selectOption({ label: "Quero ler" });
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(section(page, "Fila")).toContainText("Sem conexão");
});

test("a lost connection while moving a Livro shows the message and restores the selector", async ({
  page,
}) => {
  await page.goto("/");
  const selector = page.getByLabel("Situação de Sem conexão", { exact: true });

  await dropConnection(page);
  await selector.selectOption({ label: "Lido" });
  await page.getByRole("button", { name: "Mover Sem conexão" }).click();

  await expect(book(page, "Fila", "Sem conexão").getByRole("alert")).toHaveText(
    CONNECTION_MESSAGE,
  );
  await expect(selector).toHaveValue("want_to_read");
  await expect(
    page.getByRole("button", { name: "Mover Sem conexão" }),
  ).toBeEnabled();
  await expectNoFrameworkErrorScreen(page);
  await restoreConnection(page);
  await page.reload();
  await expect(book(page, "Fila", "Sem conexão")).toBeVisible();
  await expect(selector).toHaveValue("want_to_read");
});

test("a lost connection while editing shows the message and keeps what was typed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Editar Sem conexão", exact: true })
    .click();
  const editForm = page.getByRole("form", { name: "Editar Sem conexão" });
  await editForm.getByLabel("Título", { exact: true }).fill("Título novo");

  await dropConnection(page);
  await editForm.getByRole("button", { name: "Salvar" }).click();

  await expect(editForm.getByRole("alert")).toHaveText(CONNECTION_MESSAGE);
  await expect(editForm.getByLabel("Título", { exact: true })).toHaveValue(
    "Título novo",
  );
  await expect(editForm.getByRole("button", { name: "Salvar" })).toBeEnabled();
  await expectNoFrameworkErrorScreen(page);
  await restoreConnection(page);
  await page.reload();
  await expect(section(page, "Fila")).toContainText("Sem conexão");
  await expect(page.getByText("Título novo")).toHaveCount(0);
});

test("a lost connection while removing shows the message and keeps the Livro", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Excluir Sem conexão" }).click();
  const item = book(page, "Fila", "Sem conexão");

  await dropConnection(page);
  await item.getByRole("button", { name: "Confirmar exclusão" }).click();

  await expect(item.getByRole("alert")).toHaveText(CONNECTION_MESSAGE);
  await expect(
    item.getByRole("button", { name: "Confirmar exclusão" }),
  ).toBeEnabled();
  await expectNoFrameworkErrorScreen(page);
  await restoreConnection(page);
  await page.reload();
  await expect(section(page, "Fila")).toContainText("Sem conexão");
});
