// VedMoulya — UI Package Vitest Configuration
// Component tests run in jsdom with the shared setup. JSX is transformed by
// Vitest 4's rolldown/oxc pipeline (no @vitejs/plugin-react: under
// rolldown-vite its esbuild config is ignored and only triggers deprecation
// warnings).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/vitest.setup.ts', '../../tests/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/index.ts',
        'src/stories/**',
        '**/node_modules/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
