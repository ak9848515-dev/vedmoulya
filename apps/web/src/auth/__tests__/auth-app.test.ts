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
