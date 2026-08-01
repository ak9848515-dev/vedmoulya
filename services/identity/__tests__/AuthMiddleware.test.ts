// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthMiddleware
// Covers requireAuth (mandatory) and optionalAuth (best-effort) Hono middleware.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, optionalAuth } from '../src/auth/AuthMiddleware.js';

describe('requireAuth', () => {
  const validPayload = { sub: 'user-1', email: 'u@v.com', role: 'user', type: 'access' as const };

  it('rejects requests without an Authorization header (401)', async () => {
    const app = new Hono();
    app.use(
      '/secure',
      requireAuth(() => Promise.resolve(null)),
    );
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NO_TOKEN');
  });

  it('rejects requests with a non-Bearer header (401)', async () => {
    const app = new Hono();
    app.use(
      '/secure',
      requireAuth(() => Promise.resolve(null)),
    );
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure', { headers: { Authorization: 'Basic abc' } });
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid token (401)', async () => {
    const app = new Hono();
    app.use(
      '/secure',
      requireAuth(() => Promise.resolve(null)),
    );
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure', {
      headers: { Authorization: 'Bearer invalid' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('TOKEN_INVALID');
  });

  it('attaches the session and calls next for a valid token', async () => {
    const app = new Hono();
    app.use(
      '/secure',
      requireAuth(() => Promise.resolve(validPayload)),
    );
    app.get('/secure', (c) => c.json({ ok: true, session: c.get('session') }));

    const res = await app.request('/secure', {
      headers: { Authorization: 'Bearer good' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; session: typeof validPayload };
    expect(body.ok).toBe(true);
    expect(body.session.sub).toBe('user-1');
  });

  it('calls the provided verifyToken with the raw token', async () => {
    const verifyToken = vi.fn().mockResolvedValue(validPayload);
    const app = new Hono();
    app.use('/secure', requireAuth(verifyToken));
    app.get('/secure', (c) => c.json({ ok: true }));

    await app.request('/secure', { headers: { Authorization: 'Bearer token-xyz' } });
    expect(verifyToken).toHaveBeenCalledWith('token-xyz');
  });
});

describe('optionalAuth', () => {
  const validPayload = { sub: 'user-1', email: 'u@v.com', role: 'user', type: 'access' as const };

  it('passes through without a token', async () => {
    const app = new Hono();
    app.use(
      '/any',
      optionalAuth(() => Promise.resolve(null)),
    );
    app.get('/any', (c) => c.json({ ok: true, session: c.get('session') }));

    const res = await app.request('/any');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session?: unknown };
    expect(body.session).toBeUndefined();
  });

  it('attaches the session when a valid token is present', async () => {
    const app = new Hono();
    app.use(
      '/any',
      optionalAuth(() => Promise.resolve(validPayload)),
    );
    app.get('/any', (c) => c.json({ ok: true, session: c.get('session') }));

    const res = await app.request('/any', {
      headers: { Authorization: 'Bearer good' },
    });
    const body = (await res.json()) as { session?: { sub: string } };
    expect(body.session?.sub).toBe('user-1');
  });

  it('ignores an invalid token and passes through', async () => {
    const app = new Hono();
    app.use(
      '/any',
      optionalAuth(() => Promise.resolve(null)),
    );
    app.get('/any', (c) => c.json({ ok: true, session: c.get('session') }));

    const res = await app.request('/any', {
      headers: { Authorization: 'Bearer bad' },
    });
    expect(res.status).toBe(200);
  });
});
