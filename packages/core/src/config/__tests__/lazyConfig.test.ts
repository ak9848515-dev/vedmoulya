// ──────────────────────────────────────────────────────────────────
// VedMoulya — Lazy Configuration Regression Tests
// Web-build fix: `next build` (NODE_ENV=production) evaluates route
// modules, so importing @vedmoulya/core must never evaluate
// configuration at module scope. These tests lock in the contract:
//   import  → inert (no throw)
//   first access to config/getConfig() → fail-fast throw when required
//   secrets are missing/invalid (unchanged production semantics).
// ──────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Simulate a production build pipeline with no secrets configured. */
function stubProductionWithoutSecrets(): void {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('AUTH_JWT_SECRET', '');
  vi.stubEnv('IDENTITY_DATABASE_URL', '');
  vi.stubEnv('REDIS_URL', '');
  vi.stubEnv('AI_OPENAI_API_KEY', '');
  vi.stubEnv('AI_ANTHROPIC_API_KEY', '');
  vi.stubEnv('AI_GOOGLE_API_KEY', '');
  vi.stubEnv('AI_DEEPSEEK_API_KEY', '');
  vi.stubEnv('SMTP_HOST', '');
  vi.stubEnv('FF_AI_ASSISTANT_ENABLED', 'false');
  vi.stubEnv('FF_SOCIAL_LOGIN_ENABLED', 'false');
  vi.stubEnv('FF_MARKETPLACE_ENABLED', 'false');
}

describe('lazy configuration evaluation (web-build fix)', () => {
  it('importing @vedmoulya/core is inert without env vars under NODE_ENV=production', async () => {
    stubProductionWithoutSecrets();
    vi.resetModules();

    // Static dynamic import (Vitest 4 rejects variable dynamic imports).
    // Importing the barrel must NOT throw: every module-scope config read
    // (config, logger, featureFlags, observability) is deferred to first use.
    const core = await import('../../index.js');
    expect(core).toBeDefined();
    expect(core.getConfig).toBeTypeOf('function');
  });

  it('first config access throws fail-fast under production without secrets', async () => {
    stubProductionWithoutSecrets();
    vi.resetModules();

    const core = await import('../../index.js');

    // The first access materializes loadConfiguration(), which enforces
    // required secrets (AUTH_JWT_SECRET, IDENTITY_DATABASE_URL, ...).
    expect(() => core.getConfig()).toThrow();
    // The `config` proxy defers identically.
    expect(() => core.config.app).toThrow();
  });

  it('getConfig() returns a real configuration under NODE_ENV=test (lenient defaults)', async () => {
    // NODE_ENV is already 'test' in the suite; ensure no production stubs leak.
    vi.unstubAllEnvs();
    vi.resetModules();

    const core = await import('../../index.js');
    const config = core.getConfig();
    expect(config.app.env).toBe('test');
    expect(config.database.url.length).toBeGreaterThan(0);
  });
});
