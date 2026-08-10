import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vuePlugin from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';
import vueI18nPlugin from '@intlify/eslint-plugin-vue-i18n';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const webTsconfigRootDir = path.join(repoRoot, 'apps/web');
const engineTsconfigRootDir = path.join(repoRoot, 'packages/engine');
const apiTsconfigRootDir = path.join(repoRoot, 'apps/api');
const playwrightTsconfigRootDir = path.join(repoRoot, 'apps/playwright');
const APP_SRC_FILES = ['apps/web/src/**/*.{ts,vue}'];
const ENGINE_SRC_FILES = ['packages/engine/src/**/*.ts'];
const API_SRC_FILES = ['apps/api/src/**/*.ts'];
// The e2e package is split in two on purpose: `e2e/**` is the test layer
// (Feature calls only, no selectors), everything else is the framework that
// owns them. The rules below are what actually keep that boundary from
// eroding — see apps/playwright/src/framework/base-component.ts.
const E2E_TEST_FILES = ['apps/playwright/e2e/**/*.ts'];
const E2E_FRAMEWORK_FILES = ['apps/playwright/src/**/*.ts', 'apps/playwright/*.ts'];
// The i18n vertical slice (docs/I18N-PLAN.md) only migrated these 3
// components to t()/useI18n() — everywhere else in apps/web still has
// literal English text by design (future migration phase), so no-raw-text
// stays scoped here instead of failing lint repo-wide.
const I18N_MIGRATED_VUE_FILES = [
  'apps/web/src/components/overlays/settings-overlay.vue',
  'apps/web/src/components/overlays/hex-tile-details-overlay.vue',
  'apps/web/src/a-game-scenes/inventory-scene/components/token-details-panel.vue',
];

export default tseslint.config(
  {
    ignores: ['apps/*/dist/**', 'packages/*/dist/**', '**/back-up/**', '**/tsconfig.tsbuildinfo'],
  },

  ...tseslint.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],

  // Type-checked rules require parserOptions.project/projectService, which
  // we only set up for src/** below (the tree pnpm lint and lint-staged
  // actually touch). Force `files` onto every rule-only config from
  // recommendedTypeChecked so it can't leak onto untyped files like
  // vite.config.ts or commitlint.config.js and crash on missing type info.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: [...APP_SRC_FILES, ...ENGINE_SRC_FILES, ...API_SRC_FILES],
  })),

  // Must come last: the typescript-eslint configs above each set
  // languageOptions.parser globally (no `files` filter), which clobbers
  // vue-eslint-parser for .vue files. This block wins by being last, and
  // bundles parserOptions.project here too so nothing after it can reset
  // it via a fresh languageOptions.parserOptions object.
  {
    files: APP_SRC_FILES,
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: webTsconfigRootDir,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Preventive guard (plan item 16): flag raw template text outside
  // t()/$t() so a new hardcoded string can't sneak back into a file that's
  // already been fully localized. Detection doesn't require locale-file
  // settings (only its --fix suggestions would), so this is deliberately
  // minimal config.
  {
    files: I18N_MIGRATED_VUE_FILES,
    plugins: { '@intlify/vue-i18n': vueI18nPlugin },
    rules: {
      // ignoreText: punctuation/glyphs, not translatable content —
      // ':' (token-details-panel.vue's "label: value" pills) and '✕' (the
      // hex-tile-details-overlay.vue close-button glyph).
      '@intlify/vue-i18n/no-raw-text': ['error', { ignoreText: [':', '✕'] }],
    },
  },

  // packages/engine has no .vue files — plain typescript-eslint parser, its own tsconfig.
  {
    files: ENGINE_SRC_FILES,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: engineTsconfigRootDir,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // apps/api has no .vue files either — same plain parser setup, its own tsconfig.
  {
    files: API_SRC_FILES,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: apiTsconfigRootDir,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // apps/playwright, part 1: type-aware linting for the whole e2e package.
  // The one rule that matters most for Playwright is no-floating-promises —
  // a forgotten `await` on an assertion doesn't fail, it makes the test
  // permanently green, which is strictly worse than no test at all.
  {
    files: [...E2E_TEST_FILES, ...E2E_FRAMEWORK_FILES],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir: playwrightTsconfigRootDir,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // apps/playwright, part 2: the layer boundary itself. A spec that reaches
  // for a selector or a raw `page` has stopped being a test of behaviour and
  // become a second, undocumented page object.
  {
    files: E2E_TEST_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.property.name=/^(getByTestId|getByRole|getByLabel|getByText|getByPlaceholder|getByAltText|getByTitle|locator)$/]',
          message:
            'Locators are not allowed in e2e/**. They belong in src/components/*.component.ts.',
        },
        {
          selector: "MemberExpression[object.name='page']",
          message: 'Direct `page` access is not allowed in e2e/**. Go through a Feature class.',
        },
        {
          selector: "MemberExpression[property.name='waitForTimeout']",
          message:
            'waitForTimeout is banned. Wait for a real condition instead (expect.poll / toHaveAttribute).',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              message: "In e2e/** import { test, expect } from '@fixtures' instead.",
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
);
