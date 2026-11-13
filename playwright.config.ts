import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Its own port, so a dev server already running with the Leitor's real data is never hit.
const PORT = Number(process.env.PORT ?? 3100);

// A database exclusive to the E2E run; e2e/reset-database.mjs deletes it before the server starts.
const READING_LIST_DB_PATH = join(
  tmpdir(),
  "reading-list-e2e",
  "reading-list.db",
);

export default defineConfig({
  testDir: "./e2e",
  // Tests share one database, so they run one at a time, in file order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI runs `pnpm build` first, so it serves the production build; locally it starts a dev server.
    command: `node e2e/reset-database.mjs && ${
      process.env.CI ? "pnpm start" : "pnpm dev"
    } --port ${PORT}`,
    env: { READING_LIST_DB_PATH },
    url: `http://localhost:${PORT}`,
    // Never reuse a running server: it could be serving the Leitor's real database.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
