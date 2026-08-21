import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@vedmoulya/core': path.resolve(import.meta.dirname, '../../packages/core/src'),
      '@vedmoulya/domain': path.resolve(import.meta.dirname, '../../packages/domain/src'),
      '@vedmoulya/services': path.resolve(import.meta.dirname, '../../packages/services/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'src/**/*.d.ts'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
