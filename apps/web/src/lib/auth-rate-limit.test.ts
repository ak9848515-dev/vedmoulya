// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Auth Rate Limit Unit Tests
// Hardening 2026-08-09 — per-IP throttle for credential endpoints.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeAuthRequest,
  resetAuthRateLimits,
  resolveAuthLimit,
  resolveClientIp,
} from './auth-rate-limit.js';

describe('resolveAuthLimit', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('falls back to the safe default when unset', () => {
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
    expect(resolveAuthLimit()).toEqual({ maxRequests: 10, windowMs: 60_000 });
  });

  it('honors valid env overrides', () => {
    process.env.RATE_LIMIT_AUTH_MAX = '25';
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = '120000';
    expect(resolveAuthLimit()).toEqual({ maxRequests: 25, windowMs: 120_000 });
  });

  it('rejects non-positive or non-finite values in favor of defaults', () => {
    process.env.RATE_LIMIT_AUTH_MAX = '0';
    process.env.RATE_LIMIT_AUTH_WINDOW_MS = 'not-a-number';
    expect(resolveAuthLimit()).toEqual({ maxRequests: 10, windowMs: 60_000 });
  });
});

describe('resolveClientIp', () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request('http://localhost/api/v1/identity/auth/sign-in', { headers });
  }

  it('uses the first entry of x-forwarded-for (trusted proxy chain)', () => {
    const req = makeRequest({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1, 10.0.0.2' });
    expect(resolveClientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeRequest({ 'x-real-ip': '198.51.100.7' });
    expect(resolveClientIp(req)).toBe('198.51.100.7');
  });

  it('falls back to a shared bucket when no client address exists', () => {
    expect(resolveClientIp(makeRequest({}))).toBe('unknown');
  });
});

describe('consumeAuthRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-09T00:00:00Z'));
    resetAuthRateLimits();
  });

  afterEach(() => {
    resetAuthRateLimits();
    vi.useRealTimers();
  });

  it('allows requests up to the configured limit', () => {
    const config = { maxRequests: 3, windowMs: 60_000 };
    expect(consumeAuthRequest('192.0.2.1', config)).toBe(0);
    expect(consumeAuthRequest('192.0.2.1', config)).toBe(0);
    expect(consumeAuthRequest('192.0.2.1', config)).toBe(0);
  });

  it('rejects with a retry window once the limit is exceeded', () => {
    const config = { maxRequests: 2, windowMs: 60_000 };
    expect(consumeAuthRequest('192.0.2.2', config)).toBe(0);
    expect(consumeAuthRequest('192.0.2.2', config)).toBe(0);
    const retryAfter = consumeAuthRequest('192.0.2.2', config);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60_000);
  });

  it('tracks distinct IPs independently', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    expect(consumeAuthRequest('192.0.2.1', config)).toBe(0);
    expect(consumeAuthRequest('192.0.2.1', config)).toBeGreaterThan(0);
    expect(consumeAuthRequest('192.0.2.9', config)).toBe(0);
  });

  it('resets the bucket once the window elapses', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    expect(consumeAuthRequest('192.0.2.3', config)).toBe(0);
    expect(consumeAuthRequest('192.0.2.3', config)).toBeGreaterThan(0);

    vi.advanceTimersByTime(61_000);
    expect(consumeAuthRequest('192.0.2.3', config)).toBe(0);
  });

  it('purges expired buckets when cleanup runs', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    consumeAuthRequest('192.0.2.4', config);
    consumeAuthRequest('192.0.2.5', config);

    // Advance past both the window and the cleanup interval.
    vi.advanceTimersByTime(400_000);
    // Next call triggers cleanup; both old buckets are evicted so attempts
    // start fresh again (window resets).
    expect(consumeAuthRequest('192.0.2.4', config)).toBe(0);
  });
});
