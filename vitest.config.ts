import { defineConfig } from 'vitest/config';

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Root Vitest Configuration (Vitest 4)
// Aggregates per-workspace projects. Vitest 4 removed defineWorkspace
// (previously used by vitest.workspace.ts), so the canonical form is a
// root config with `test.projects` globs that load each workspace's own
// vitest.config.ts (which carries its jsdom/node environment, setup
// files, coverage thresholds, etc.).
// ──────────────────────────────────────────────────────────────────

export default defineConfig({
  test: {
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'services/*/vitest.config.ts',
    ],
  },
});
