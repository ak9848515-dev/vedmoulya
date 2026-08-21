// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Middleware Tests
// Tests for auth, validation, error, rate-limit, and audit middleware
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { SignJWT } from 'jose';
import { config } from '@vedmoulya/core';
import type { TRPCContext } from '../router.js';
import { toGatewayError, notFound } from '../middleware/error.js';
import { checkRateLimit, assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import { validateInput, validateOrThrow } from '../middleware/validation.js';
import { z } from 'zod';
import { logAuditEvent, getAuditLog } from '../middleware/audit.js';
import {
  verifyAccessToken,
  authenticateRequest,
  createAuthContext,
  isAuthenticated,
  assertUserIdMatchesSession,
} from '../middleware/auth.js';

// ── Error Middleware ─────────────────────────────────────────────────────────

describe('toGatewayError', () => {
  it('maps TRPCError BAD_REQUEST to VALIDATION_ERROR', () => {
    const error = new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
    const result = toGatewayError(error);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe('Invalid input');
  });

  it('maps TRPCError UNAUTHORIZED to AUTHENTICATION_ERROR', () => {
    const error = new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
    const result = toGatewayError(error);
    expect(result.code).toBe('AUTHENTICATION_ERROR');
    expect(result.statusCode).toBe(401);
  });

  it('maps TRPCError FORBIDDEN to AUTHORIZATION_ERROR', () => {
    const error = new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' });
    const result = toGatewayError(error);
    expect(result.code).toBe('AUTHORIZATION_ERROR');
    expect(result.statusCode).toBe(403);
  });

  it('maps TRPCError NOT_FOUND to NOT_FOUND', () => {
    const error = new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    const result = toGatewayError(error);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.statusCode).toBe(404);
  });

  it('maps TRPCError TOO_MANY_REQUESTS to RATE_LIMITED', () => {
    const error = new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit' });
    const result = toGatewayError(error);
    expect(result.code).toBe('RATE_LIMITED');
    expect(result.statusCode).toBe(429);
  });

  it('maps TRPCError TIMEOUT to SERVICE_UNAVAILABLE', () => {
    const error = new TRPCError({ code: 'TIMEOUT', message: 'Timeout' });
    const result = toGatewayError(error);
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
    expect(result.statusCode).toBe(504);
  });

  it('maps unknown Error to INTERNAL_ERROR without exposing message', () => {
    const error = new Error('Database connection string: postgres://secret:password@host');
    const result = toGatewayError(error, 'Something went wrong');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('Something went wrong');
    expect(result.message).not.toContain('secret');
    expect(result.statusCode).toBe(500);
  });

  it('maps non-Error to INTERNAL_ERROR safely', () => {
    const result = toGatewayError('some string error', 'Default message');
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('Default message');
  });
});

describe('notFound', () => {
  it('creates NOT_FOUND TRPCError', () => {
    const error = notFound('User');
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('User not found');
  });
});

// ── Validation Middleware ────────────────────────────────────────────────────

describe('validateInput', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().min(0) });

  it('returns success with data for valid input', () => {
    const result = validateInput(schema, { name: 'Ved', age: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Ved');
    }
  });

  it('returns failure with error message for invalid input', () => {
    const result = validateInput(schema, { name: '', age: -1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('name');
    }
  });

  it('returns failure for missing fields', () => {
    const result = validateInput(schema, {});
    expect(result.success).toBe(false);
  });
});

