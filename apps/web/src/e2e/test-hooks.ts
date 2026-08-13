import type { HexoflatTestApi } from '@/e2e/test-api.types';

/**
 * Gate: the hooks only exist in a build that explicitly asked for them
 * (`VITE_E2E_HOOKS=true`, set by playwright.config.ts's webServer command).
 *
 * `import.meta.env.VITE_E2E_HOOKS` is statically replaced by Vite at build
 * time, so in a normal production build this reads `undefined !== 'true'`,
 * the whole body becomes dead code, and the bundle contains no trace of
 * `__HEXOFLAT_TEST__`. The call site in hex-world-map.vue is gated on the
 * same constant so this module tree-shakes out entirely — a build check in
 * CI greps dist/ to keep that honest.
 */
export const E2E_HOOKS_ENABLED = import.meta.env.VITE_E2E_HOOKS === 'true';

export function installTestHooks(api: HexoflatTestApi): void {
  if (!E2E_HOOKS_ENABLED) return;
  (window as unknown as { __HEXOFLAT_TEST__?: HexoflatTestApi }).__HEXOFLAT_TEST__ = api;
}

export function uninstallTestHooks(): void {
  if (!E2E_HOOKS_ENABLED) return;
  delete (window as unknown as { __HEXOFLAT_TEST__?: HexoflatTestApi }).__HEXOFLAT_TEST__;
}
