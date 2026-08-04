import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts'],
      // Floor of the actual coverage as of 2026-08 — a floor, not a target:
      // guards against regressions, doesn't imply these numbers are good enough.
      thresholds: {
        statements: 51,
        branches: 30,
        functions: 54,
        lines: 53,
      },
    },
  },
});
