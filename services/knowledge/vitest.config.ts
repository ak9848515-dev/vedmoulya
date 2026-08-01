import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@vedmoulya/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: ['src/**/*.test.ts', '**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/schema/**', 'src/index.ts', '**/node_modules/**'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