describe('validateOrThrow', () => {
  const schema = z.object({ id: z.string().uuid() });

  it('returns data for valid input', () => {
    const data = validateOrThrow(schema, { id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('throws TRPCError for invalid input', () => {
    expect(() => validateOrThrow(schema, { id: 'not-a-uuid' })).toThrow(TRPCError);
  });
});

// ── Rate Limiter ─────────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  // Env stubs used by the tier-override tests must never leak to sibling
  // tests even if an assertion fails (vitest does not auto-unstub).
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows first request within limit', async () => {
    const result = await checkRateLimit('user-1', { maxRequests: 3, windowMs: 60_000 });
    expect(result).toBe(true);
  });

  it('allows requests up to the limit', async () => {
    // First 3 should pass
    expect(await checkRateLimit('user-2', { maxRequests: 3, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit('user-2', { maxRequests: 3, windowMs: 60_000 })).toBe(true);
    expect(await checkRateLimit('user-2', { maxRequests: 3, windowMs: 60_000 })).toBe(true);
    // 4th should be blocked
    expect(await checkRateLimit('user-2', { maxRequests: 3, windowMs: 60_000 })).toBe(false);
  });

  it('uses different counters for different users', async () => {
    expect(await checkRateLimit('user-a', { maxRequests: 1, windowMs: 60_000 })).toBe(true);
    // Different user, different counter
    expect(await checkRateLimit('user-b', { maxRequests: 1, windowMs: 60_000 })).toBe(true);
    // user-a is now blocked
    expect(await checkRateLimit('user-a', { maxRequests: 1, windowMs: 60_000 })).toBe(false);
  });

  it('uses standard tier config', () => {
    const config = RateLimitTiers.standard;
    expect(config.maxRequests).toBe(100);
    expect(config.windowMs).toBe(60_000);
  });

  it('uses heavy tier config with lower limits', () => {
    const config = RateLimitTiers.heavy;
    expect(config.maxRequests).toBe(20);
  });

  it('uses health tier with higher limits', () => {
    const config = RateLimitTiers.health;
    expect(config.maxRequests).toBe(200);
  });

  it('honors env overrides for tier limits', async () => {
    vi.stubEnv('RATE_LIMIT_HEALTH_MAX', '5000');
    vi.stubEnv('RATE_LIMIT_HEALTH_WINDOW_MS', '120000');
    // vi.resetModules() forces the next dynamic import to re-evaluate the
    // module top-level, so tier resolution re-reads the stubbed env. (A
    // cache-busted query-string import is rejected by Vitest 4.)
    vi.resetModules();
    const fresh = await import('../middleware/rate-limit.js');
    expect(fresh.RateLimitTiers.health.maxRequests).toBe(5000);
    expect(fresh.RateLimitTiers.health.windowMs).toBe(120000);
    // Untouched tiers keep defaults.
    expect(fresh.RateLimitTiers.standard.maxRequests).toBe(100);
  });

  it('falls back to defaults for invalid env values', async () => {
    vi.stubEnv('RATE_LIMIT_AUTH_MAX', 'not-a-number');
    vi.resetModules();
    const fresh = await import('../middleware/rate-limit.js');
    expect(fresh.RateLimitTiers.auth.maxRequests).toBe(10);
  });
});

describe('assertRateLimit', () => {
  it('does not throw for first request', async () => {
    await expect(
      assertRateLimit('user-3', { maxRequests: 2, windowMs: 60_000 }),
    ).resolves.toBeUndefined();
    await expect(
      assertRateLimit('user-3', { maxRequests: 2, windowMs: 60_000 }),
    ).resolves.toBeUndefined();
  });

  it('throws TRPCError when limit exceeded', async () => {
    const userId = `limited-${Date.now()}`;
    await assertRateLimit(userId, { maxRequests: 1, windowMs: 60_000 }); // first - ok
    await expect(assertRateLimit(userId, { maxRequests: 1, windowMs: 60_000 })).rejects.toThrow(
      TRPCError,
    );
  });
});

// ── Auth Middleware (real JWT verification) ─────────────────────────────────

describe('verifyAccessToken', () => {
  const secret = new TextEncoder().encode(config.auth.jwtSecret);

  async function signToken(payload: Record<string, unknown>, expiresIn = '15m'): Promise<string> {
    return new SignJWT({ ...payload, iat: Math.floor(Date.now() / 1000) })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(expiresIn)
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(secret);
  }

  it('returns session for a valid access token', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'u@v.com',
      role: 'admin',
      type: 'access',
    });
    const session = await verifyAccessToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-1');
    expect(session?.email).toBe('u@v.com');
    expect(session?.role).toBe('admin');
  });

  it('rejects a refresh token', async () => {
    const token = await signToken({ sub: 'user-1', jti: 'rt-1', type: 'refresh' });
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await new SignJWT({ sub: 'user-1', email: 'u@v.com', type: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(new TextEncoder().encode('different-secret'));
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ sub: 'user-1', email: 'u@v.com', type: 'access' }, '-1s');
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it('returns null for garbage input', async () => {
    expect(await verifyAccessToken('not-a-jwt')).toBeNull();
  });
});

describe('authenticateRequest', () => {
  it('throws UNAUTHORIZED when Authorization header is missing', async () => {
    await expect(authenticateRequest(new Headers())).rejects.toThrow(TRPCError);
  });

  it('throws UNAUTHORIZED for a malformed header', async () => {
    await expect(authenticateRequest(new Headers({ authorization: 'Basic abc' }))).rejects.toThrow(
      TRPCError,
    );
  });

  it('throws UNAUTHORIZED for an invalid token', async () => {
    const headers = new Headers({ authorization: 'Bearer not-a-jwt' });
    await expect(authenticateRequest(headers)).rejects.toThrow(TRPCError);
  });

  it('returns the session for a valid Bearer token', async () => {
    const token = await new SignJWT({
      sub: 'user-1',
      email: 'u@v.com',
      role: 'user',
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime('15m')
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(new TextEncoder().encode(config.auth.jwtSecret));

    const ctx = await authenticateRequest(new Headers({ authorization: `Bearer ${token}` }));
    expect(ctx.userId).toBe('user-1');
    expect(ctx.role).toBe('user');
  });
});

describe('createAuthContext', () => {
  it('returns anonymous context when no token is present (public procedures)', async () => {
    const ctx = await createAuthContext(new Headers());
    expect(ctx.userId).toBe('anonymous');
  });

  it('returns anonymous context for invalid token', async () => {
    const ctx = await createAuthContext(new Headers({ authorization: 'Bearer bogus' }));
    expect(ctx.userId).toBe('anonymous');
  });

  it('returns the session for a valid token', async () => {
    const token = await new SignJWT({
      sub: 'user-9',
      email: 'u9@v.com',
      role: 'admin',
      type: 'access',
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime('15m')
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(new TextEncoder().encode(config.auth.jwtSecret));

    const ctx = await createAuthContext(new Headers({ authorization: `Bearer ${token}` }));
    expect(ctx.userId).toBe('user-9');
    expect(ctx.email).toBe('u9@v.com');
  });
});

describe('isAuthenticated', () => {
  it('throws UNAUTHORIZED for anonymous context', () => {
    expect(() => isAuthenticated({ userId: 'anonymous', email: '', role: 'guest' })).toThrow(
      TRPCError,
    );
  });

  it('does not throw for an authenticated context', () => {
    expect(() =>
      isAuthenticated({ userId: 'user-1', email: 'u@v.com', role: 'user' }),
    ).not.toThrow();
  });
});

describe('assertUserIdMatchesSession (IDOR guard)', () => {
  const ctx: TRPCContext = { userId: 'user-1', email: 'u@v.com', role: 'user' };

  it('allows input targeting the session userId', () => {
    expect(() => assertUserIdMatchesSession(ctx, { userId: 'user-1' })).not.toThrow();
  });

  it('throws FORBIDDEN when input targets another userId', () => {
    expect(() => assertUserIdMatchesSession(ctx, { userId: 'user-2' })).toThrow(TRPCError);
    expect(() => assertUserIdMatchesSession(ctx, { userId: 'user-2' })).toThrow(/not authorized/i);
  });

  it('allows inputs without a userId field', () => {
    expect(() => assertUserIdMatchesSession(ctx, { query: 'typescript' })).not.toThrow();
    expect(() => assertUserIdMatchesSession(ctx, {})).not.toThrow();
  });

  it('allows null/undefined/array inputs', () => {
    expect(() => assertUserIdMatchesSession(ctx, null)).not.toThrow();
    expect(() => assertUserIdMatchesSession(ctx, undefined)).not.toThrow();
    expect(() => assertUserIdMatchesSession(ctx, ['user-2'])).not.toThrow();
  });
});

// ── Audit Logger ────────────────────────────────────────────────────────────

describe('logAuditEvent', () => {
  it('logs events and retrieves them', () => {
    logAuditEvent({
      timestamp: new Date().toISOString(),
      type: 'api.request',
      userId: 'test-user',
      path: 'test.path',
      duration: 10,
      success: true,
    });

    const log = getAuditLog('test-user', 10);
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]!.userId).toBe('test-user');
    expect(log[0]!.type).toBe('api.request');
  });

  it('returns empty for unknown user', () => {
    const log = getAuditLog('nonexistent-user', 10);
    expect(log.length).toBe(0);
  });

  it('limits results to requested count', () => {
    // Log a few events for a specific user
    const userId = `audit-limit-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      logAuditEvent({
        timestamp: new Date().toISOString(),
        type: 'api.request',
        userId,
        path: 'test',
        duration: 0,
        success: true,
      });
    }

    const log = getAuditLog(userId, 3);
    expect(log.length).toBeLessThanOrEqual(3);
  });

  it('caps the in-memory log at MAX_LOG_SIZE (bounded memory growth)', () => {
    // Overflow the 10 000-entry cap so the shift branch runs; the log stays
    // bounded and the newest events remain queryable.
    const userId = `audit-overflow-${Date.now()}`;
    for (let i = 0; i < 10_001; i++) {
      logAuditEvent({
        timestamp: new Date().toISOString(),
        type: 'api.request',
        userId,
        path: 'test',
        duration: 0,
        success: true,
      });
    }

    const log = getAuditLog(userId, 10_100);
    expect(log.length).toBeLessThanOrEqual(10_000);
    expect(log[0]!.userId).toBe(userId);
  });
});
