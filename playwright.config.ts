import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against the production build, served by `next start` on port 3000 and reading
 * whatever database DATABASE_URL points at (Neon in CI; see .github/workflows/ci.yml).
 * Locally, a running `pnpm dev` on the same port is reused instead of starting a server; that
 * dev server compiles routes on first hit and serves broken modules if several requests race
 * it, so local runs use one worker. CI runs the real server with full parallelism.
 */
const PORT = process.env.PORT ?? "3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: process.env.CI ? undefined : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // SLOW_MO=500 pnpm test:e2e --headed pauses half a second between actions, to watch along.
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
