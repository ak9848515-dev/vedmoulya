import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Lock root to this workspace directory so vitest never walks up to the
  // repo-root vitest.config.ts (which declares test.projects and triggers
  // workspace mode). Workspace mode suppresses per-workspace coverage
  // output, causing the coverage gate to report "No coverage data" on CI.
  root: __dirname,
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [resolve(__dirname, '../../tests/vitest.setup.ts')],
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/index.ts', '**/node_modules/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
