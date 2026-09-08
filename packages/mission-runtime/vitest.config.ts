import { defineConfig } from 'vitest/config';

// VedMoulya — @vedmoulya/mission-runtime test configuration (BLD-022).
// Node environment: the mission runtime composes real services and a real
// ToolRuntime; the e2e suite runs the actual composed runtime against a
// temporary workspace directory (never the production repository).
export default defineConfig({
  test: {
    environment: 'node',
    // Provision the fail-fast env (AUTH_JWT_SECRET, IDENTITY_DATABASE_URL,
    // REDIS_URL) BEFORE any module imports @vedmoulya/core — the same shared
    // setup every other workspace uses. Without it, constructing the frozen
    // AIOrchestrationService throws EnvironmentError under NODE_ENV=test.
    setupFiles: ['../../tests/vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
