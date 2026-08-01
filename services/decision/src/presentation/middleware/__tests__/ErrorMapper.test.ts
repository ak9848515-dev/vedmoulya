// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision ErrorMapper unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mapErrorToResponse, errorMiddleware } from '../ErrorMapper.js';
import { AppError, ValidationError, logger } from '@vedmoulya/core';
import { DecisionNotFoundError } from '../../../errors/DecisionErrors.js';
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
    const err = new ValidationError('bad input');
    const response = mapErrorToResponse(err, c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'bad input' },
    });
    expect(response.status).toBe(400);
  });

  it('includes details when the AppError carries them', () => {
    const c = makeCtx();
    const err = new ValidationError('bad input', { field: 'title' });
    const response = mapErrorToResponse(err, c);
    expect((response.body as { error: { details: unknown } }).error.details).toEqual({
      field: 'title',
    });
  });

  it('maps a generic Error (incl. domain DecisionError) to INTERNAL_ERROR with 500', () => {
    const c = makeCtx();
    // DecisionNotFoundError extends DecisionError -> Error, NOT core AppError,
    // so it must fall into the generic Error branch.
    const response = mapErrorToResponse(new DecisionNotFoundError('dec-1'), c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
    expect(response.status).toBe(500);
  });

  it('maps unknown values to UNKNOWN_ERROR with 500', () => {
    const c = makeCtx();
    const response = mapErrorToResponse('not-an-error', c);
    expect(response.body).toEqual({
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: 'An unknown error occurred' },
    });
    expect(response.status).toBe(500);
  });

  it('constructs a bare AppError with message-first arguments', () => {
    const err = new AppError('msg', 'CUSTOM_CODE', 503, { retry: true });
    expect(err.code).toBe('CUSTOM_CODE');
    expect(err.statusCode).toBe(503);
    expect(err.details).toEqual({ retry: true });
  });
});

describe('errorMiddleware', () => {
  it('passes through when next succeeds', async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    await errorMiddleware(makeCtx(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('maps errors thrown by next', async () => {
    const c = makeCtx();
    const next = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(errorMiddleware(c, next)).resolves.toBeUndefined();
    expect(c.json).toHaveBeenCalled();
  });
});
