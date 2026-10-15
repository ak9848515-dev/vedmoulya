// ──────────────────────────────────────────────────────────────────
// VedMoulya — Rate limiter: REAL Redis integration (Sprint 022–025 closure, Phase 4C)
//
// The unit suite (`RateLimiter.test.ts`) exercises the Redis backend with an
// INJECTED fake client. That proves the branch logic but NOT the deployed
// behaviour: whether the real INCR + PEXPIRE commands produce a fixed window
// that is genuinely SHARED across independent limiter instances (multi-instance
// enforcement), whether the window key really expires, and how the REAL client
// behaves when Redis is unreachable.
//
// This suite talks to a real Redis. It is a self-skipping integration suite:
// with no reachable Redis it is reported as SKIPPED (never silently passed).
// Point it with `REDIS_TEST_URL`; the default is `redis://127.0.0.1:6379`.
//
// NOTE: this suite deliberately does NOT fall back to `REDIS_URL` — the shared
// vitest setup (`tests/vitest.setup.ts`) forces `REDIS_URL` to a non-routable
// deterministic test host, so falling back to it would always skip. The default
// is an IPv4 literal on purpose: `localhost` can resolve to IPv6 on some hosts,
// where the published Docker port is IPv4.
//
// Every client is created and owned by this suite and disconnected afterwards;
// no key outside the run's unique prefix is written, and nothing is flushed.
// ──────────────────────────────────────────────────────────────────

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import {
  RateLimitTiers,
  RedisRateLimiter,
  rateLimitKey,
  redisRetryStrategy,
} from '../middleware/rate-limit.js';

const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379';

/** A port nothing listens on — the REAL failure path, not a throwing fake. */
const DEAD_REDIS_URL = 'redis://127.0.0.1:6399';

/** Unique key prefix per run so parallel runs and app data never collide. */
const RUN = `itest:${String(Date.now())}:${Math.random().toString(36).slice(2, 8)}`;
let seq = 0;
const key = (label: string): string => `${RUN}:${label}:${String(seq++)}`;

const openClients: Redis[] = [];

/**
 * A real ioredis client wired exactly as the middleware wires its own
 * (lazy connect, no offline queue, no per-request retries, bounded backoff).
 * Owned here so the suite can disconnect it deterministically.
 */
function createClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: redisRetryStrategy,
  });
  // Absence of Redis must never surface as an unhandled emitter error.
  client.on('error', () => undefined);
  openClients.push(client);
  return client;
}

/** A client that is really connected (commands will reach Redis). */
async function connectedClient(): Promise<Redis> {
  const client = createClient(REDIS_URL);
  await client.connect();
  return client;
}

const limiterFor = (client: Redis): RedisRateLimiter => new RedisRateLimiter(undefined, client);

/** Direct client used to inspect the exact keys the limiter writes. */
let inspector: Redis | undefined;

// ── Probe Redis once, at collection time, so an absent Redis SKIPS the suite ──
let redisReachable = false;
{
  const probe = createClient(REDIS_URL);
  try {
    await probe.connect();
    await probe.ping();
    redisReachable = true;
  } catch {
    redisReachable = false;
  }
}

const describeRedis = redisReachable ? describe : describe.skip;

if (!redisReachable) {
  console.warn(
    `[rate-limit redis integration] SKIPPED — no Redis reachable at ${REDIS_URL}. ` +
      'Set REDIS_TEST_URL to run this suite.',
  );
}

beforeAll(async () => {
  if (!redisReachable) return;
  inspector = createClient(REDIS_URL);
  await inspector.connect();
});

afterAll(() => {
  for (const client of openClients) client.disconnect();
});

/** Fixed-window bucket key exactly as the middleware derives it. */
function windowKeyFor(compositeKey: string, windowMs: number): string {
  return `ratelimit:${compositeKey}:${String(Math.floor(Date.now() / windowMs))}`;
}

