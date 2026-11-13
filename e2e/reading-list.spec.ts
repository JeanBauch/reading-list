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

  await selector.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(selector).not.toHaveValue("want_to_read");

  await page.reload();
  await expect(section(page, "Fila")).toContainText("Clique duplo");
  await expect(
    page.getByLabel("Situação de Clique duplo", { exact: true }),
  ).toHaveValue("want_to_read");
});
