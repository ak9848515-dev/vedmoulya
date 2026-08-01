// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: ErrorMapper
// Covers mapErrorToResponse for AppError and unknown errors, plus errorMiddleware.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { ValidationError, AuthorizationError, NotFoundError, AppError } from '@vedmoulya/core';
import { mapErrorToResponse, errorMiddleware } from '../src/presentation/middleware/ErrorMapper.js';

function makeCtx() {
  const app = new Hono();
  return app;
}

describe('mapErrorToResponse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a ValidationError to a 400 response with the error code', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse(new ValidationError('Bad input'), c));
    const res = await app.request('/e');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Bad input');
  });

  it('maps an AuthorizationError to 403', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse(new AuthorizationError('Nope'), c));
    const res = await app.request('/e');
    expect(res.status).toBe(403);
  });

  it('maps a NotFoundError to 404 with details preserved', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse(new NotFoundError('User', 'usr_1'), c));
    const res = await app.request('/e');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe('User not found: usr_1');
  });

  it('maps a generic AppError using its statusCode', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse(new CustomError(), c));
    const res = await app.request('/e');
    expect(res.status).toBe(418);
  });

  it('maps an unknown Error to a 500 INTERNAL_ERROR without leaking details', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse(new Error('postgres://secret@host/db'), c));
    const res = await app.request('/e');
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.message).not.toContain('secret');
  });

  it('maps a non-Error throw to a 500 INTERNAL_ERROR', async () => {
    const app = makeCtx();
    app.get('/e', (c) => mapErrorToResponse('string error', c));
    const res = await app.request('/e');
    expect(res.status).toBe(500);
  });
});

describe('errorMiddleware', () => {
  it('swallows errors thrown by next without re-throwing', async () => {
    const app = makeCtx();
    const next = vi.fn().mockRejectedValue(new Error('boom'));
    app.get('/x', async (c) => {
      await expect(errorMiddleware(c, next as never)).resolves.toBeUndefined();
      return c.json({ reached: true });
    });
    const res = await app.request('/x');
    // errorMiddleware catches the rejected next (does not propagate), so the
    // handler continues and returns its own response.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes through when next succeeds', async () => {
    const app = makeCtx();
    app.use('/ok', async (c, n) => {
      await errorMiddleware(c, n as never);
    });
    app.get('/ok', (c) => c.json({ ok: true }));
    const res = await app.request('/ok');
    expect(res.status).toBe(200);
  });
});

class CustomError extends AppError {
  constructor() {
    super('Teapot', 'I_AM_A_TEAPOT', 418);
  }
}
