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
  TestPortalPreview,
  TestTileFraction,
} from '@web-test-api';

export const MISSING_TEST_HOOKS_MESSAGE =
  'window.__HEXOFLAT_TEST__ is missing — the app under test was not built with ' +
  'VITE_E2E_HOOKS=true.\n' +
  'Most likely cause locally: Playwright was run directly while a plain dev server holds the ' +
  'e2e web port, and `reuseExistingServer` adopted it — a plain dev server has no hooks. ' +
  'Run the suite through `sh scripts/pre-push-e2e.sh [spec files]`, which uses its own ports ' +
  '(API 3101, web 5273) and leaves the dev stack alone.\n' +
  'See playwright.config.ts webServer and apps/web/src/e2e/test-hooks.ts.';
