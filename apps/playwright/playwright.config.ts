import { defineConfig, devices } from '@playwright/test';
import { WEB_URL } from './src/config/env';
import { allureReporterOptions } from './src/config/allure';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The default 30s was tight even for a single canvas-rendering test (PixiJS
  // + WebGL) and gets tighter under CI's `workers: 2`: two Chromium instances
  // doing real rendering share one runner's CPU, so a test that takes ~15-20s
  // solo can cross 30s just from being scheduled alongside another one. Local
  // runs have no such contention (workers: undefined = all cores), which is
  // why this only ever showed up on CI.
  timeout: process.env.CI ? 60_000 : 30_000,
  // Two retries on CI is the community standard for a suite that talks to a
  // real API and a real browser; zero locally so flakiness is visible the
  // moment it appears instead of being quietly retried away.
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  maxFailures: process.env.CI ? 10 : undefined,

  // allure-playwright only writes raw result JSON (allure-results/) — the
  // browsable HTML report is a separate build step (`report:allure:generate`,
  // via the `allure-commandline` CLI), run in CI after the test run.
  // Environment info and failure categories are configured declaratively in
  // src/config/allure.ts, so no spec ever has to mention reporting.
  reporter: process.env.CI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        // blob keeps `merge-reports` available for the day this suite is
        // sharded across runners.
        ['blob', { outputDir: 'blob-report' }],
        ['allure-playwright', allureReporterOptions],
      ]
    : [['list'], ['html', { open: 'never' }], ['allure-playwright', allureReporterOptions]],

  use: {
    baseURL: WEB_URL,
    // Trace is the primary CI debugging tool — full DOM snapshots, network
    // and the action log, at essentially no cost on green runs.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: {
      // retain-on-failure rather than on-first-retry: this also produces
      // video locally, where retries are 0.
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 },
      // Action and step captions burned onto the video. For a canvas game
      // this is the only way to see *what* a click at (x, y) was trying to
      // do — hence the insistence on wrapping every Feature method in
      // `test.step` (see src/framework/base-feature.ts).
      show: {
        actions: { duration: 500, position: 'top-right', fontSize: 14 },
        test: { level: 'step', position: 'top-left', fontSize: 12 },
      },
    },
  },

  expect: {
    // Canvas rendering differs by GPU/OS in its antialiasing, so any future
    // screenshot comparison needs a tolerance or it will flake between macOS
    // and ubuntu-latest. No screenshot assertions exist yet — this is the
    // groundwork, see the note in docs about deferring that work.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.01 },
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
    // VITE_E2E_HOOKS=true is what makes the build expose
    // `window.__HEXOFLAT_TEST__` (apps/web/src/e2e/test-hooks.ts). Without
    // it the board hooks are dead code and tree-shaken away, which is
    // exactly what the production build wants.
    //
    // `pnpm --filter <pkg> run preview -- --port ...` doesn't strip the `--`
    // the way plain `pnpm run` does, so vite's CLI parser treats
    // `--port`/`--strictPort` as raw passthrough args instead of flags and
    // silently falls back to its default port (4173) — `exec` invokes vite
    // directly, no script-argument indirection involved.
    command:
      'VITE_E2E_HOOKS=true pnpm --filter @hexoflat/web run build && ' +
      'pnpm --filter @hexoflat/web exec vite preview --port 5173 --strictPort',
    url: WEB_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
