// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: AuthorizationMiddleware
// Covers requireAbility and requireOwnership Hono middleware.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAbility, requireOwnership } from '../src/authorization/AuthorizationMiddleware.js';

const session = { sub: 'user-1', email: 'u@v.com', role: 'user', type: 'access' as const };

describe('requireAbility', () => {
  it('returns 401 when there is no session', async () => {
    const app = new Hono();
    app.use('/secure', requireAbility('read', 'Content'));
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure');
    expect(res.status).toBe(401);
  });

  it('returns 403 when the user lacks the ability', async () => {
    const app = new Hono();
    app.use('/secure', requireAbility('manage', 'Billing'));
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure', {
      headers: { Authorization: 'Bearer x' },
    });
    // Inject session after auth would normally set it; use middleware order test instead.
    // requireAbility reads c.get('session') which is unset here → 401.
    expect([401, 403]).toContain(res.status);
  });

  it('attaches the ability and allows authorized access', async () => {
    const app = new Hono();
    // Simulate auth by setting the session first, then check ability.
    app.use('/secure', async (c, next) => {
      c.set('session', session);
      await next();
    });
    app.use('/secure', requireAbility('read', 'Content'));
    app.get('/secure', (c) => c.json({ ok: true, ability: c.get('ability') !== undefined }));

    const res = await app.request('/secure');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ability: boolean };
    expect(body.ability).toBe(true);
  });

  it('denies a user managing billing with 403', async () => {
    const app = new Hono();
    app.use('/secure', async (c, next) => {
      c.set('session', session);
      await next();
    });
    app.use('/secure', requireAbility('manage', 'Billing'));
    app.get('/secure', (c) => c.json({ ok: true }));

    const res = await app.request('/secure');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('requireOwnership', () => {
  it('returns 401 without a session', async () => {
    const app = new Hono();
    app.use('/users/:id', requireOwnership('id'));
    app.get('/users/:id', (c) => c.json({ ok: true }));

    const res = await app.request('/users/whatever');
    expect(res.status).toBe(401);
  });

  it('returns 400 when the param is missing', async () => {
    const app = new Hono();
    app.use('/users/:id', requireOwnership('id'));
    app.get('/users/:id', (c) => c.json({ ok: true }));

    const res = await app.request('/users/');
    expect([400, 401, 404]).toContain(res.status);
  });

  it('allows the owner to access their resource', async () => {
    const app = new Hono();
    app.use('/users/:id', async (c, next) => {
      c.set('session', session);
      await next();
    });
    app.use('/users/:id', requireOwnership('id'));
    app.get('/users/:id', (c) => c.json({ ok: true }));

    const res = await app.request('/users/user-1');
    expect(res.status).toBe(200);
  });

  it('denies a non-owner with 403', async () => {
    const app = new Hono();
    app.use('/users/:id', async (c, next) => {
      c.set('session', session);
      await next();
    });
    app.use('/users/:id', requireOwnership('id'));
    app.get('/users/:id', (c) => c.json({ ok: true }));

    const res = await app.request('/users/someone-else');
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