describeRedis('RedisRateLimiter against a REAL Redis', () => {
  it('enforces ONE shared window across independent instances (distributed, not per-process)', async () => {
    const a = limiterFor(await connectedClient());
    const b = limiterFor(await connectedClient());
    const k = key('shared');
    const max = 3;
    const windowMs = 30_000;

    // Instance A consumes the whole budget…
    expect(await a.allow(k, max, windowMs)).toBe(true);
    expect(await a.allow(k, max, windowMs)).toBe(true);
    expect(await a.allow(k, max, windowMs)).toBe(true);
    // …A is now over budget…
    expect(await a.allow(k, max, windowMs)).toBe(false);
    // …and so is B, which shares nothing but Redis with A. A per-process
    // limiter would have allowed B's first request here.
    expect(await b.allow(k, max, windowMs)).toBe(false);
    expect(a.status().degraded).toBe(false);
    expect(b.status().degraded).toBe(false);

    // The counter really lives in Redis (no per-process illusion). It reached
    // 5: A's four requests plus B's denied one (the backend INCRs first and
    // then compares, so a denied request is still counted in its own window).
    expect(await inspector?.get(windowKeyFor(k, windowMs))).toBe('5');
  });

  it('partitions keys: separate users and separate tiers never share a window', async () => {
    const a = limiterFor(await connectedClient());
    const max = 1;
    const windowMs = 30_000;
    const userA = key('userA');
    const userB = key('userB');

    expect(await a.allow(userA, max, windowMs)).toBe(true);
    expect(await a.allow(userA, max, windowMs)).toBe(false); // A exhausted
    expect(await a.allow(userB, max, windowMs)).toBe(true); // B unaffected

    // The gateway's composite key folds the tier bounds in, so one user on two
    // tiers gets two independent budgets (and two Redis keys). The user name is
    // namespaced with this run's unique prefix so a re-run within the same
    // wall-clock window can never collide with a previous run's bucket.
    const sharedUser = key('usr_shared');
    const standard = rateLimitKey(sharedUser, RateLimitTiers.standard);
    const heavy = rateLimitKey(sharedUser, RateLimitTiers.heavy);
    expect(standard).not.toBe(heavy);
    expect(standard.startsWith(`${sharedUser}:`)).toBe(true);
    expect(await a.allow(standard, max, windowMs)).toBe(true);
    expect(await a.allow(heavy, max, windowMs)).toBe(true);
    expect(await inspector?.get(windowKeyFor(standard, windowMs))).toBe('1');
    expect(await inspector?.get(windowKeyFor(heavy, windowMs))).toBe('1');
  });

  it('sets a REAL TTL on the window key and lets it expire (PEXPIRE is applied)', async () => {
    const a = limiterFor(await connectedClient());
    const k = key('expiry');
    const windowMs = 1_500;

    expect(await a.allow(k, 1, windowMs)).toBe(true);
    expect(await a.allow(k, 1, windowMs)).toBe(false);

    const wk = windowKeyFor(k, windowMs);
    const ttl = await inspector?.ttl(wk);
    // The bucket carries a TTL (seconds, rounded up) — it cannot live forever.
    expect(typeof ttl).toBe('number');
    expect(ttl as number).toBeGreaterThan(0);
    expect(ttl as number).toBeLessThanOrEqual(Math.ceil(windowMs / 1000));

    // …and it really disappears when the window closes.
    await new Promise((resolve) => setTimeout(resolve, windowMs + 400));
    expect(await inspector?.exists(wk)).toBe(0);
  });

  it('degrades once, loudly and bounded, when the REAL Redis is unreachable', async () => {
    // A real client that cannot connect (nothing listens on the port).
    const dead = createClient(DEAD_REDIS_URL);
    await dead.connect().catch(() => undefined);
    const a = limiterFor(dead);
    const k = key('degraded');

    // Still ENFORCED through the per-process fallback: the first `max` requests
    // pass and the next is denied — degradation never fails open.
    expect(await a.allow(k, 2, 30_000)).toBe(true);
    expect(await a.allow(k, 2, 30_000)).toBe(true);
    expect(await a.allow(k, 2, 30_000)).toBe(false);

    // …and the degradation is SURFACED, never hidden.
    const status = a.status();
    expect(status.backend).toBe('redis');
    expect(status.distributed).toBe(true);
    expect(status.degraded).toBe(true);
    expect(status.degradedReason ?? '').not.toBe('');
  });

  it('keeps the degradation independent per key in the fallback', async () => {
    const dead = createClient(DEAD_REDIS_URL);
    await dead.connect().catch(() => undefined);
    const a = limiterFor(dead);
    const k1 = key('fb1');
    const k2 = key('fb2');

    expect(await a.allow(k1, 1, 30_000)).toBe(true);
    expect(await a.allow(k1, 1, 30_000)).toBe(false);
    // A second key is not affected by the first key's exhausted budget.
    expect(await a.allow(k2, 1, 30_000)).toBe(true);
    expect(a.status().degraded).toBe(true);
  });
});

// ── Deterministic contract for the reconnect backoff (no timing flakiness) ────
//
// Measured against the real client BEFORE this was added: pointing the limiter
// at an unreachable Redis produced 7 reconnect attempts in 1.2 s (an immediate,
// unbounded loop) plus an "Unhandled error event" line per attempt. The bounded
// strategy below is what removes that storm; these assertions pin the contract.
describe('redis reconnect backoff is bounded', () => {
  it('starts with a real delay, grows, and is capped', () => {
    expect(redisRetryStrategy(1)).toBe(500);
    expect(redisRetryStrategy(2)).toBe(1_000);
    expect(redisRetryStrategy(10)).toBe(5_000);
    // Capped: never grows without bound, and never becomes an immediate retry.
    expect(redisRetryStrategy(1_000)).toBe(5_000);
    expect(redisRetryStrategy(0)).toBeGreaterThan(0);
    expect(redisRetryStrategy(-5)).toBeGreaterThan(0);
  });
});
