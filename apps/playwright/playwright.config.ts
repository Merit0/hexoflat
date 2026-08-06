import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE_FILE, WEB_URL } from './support/env';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // allure-playwright only writes raw result JSON (allure-results/) — the
  // browsable HTML report is a separate build step (`report:allure:generate`,
  // via the `allure-commandline` CLI), run in CI after the test run and
  // uploaded as a build artifact (see ci.yml's `e2e` job).
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['allure-playwright', { resultsDir: 'allure-results' }],
      ]
    : [['list'], ['allure-playwright', { resultsDir: 'allure-results' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    // Most specs start pre-authenticated via the cookie global-setup.ts mints
    // — this is what lets them skip driving the login form (and burning a
    // slot in /auth/login's throttle bucket) entirely. Specs that test the
    // auth flow itself opt out per-file with
    // `test.use({ storageState: { cookies: [], origins: [] } })`.
    storageState: fileURLToPath(STORAGE_STATE_FILE),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // apps/api + Postgres are external dependencies (see global-setup.ts's
  // health check) — only apps/web is a webServer Playwright owns, built +
  // previewed on the fixed port apps/api's CORS_ORIGIN defaults to.
  webServer: {
    // `pnpm --filter <pkg> run preview -- --port ...` doesn't strip the `--`
    // the way plain `pnpm run` does, so vite's CLI parser treats
    // `--port`/`--strictPort` as raw passthrough args instead of flags and
    // silently falls back to its default port (4173) — `exec` invokes vite
    // directly, no script-argument indirection involved.
    command:
      'pnpm --filter @hexoflat/web run build && pnpm --filter @hexoflat/web exec vite preview --port 5173 --strictPort',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
