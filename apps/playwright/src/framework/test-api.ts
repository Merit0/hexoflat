import type { HexoflatTestApi } from '@web-test-api';

/**
 * Makes `window.__HEXOFLAT_TEST__` visible to the TypeScript inside
 * `page.evaluate` callbacks. The interface itself is owned by apps/web (see
 * apps/web/src/e2e/test-api.types.ts) and only type-imported here, so the two
 * packages cannot drift apart without a typecheck failure.
 */
declare global {
  interface Window {
    __HEXOFLAT_TEST__?: HexoflatTestApi;
  }
}

export type {
  HexoflatTestApi,
  TestGridSize,
  TestHeroHealth,
  TestHexCoordinates,
  TestTileFraction,
} from '@web-test-api';

export const MISSING_TEST_HOOKS_MESSAGE =
  'window.__HEXOFLAT_TEST__ is missing — the app under test was not built with ' +
  'VITE_E2E_HOOKS=true.\n' +
  'Most likely cause locally: something else is already serving port 5173 (e.g. `pnpm ' +
  'start:client`). playwright.config.ts sets `reuseExistingServer: !process.env.CI`, so ' +
  'Playwright silently adopts that server instead of building its own — and a plain dev server ' +
  'has no hooks. Stop it (`pnpm stop:all`) and re-run.\n' +
  'See playwright.config.ts webServer and apps/web/src/e2e/test-hooks.ts.';
