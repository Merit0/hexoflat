import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Ambient framework context.
 *
 * Component/Page/Feature classes read `page` from here instead of taking it
 * as a constructor argument — that's what lets a spec read as plain
 * `await new LoginUserFeature(user).login()` with no plumbing.
 *
 * The binding is done by an auto-fixture in src/fixtures/test.ts: it sets the
 * context before the test body runs and clears it afterwards.
 *
 * WHY THIS IS SAFE UNDER `fullyParallel: true` —
 * a Playwright worker is a separate OS process that runs exactly ONE test at
 * a time. Parallelism buys more workers, never concurrent tests inside one
 * worker, so a module-scoped variable here cannot race.
 *
 * WHAT WOULD BREAK IT: `test.describe.configure({ mode: 'parallel' })` does
 * NOT (tests are still handed out one-per-worker), but any hand-rolled
 * `browser.newPage()` driven concurrently from a single test would. That
 * pattern is banned in this package — see the ESLint guards in the repo root
 * eslint.config.js.
 */

let currentPage: Page | undefined;
let currentRequest: APIRequestContext | undefined;

export function setCurrentPage(page: Page | undefined): void {
  currentPage = page;
}

export function setCurrentRequest(request: APIRequestContext | undefined): void {
  currentRequest = request;
}

export function getCurrentPage(): Page {
  if (!currentPage) {
    throw new Error(
      'No active Playwright `page` in the test context. Component/Page/Feature classes only ' +
        'work inside the fixture lifecycle — import { test } from "@fixtures" (see ' +
        'src/fixtures/test.ts) instead of "@playwright/test".',
    );
  }
  return currentPage;
}

export function getCurrentRequest(): APIRequestContext {
  if (!currentRequest) {
    throw new Error(
      'No active Playwright `request` context — see getCurrentPage() for why (same fixture ' +
        'lifecycle, same fix).',
    );
  }
  return currentRequest;
}
