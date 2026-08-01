// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution ErrorMapper unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mapErrorToResponse, errorMiddleware } from '../ErrorMapper.js';
import { AppError, ValidationError, NotFoundError, logger } from '@vedmoulya/core';
import type { Context } from 'hono';

function makeCtx(overrides: Record<string, unknown> = {}): Context {
  return {
    json: vi.fn().mockImplementation((body: unknown, status?: number) => ({ body, status })),
    ...overrides,
  } as unknown as Context;
}

describe('mapErrorToResponse', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a core AppError to its code, message, and status', () => {
    const c = makeCtx();
    const response = mapErrorToResponse(new ValidationError('bad input'), c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'bad input' },
    });
    expect(response.status).toBe(400);
  });

  it('includes details when the AppError carries them', () => {
    const c = makeCtx();
    const response = mapErrorToResponse(new NotFoundError('Plan', 'plan_1'), c);
    expect((response.body as { error: { message: string } }).error.message).toContain('plan_1');
    expect(response.status).toBe(404);
  });

  it('maps a generic Error to INTERNAL_ERROR with 500', () => {
    const c = makeCtx();
    const response = mapErrorToResponse(new Error('boom'), c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
    expect(response.status).toBe(500);
  });

  it('maps a non-Error unknown value to UNKNOWN_ERROR with 500', () => {
    const c = makeCtx();
    const response = mapErrorToResponse('string error', c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' },
    });
    expect(response.status).toBe(500);
  });
});

describe('errorMiddleware', () => {
  it('passes through when next() succeeds', async () => {
    const c = makeCtx();
    const next = vi.fn().mockResolvedValue(undefined);
    await expect(errorMiddleware(c, next)).resolves.toBeUndefined();
    expect(c.json).not.toHaveBeenCalled();
  });

  it('maps errors thrown by next()', async () => {
    const c = makeCtx();
    const next = vi.fn().mockRejectedValue(new AppError('x', 'X_ERROR', 422));
    await expect(errorMiddleware(c, next)).resolves.toBeUndefined();
    expect(c.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'X_ERROR' }),
      }),
      422,
    );
  });
});
