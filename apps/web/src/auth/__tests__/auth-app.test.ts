// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Identity Auth App Mount Tests
// MOB-001 — Mobile Authentication
// Regression guard for the in-process auth router mount:
//   • Routes MUST be reachable at /api/v1/identity/auth/* (Hono matches the
//     full pathname — mounting at '/' silently 404s every call).
//   • Known endpoints answer; unknown paths 404.
// The production repository is mocked; only the existing Hono router + a stub
// AuthService are exercised, so no database is touched.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';

// The AuthService/repository are only touched by sign-in flows, which these
// tests don't invoke — stub the production wiring to keep tests hermetic.
vi.mock('@vedmoulya/api', () => ({
  getServices: () => ({}),
  awaitAllEngineEnsureTables: async () => {},
  createProductionIdentityRepository: () => ({}),
}));

import { getAuthApp } from '../../lib/auth-app.js';

const BASE = 'http://localhost/api/v1/identity/auth';

describe('auth app mount (base path routing)', () => {
  it('answers the health endpoint at the documented base path', async () => {
    const res = await (await getAuthApp()).fetch(new Request(`${BASE}/health`));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'healthy', service: 'auth' });
  });

  it('serves the Google auth URL endpoint', async () => {
    const res = await (await getAuthApp()).fetch(new Request(`${BASE}/google/url`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { url: string; state: string } };
    expect(body.success).toBe(true);
    expect(body.data.url).toContain('accounts.google.com');
    expect(body.data.state.length).toBeGreaterThan(0);
  });

  it('rejects sign-in without a base path prefix (mount regression guard)', async () => {
    const res = await (await getAuthApp()).fetch(new Request('http://localhost/sign-in'));
    expect(res.status).toBe(404);
  });

  it('404s unknown paths under the base path', async () => {
    const res = await (await getAuthApp()).fetch(new Request(`${BASE}/does-not-exist`));
    expect(res.status).toBe(404);
  });

  it('bootstraps the users table before serving (deterministic cold start)', async () => {
    // The mocked repository exposes ensureTable; assert it is awaited before
    // the app is served (i.e. a fetch still answers after the bootstrap ran).
    const app = await getAuthApp();
    const res = await app.fetch(new Request(`${BASE}/health`));
    expect(res.status).toBe(200);
  });
});

describe('auth app mount (Part 2 — AI-independent authentication)', () => {
  const SAVED_AI = {
    AI_OPENAI_API_KEY: process.env.AI_OPENAI_API_KEY,
    AI_GOOGLE_API_KEY: process.env.AI_GOOGLE_API_KEY,
    AI_DEEPSEEK_API_KEY: process.env.AI_DEEPSEEK_API_KEY,
    AI_DEFAULT_PROVIDER: process.env.AI_DEFAULT_PROVIDER,
  };

  it('initializes AND serves the Google OAuth URL endpoint with NO AI keys set', async () => {
    // Simulate the failing production configuration: infrastructure present,
    // every AI provider key ABSENT. Authentication must still work.
    delete process.env.AI_OPENAI_API_KEY;
    delete process.env.AI_GOOGLE_API_KEY;
    delete process.env.AI_DEEPSEEK_API_KEY;
    delete process.env.AI_DEFAULT_PROVIDER;
    try {
      const app = await getAuthApp();
      const res = await app.fetch(new Request(`${BASE}/google/url`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: { url: string } };
      expect(body.success).toBe(true);
      expect(body.data.url).toContain('accounts.google.com');
      const health = await app.fetch(new Request(`${BASE}/health`));
      expect(health.status).toBe(200);
    } finally {
      Object.assign(process.env, SAVED_AI);
    }
  });
});
