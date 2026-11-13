import { expect, test } from "@playwright/test";

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
