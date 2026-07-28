import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vuePlugin from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ['dist/**', 'back-up/**', 'tsconfig.tsbuildinfo'],
  },

  ...tseslint.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  ...tseslint.configs.recommendedTypeChecked,

  // Must come last: the typescript-eslint configs above each set
  // languageOptions.parser globally (no `files` filter), which clobbers
  // vue-eslint-parser for .vue files. This block wins by being last, and
  // bundles parserOptions.project here too so nothing after it can reset
  // it via a fresh languageOptions.parserOptions object.
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        projectService: true,
        tsconfigRootDir,
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

  prettierConfig,
);
