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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/main.ts', 'src/env.d.ts'],
      // No thresholds yet: only src/content/** has real tests today, and even
      // there functions/branches sit at 0%, so a threshold would just fail on
      // day one. Once src/content/** (or the engine, once it's its own
      // package) has meaningful coverage, add a per-path threshold here
      // instead of a repo-wide one, e.g.:
      // thresholds: { 'src/content/**': { lines: 70, functions: 70, branches: 60, statements: 70 } }
    },
  },
});
