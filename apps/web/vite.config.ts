import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages serves this repo at https://<user>.github.io/hexoflat/,
  // so assets need that prefix in production. Local dev/build stays at '/'.
  base: process.env.GITHUB_PAGES ? '/hexoflat/' : '/',
  plugins: [vue()],
  server: {
    open: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@core': path.resolve(__dirname, 'src/core'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@stores': path.resolve(__dirname, 'src/stores'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Content tests moved to packages/engine (Phase 3); apps/web has no unit
    // tests yet, so allow an empty run instead of failing CI.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/main.ts', 'src/env.d.ts'],
    },
  },
});
