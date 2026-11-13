import { expect, test } from "@playwright/test";

// Walking-skeleton E2E: proves the app boots and serves the home page in a real browser.
test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
