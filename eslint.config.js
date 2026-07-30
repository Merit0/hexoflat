import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vuePlugin from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const webTsconfigRootDir = path.join(repoRoot, 'apps/web');
const engineTsconfigRootDir = path.join(repoRoot, 'packages/engine');
const apiTsconfigRootDir = path.join(repoRoot, 'apps/api');
const APP_SRC_FILES = ['apps/web/src/**/*.{ts,vue}'];
const ENGINE_SRC_FILES = ['packages/engine/src/**/*.ts'];
const API_SRC_FILES = ['apps/api/src/**/*.ts'];

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

  prettierConfig,
);
