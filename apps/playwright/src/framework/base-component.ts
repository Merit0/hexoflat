import type { Page } from '@playwright/test';
import { getCurrentPage } from '@framework/test-context';

/**
 * LAYER RULES (the whole point of this package's structure):
 *
 *   e2e/*.spec.ts  → calls ONLY Feature classes. Never sees `page`, a
 *                    locator, or an `expect` against a locator.
 *   Feature        → orchestrates Page Objects into a business flow. Owns no
 *                    locators. Every public method is wrapped in `this.step`.
 *   Page Object    → represents a route: `goto`, `waitUntilReady`, URL
 *                    assertions. Composes Components. Holds no locators.
 *   Component      → owns the locators of ONE UI region. This is the ONLY
 *                    layer allowed to call getByTestId/getByRole/locator().
 *
 * A Component exposes *intent* (`fillUsername`, `openSettings`, `clickTile`)
 * and `verify*` methods built on web-first assertions. It must never return a
 * Locator, or the locators leak straight back into the layers above.
 *
 * These rules are enforced by ESLint, not just convention — see the
 * `E2E_TEST_FILES` block in the repo root eslint.config.js.
 */
export abstract class BaseComponent {
  protected get page(): Page {
    return getCurrentPage();
  }
}
