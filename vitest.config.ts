/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate config from vite.config.ts so production `vite build` stays free
// of test-only plugins and test-time aliasing. The react plugin is still
// needed because we may add component tests later (e.g. BaseNode, DashboardNode).
export default defineConfig({
  plugins: [react()],
  test: {
    // Node environment keeps the 10 initial unit tests (pure fns in lib/)
    // fast — no jsdom spin-up cost. Switch to 'jsdom' per-file via
    //   // @vitest-environment jsdom
    // comment when we start testing React components.
    environment: 'node',
    globals: true,

    // Only pick up our new __tests__ directory, not accidentally tsx files
    // that match *.test.* (Patch 2N: keep scope tight, expand later).
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],

    // Fail loud — a hanging test is worse than a failing one in CI.
    testTimeout: 5000,

    // Keep output terse in CI; verbose locally via CLI flag.
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI ? { junit: 'reports/vitest-junit.xml' } : undefined,
  },
  resolve: {
    // Match vite.config.ts base so relative imports resolve identically.
    alias: {
      '@': '/src',
    },
  },
});
