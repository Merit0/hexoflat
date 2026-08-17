/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /**
   * Set to 'true' only by the e2e build (see apps/playwright/playwright.config.ts's
   * webServer command) to expose `window.__HEXOFLAT_TEST__`. Undefined in every
   * normal build, which makes the hook code dead and tree-shakes it away.
   */
  readonly VITE_E2E_HOOKS?: string;
  /**
   * Set to 'true' to enable the exploration slice's rules
   * (docs/EXPLORATION-SLICE-WORKFLOW.md). Off in every normal build. Never
   * on in a multiplayer session — that is enforced in the engine, not here.
   */
  readonly VITE_FEATURE_EXPLORATION_SLICE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
