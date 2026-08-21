// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Web App Vitest Configuration
// MOB-001 — Mobile Authentication
// Unit tests for the client auth layer (session manager, auth API client,
// secure storage adapter, tRPC auth link, auth store). The tested modules are
// DOM-free logic, so the node environment suffices — no jsdom dependency.
// Registered in the root vitest.config.ts projects list.
// ─────────────────────────────────────────────────────────────────────────────

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vitest 4's rolldown transform uses oxc options. The Next.js tsconfig uses
  // `jsx: preserve`, so we explicitly request the `automatic` JSX runtime —
  // otherwise JSX in component tests stays unparsed and import-analysis fails.
  // (No @vitejs/plugin-react here: under rolldown-vite its esbuild/jsx config
  // is ignored and only triggers deprecation warnings — oxc handles the JSX
  // transform natively.)
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    // MOB-001/002: auth, stores and lib modules are DOM-free logic (node env);
    // tests that need a browser (mobile-nav persistence, dashboard cache,
    // network hook, native back-button) opt into jsdom via the
    // `@vitest-environment jsdom` pragma.
    environment: 'node',
    globals: true,
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: [
      'src/auth/**/*.test.ts',
      'src/auth/**/*.test.tsx',
      'src/stores/**/*.test.ts',
      'src/lib/**/*.test.ts',
      'src/lib/**/*.test.tsx',
      'src/components/**/*.test.tsx',
      'src/app/**/*.test.tsx',
      'src/app/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/auth/**/*.ts', 'src/stores/auth-store.ts', 'src/lib/**/*.ts'],
      exclude: [
        'src/auth/**/*.test.ts',
        'src/lib/**/*.test.ts',
        'src/lib/**/*.test.tsx',
        '**/node_modules/**',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
