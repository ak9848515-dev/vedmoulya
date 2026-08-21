// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Rate Limiter tests (SPRINT-027 R-1)
// Verifies the RateLimiter port contract:
//   • in-memory backend — per-process fixed window, honest distributed:false;
//   • redis backend — shared fixed window via INCR+PEXPIRE (fake client),
//     explicit degradation on outage (loud + surfaced, never silent);
//   • factory — memory default, redis requires REDIS_URL (fail fast),
//     unknown backend fails fast; status never fabricates distribution.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  InMemoryRateLimiter,
  RedisRateLimiter,
  resolveRateLimiter,
  resetRateLimiter,
  configureRateLimiter,
  getRateLimiterStatus,
  rateLimitKey,
  type RedisLikeClient,
} from '../middleware/rate-limit.js';

afterEach(() => {
  resetRateLimiter();
  vi.unstubAllEnvs();
});

describe('InMemoryRateLimiter (per-process, honest single-instance truth)', () => {
  it('enforces a fixed window per key', async () => {
    const limiter = new InMemoryRateLimiter();
    expect(limiter.distributed).toBe(false);
    expect(limiter.backend).toBe('memory');
    const key = rateLimitKey('user-1', { maxRequests: 3, windowMs: 60_000 });
    expect(await limiter.allow(key, 3, 60_000)).toBe(true);
    expect(await limiter.allow(key, 3, 60_000)).toBe(true);
    expect(await limiter.allow(key, 3, 60_000)).toBe(true);
    expect(await limiter.allow(key, 3, 60_000)).toBe(false);
  });

  it('separates keys (users and tiers never collide)', async () => {
    const limiter = new InMemoryRateLimiter();
    const a = rateLimitKey('alice', { maxRequests: 1, windowMs: 60_000 });
    const b = rateLimitKey('bob', { maxRequests: 1, windowMs: 60_000 });
    await limiter.allow(a, 1, 60_000);
    expect(await limiter.allow(b, 1, 60_000)).toBe(true);
    expect(await limiter.allow(a, 1, 60_000)).toBe(false);
  });

  it('anonymous traffic shares one bucket (no unknown-user bypass)', async () => {
    const limiter = new InMemoryRateLimiter();
    const anon = rateLimitKey('anonymous', { maxRequests: 2, windowMs: 60_000 });
    await limiter.allow(anon, 2, 60_000);
    await limiter.allow(anon, 2, 60_000);
    expect(await limiter.allow(anon, 2, 60_000)).toBe(false);
  });

  it('reports stats for a live bucket', async () => {
    const limiter = new InMemoryRateLimiter();
    const key = rateLimitKey('u', { maxRequests: 5, windowMs: 60_000 });
    await limiter.allow(key, 5, 60_000);
    const stats = await limiter.stats(key, 5, 60_000);
    expect(stats?.remaining).toBe(4);
  });
});

describe('RedisRateLimiter (distributed fixed window)', () => {
  function fakeRedis(overrides: Partial<RedisLikeClient> = {}): RedisLikeClient & {
    counts: Map<string, number>;
  } {
    const counts = new Map<string, number>();
    return {
      counts,
      async incr(key: string): Promise<number> {
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return n;
      },
      async pexpire(): Promise<number> {
        return 1;
      },
      ...overrides,
    };
  }

  it('enforces a shared fixed window (window-keyed buckets)', async () => {
    const client = fakeRedis();
    const limiter = new RedisRateLimiter(undefined, client);
    expect(limiter.distributed).toBe(true);
    expect(limiter.backend).toBe('redis');
    const key = rateLimitKey('u', { maxRequests: 2, windowMs: 60_000 });
    expect(await limiter.allow(key, 2, 60_000)).toBe(true);
    expect(await limiter.allow(key, 2, 60_000)).toBe(true);
    expect(await limiter.allow(key, 2, 60_000)).toBe(false);
    // The bucket lives in the (fake) shared store — the same counter any
    // instance would see.
    expect([...client.counts.values()].reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('degrades EXPLICITLY on a Redis outage — loud, surfaced, still bounded', async () => {
    const client = fakeRedis({
      async incr(): Promise<number> {
        throw new Error('connection refused');
      },
    });
    const limiter = new RedisRateLimiter(undefined, client);
    const key = rateLimitKey('u', { maxRequests: 1, windowMs: 60_000 });
    // First call fails over to the per-process bucket...
    expect(await limiter.allow(key, 1, 60_000)).toBe(true);
    expect(await limiter.allow(key, 1, 60_000)).toBe(false);
    // ...and the status REPORTS the degradation (never silent).
    const status = limiter.status();
    expect(status.degraded).toBe(true);
    expect(status.degradedReason).toContain('connection refused');
    expect(status.distributed).toBe(true); // intent stays redis; truth is surfaced
  });

  it('stats are honest null for the distributed backend (no fabricated numbers)', async () => {
    const limiter = new RedisRateLimiter(undefined, fakeRedis());
    expect(await limiter.stats('u', 10, 60_000)).toBeNull();
  });
});

describe('factory resolution (env-driven, honest)', () => {
  it('defaults to the per-process memory backend (single-instance truth)', () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', undefined);
    const limiter = resolveRateLimiter();
    expect(limiter.backend).toBe('memory');
    expect(limiter.distributed).toBe(false);
    expect(getRateLimiterStatus()).toMatchObject({
      backend: 'memory',
      distributed: false,
      degraded: false,
    });
  });

  it('RATE_LIMIT_BACKEND=redis requires REDIS_URL — fail fast, never silent memory', () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'redis');
    vi.stubEnv('REDIS_URL', '');
    expect(() => resolveRateLimiter()).toThrow(/REDIS_URL/);
  });

  it('RATE_LIMIT_BACKEND=redis with REDIS_URL resolves a distributed limiter', () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'redis');
    vi.stubEnv('REDIS_URL', 'redis://limiter.test:6379');
    const limiter = resolveRateLimiter();
    expect(limiter.backend).toBe('redis');
    expect(limiter.distributed).toBe(true);
  });

  it('unknown backend fails fast', () => {
    vi.stubEnv('RATE_LIMIT_BACKEND', 'postgres');
    expect(() => resolveRateLimiter()).toThrow(/RATE_LIMIT_BACKEND/);
  });

  it('configureRateLimiter overrides the singleton (tests / wiring)', () => {
    const injected = new InMemoryRateLimiter();
    configureRateLimiter(injected);
    expect(resolveRateLimiter()).toBe(injected);
  });
});
