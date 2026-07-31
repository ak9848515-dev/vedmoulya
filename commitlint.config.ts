// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — CommitLint Configuration
// Implements BLP-001/D11 Developer Toolchain — conventional commits
// ─────────────────────────────────────────────────────────────────────────────

import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'refactor', // Code restructuring
        'test', // Adding or updating tests
        'docs', // Documentation only
        'style', // Formatting, styling (no code change)
        'chore', // Build process, tooling, dependencies
        'perf', // Performance improvement
        'security', // Security fix
        'ci', // CI/CD changes
        'revert', // Revert a previous commit
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        'core', // @vedmoulya/core
        'domain', // @vedmoulya/domain
        'services', // @vedmoulya/services
        'ui', // @vedmoulya/ui
        'ai', // @vedmoulya/ai
        'shared', // @vedmoulya/shared
        'testing', // @vedmoulya/testing
        'config', // @vedmoulya/config
        'information', // @vedmoulya/information
        'intelligence', // @vedmoulya/intelligence
        'web', // @vedmoulya/web (Next.js app)
        'api', // API gateway service
        'identity', // Identity service
        'knowledge', // Knowledge service
        'decision', // Decision service
        'execution', // Execution service
        'career', // Career service
        'learning', // Learning service
        'notifications', // Notification service
        'memory', // Memory service
        'infra', // Infrastructure, CI/CD
        'deps', // Dependencies
        'docs', // Documentation
        'meta', // Repository meta (no code)
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'scope-empty': [1, 'never'], // Warn on missing scope
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
  },
};

export default Configuration;
