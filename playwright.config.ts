/**
 * Playwright config for the embedded admin smoke suite.
 *
 * The suite verifies what only a real browser can: Polaris CSS
 * actually applying, App Bridge initializing, the SPA mounting
 * without console errors, and the authFetch patch attaching the JWT.
 *
 * Auth flow itself is NOT exercised here — that's covered by:
 *   - tests/integration/server-spa.test.ts (header invariants)
 *   - the live install on a Shopify dev store
 *
 * The suite stubs `window.shopify` and intercepts `/api/v1/*` so the
 * server doesn't need a real Shopify session. Postgres + Redis are
 * not required either — the SPA-serving path doesn't touch them.
 */
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Build the SPA, then start the server on a non-default port so it
  // doesn't collide with `npm run dev`. Reuses an already-running
  // server in dev for fast iteration; CI always starts fresh.
  webServer: {
    command: `npm run build:frontend && PORT=${PORT} npx tsx tests/e2e/server-entry.ts`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // NODE_ENV=test makes the Shopify SDK use MemorySessionStorage
      // (no DB required) while the SPA-serving gate (fs.existsSync)
      // still kicks in once `npm run build:frontend` has emitted the
      // dist directory above.
      NODE_ENV: "test",
      SHOPIFY_API_KEY: "e2e-test-key-32chars-long-aabbcc",
      SHOPIFY_API_SECRET: "e2e-test-secret-which-is-long-enough-aa",
      SHOPIFY_APP_URL: BASE_URL,
      SHOPIFY_SCOPES: "read_products",
      DATABASE_URL: "postgres://e2e:e2e@localhost:5432/e2e",
      REDIS_URL: "redis://localhost:6379",
      ENCRYPTION_KEY: "a".repeat(64),
      LOG_LEVEL: "warn",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
