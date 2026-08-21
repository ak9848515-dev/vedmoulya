// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Rate Limiter Middleware
// BLD-016A — API Gateway & Platform Services
// SPRINT-027 (R-1) — production-safe rate limiting.
//
// A RateLimiter PORT with two backends:
//   • memory — the current per-process fixed-window limiter. Honest contract:
//     `distributed: false`. Appropriate for the current single Next.js
//     deployment; bounds abuse per process.
//   • redis  — fixed-window via Redis INCR + PEXPIRE (atomic, shared across
//     instances). Selected explicitly with RATE_LIMIT_BACKEND=redis (+ the
//     already-required REDIS_URL). `distributed: true`.
//
// Honesty rules (SPRINT-027):
//   • distributed safety is NEVER silently claimed: the default backend is
//     memory and getRateLimiterStatus() reports backend/degraded truthfully.
//   • graceful degradation is EXPLICIT: on a Redis outage the limiter logs
//     loudly ONCE and falls back to the per-process in-memory bucket for the
//     rest of the process (still bounded, still enforced) — never silent.
//   • RATE_LIMIT_BACKEND=redis without REDIS_URL fails fast at first use
//     (config error, never a silent memory fallback).
//   • unauthenticated traffic shares one 'anonymous' bucket per tier — no
//     bypass via unknown users.
//
// Tiers are env-configurable (RATE_LIMIT_<TIER>_MAX / _WINDOW_MS) so operators
// can tune limits per environment without code changes.
// ─────────────────────────────────────────────────────────────────────────────

import { Redis } from 'ioredis';
import { logger } from '@vedmoulya/core';
import { TRPCError } from '@trpc/server';

// ── Rate Limit Configuration ────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

// ── RateLimiter Port ─────────────────────────────────────────────────────────

/**
 * The rate-limiter contract. Async so a distributed backend (Redis) can be
 * the enforcement point without blocking the event loop. `allow()` is
 * fail-safe: an implementation that cannot decide must degrade EXPLICITLY
 * (see RedisRateLimiter) — never silently return allow=true.
 */
export interface RateLimiter {
  /** 'memory' = per-process; 'redis' = shared across instances. */
  readonly backend: 'memory' | 'redis';
  /** True only when the backend is shared across processes. */
  readonly distributed: boolean;
  allow(key: string, maxRequests: number, windowMs: number): Promise<boolean>;
  /** Best-effort stats; null when the backend does not compute them. */
  stats(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<{ remaining: number; resetAt: number } | null>;
}

/** Honest runtime status surfaced to operators/tests (never fabricated). */
export interface RateLimiterStatus {
  backend: 'memory' | 'redis';
  distributed: boolean;
  /** True when the configured backend degraded to the in-memory fallback. */
  degraded: boolean;
  degradedReason?: string;
}

// ── In-memory backend (per-process; the current single-instance truth) ───────

export class InMemoryRateLimiter implements RateLimiter {
  readonly backend = 'memory' as const;
  readonly distributed = false;

  private readonly limits = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();

  private cleanupExpired(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 300_000) return; // 5 minutes
    this.lastCleanup = now;
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt) this.limits.delete(key);
    }
  }

  // Sync implementation of the async port — the promise is immediate (no I/O),
  // so there is nothing to await; Promise.resolve keeps the port contract.
  allow(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    this.cleanupExpired();
    const now = Date.now();
    const entry = this.limits.get(key);
    if (!entry || now > entry.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + windowMs });
      return Promise.resolve(true);
    }
    entry.count += 1;
    return Promise.resolve(entry.count <= maxRequests);
  }

  stats(
    key: string,
    maxRequests: number,
    _windowMs: number,
  ): Promise<{
    remaining: number;
    resetAt: number;
  } | null> {
    const entry = this.limits.get(key);
    if (!entry) return Promise.resolve(null);
    return Promise.resolve({
      remaining: Math.max(0, maxRequests - entry.count),
      resetAt: entry.resetAt,
    });
  }
}

// ── Redis backend (explicit multi-instance; INCR + PEXPIRE fixed window) ─────

/** Minimal client surface — ioredis satisfies it; tests inject a fake. */
export interface RedisLikeClient {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
}

export class RedisRateLimiter implements RateLimiter {
  readonly backend = 'redis' as const;
  readonly distributed = true;

  private readonly client: RedisLikeClient;
  private readonly fallback = new InMemoryRateLimiter();
  private degraded = false;
  private degradedReason: string | undefined;

  /** `url` = lazy ioredis connection (no network at construction);
   *  `client` = injected (tests / operators). */
  constructor(url?: string, client?: RedisLikeClient) {
    if (client) {
      this.client = client;
      return;
    }
    // Lazy ioredis: no connection until the first command; fail fast on
    // outage (maxRetriesPerRequest 0) so degradation is immediate + loud.
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });
  }

  async allow(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
    try {
      // Fixed-window key: requests land in the same window bucket per tier.
      const windowKey = `ratelimit:${key}:${String(Math.floor(Date.now() / windowMs))}`;
      const count = await this.client.incr(windowKey);
      if (count === 1) await this.client.pexpire(windowKey, windowMs);
      return count <= maxRequests;
    } catch (error) {
      // Explicit graceful degradation — loud, once, and surfaced in status.
      // Still bounded + enforced (per-process) — never silent, never a
      // security bypass (allow() keeps returning false on real limits).
      if (!this.degraded) {
        this.degraded = true;
        this.degradedReason = error instanceof Error ? error.message : String(error);
        logger.error(
          'Redis rate limiter unavailable — degrading to per-process in-memory buckets',
          {
            error: this.degradedReason,
          },
        );
      }
      return this.fallback.allow(key, maxRequests, windowMs);
    }
  }

  stats(
    _key: string,
    _maxRequests: number,
    _windowMs: number,
  ): Promise<{
    remaining: number;
    resetAt: number;
  } | null> {
    // Honest: the distributed backend does not expose exact remaining counts
    // without an extra round trip per request — returning a fabricated number
    // would violate the no-fabrication rule. Enforcement is what matters.
    return Promise.resolve(null);
  }

  /** Runtime status — honest about the degradation. */
  status(): RateLimiterStatus {
    return {
      backend: 'redis',
      distributed: true,
      degraded: this.degraded,
      degradedReason: this.degradedReason,
    };
  }
}

// ── Predefined Rate Limit Tiers (env-configurable) ───────────────────────────

const DEFAULT_TIERS = {
  /** Standard API access — 100 req/min */
  standard: { maxRequests: 100, windowMs: 60_000 },
  /** Heavy operations (snapshot generation) — 20 req/min */
  heavy: { maxRequests: 20, windowMs: 60_000 },
  /** Search operations — 30 req/min */
  search: { maxRequests: 30, windowMs: 60_000 },
  /** Health checks — 200 req/min */
  health: { maxRequests: 200, windowMs: 60_000 },
  /** Authentication operations — 10 req/min */
  auth: { maxRequests: 10, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>;

function resolveTier(name: string, fallback: RateLimitConfig): RateLimitConfig {
  const prefix = `RATE_LIMIT_${name.toUpperCase()}_`;
  const maxRequests = Number(process.env[`${prefix}MAX`] ?? fallback.maxRequests);
  const windowMs = Number(process.env[`${prefix}WINDOW_MS`] ?? fallback.windowMs);
  return {
    maxRequests:
      Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : fallback.maxRequests,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : fallback.windowMs,
  };
}

export const RateLimitTiers = {
  standard: resolveTier('standard', DEFAULT_TIERS.standard),
  heavy: resolveTier('heavy', DEFAULT_TIERS.heavy),
  search: resolveTier('search', DEFAULT_TIERS.search),
  health: resolveTier('health', DEFAULT_TIERS.health),
  auth: resolveTier('auth', DEFAULT_TIERS.auth),
} as const satisfies Record<string, RateLimitConfig>;

// ── Singleton + factory (env-driven, lazy, honest) ───────────────────────────

let activeLimiter: RateLimiter | undefined;

/** Composite key: user + tier bounds so different tiers never collide and
 *  unauthenticated traffic shares one 'anonymous' bucket per tier. */
export function rateLimitKey(userId: string, tier: RateLimitConfig): string {
  return `${userId}:${String(tier.maxRequests)}:${String(tier.windowMs)}`;
}

/**
 * Resolve the active limiter from the environment (lazy, once):
 *   RATE_LIMIT_BACKEND=redis + REDIS_URL → RedisRateLimiter (distributed);
 *   anything else (default)            → InMemoryRateLimiter (per-process,
 *                                        the honest current-deployment truth).
 * `redis` without REDIS_URL is a CONFIG ERROR — fail fast, never a silent
 * memory fallback. Unknown backends fail fast too.
 */
export function resolveRateLimiter(): RateLimiter {
  if (activeLimiter) return activeLimiter;
  const backend = (process.env.RATE_LIMIT_BACKEND ?? 'memory').toLowerCase();
  if (backend === 'redis') {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error(
        'RATE_LIMIT_BACKEND=redis requires REDIS_URL — refusing to silently degrade to per-process limiting.',
      );
    }
    activeLimiter = new RedisRateLimiter(url);
    return activeLimiter;
  }
  if (backend === 'memory') {
    activeLimiter = new InMemoryRateLimiter();
    return activeLimiter;
  }
  throw new Error(`Unknown RATE_LIMIT_BACKEND "${backend}" (expected memory|redis).`);
}

/** Override the active limiter (tests; gateway wiring). */
export function configureRateLimiter(limiter: RateLimiter): void {
  activeLimiter = limiter;
}

/** Reset the singleton (tests). */
export function resetRateLimiter(): void {
  activeLimiter = undefined;
}

/** Honest status: backend, distribution and degradation. */
export function getRateLimiterStatus(): RateLimiterStatus {
  const limiter = activeLimiter ?? resolveRateLimiter();
  if (limiter instanceof RedisRateLimiter) return limiter.status();
  return { backend: limiter.backend, distributed: limiter.distributed, degraded: false };
}

// ── Internal Check (used by the RouterRegistry middleware) ───────────────────

/**
 * Checks if a request should be rate limited (async — distributed-capable).
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimitInternal(
  userId: string,
  tier: RateLimitConfig,
): Promise<boolean> {
  return resolveRateLimiter().allow(rateLimitKey(userId, tier), tier.maxRequests, tier.windowMs);
}

// ── Procedural API (for handlers that need it) ───────────────────────────────

/** Async rate-limit check (true = allowed). */
export async function checkRateLimit(
  userId: string,
  tier: RateLimitConfig = DEFAULT_CONFIG,
): Promise<boolean> {
  return checkRateLimitInternal(userId, tier);
}

/**
 * Rate limiter that throws TRPCError if the limit is exceeded.
 * Async: the underlying backend may be distributed (Redis).
 */
export async function assertRateLimit(
  userId: string,
  tier: RateLimitConfig = DEFAULT_CONFIG,
): Promise<void> {
  const allowed = await checkRateLimitInternal(userId, tier);
  if (!allowed) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }
}

/** Current rate limit stats for a user and tier (best-effort). */
export async function getRateLimitStats(
  userId: string,
  tier: RateLimitConfig = DEFAULT_CONFIG,
): Promise<{ remaining: number; resetAt: number } | null> {
  return resolveRateLimiter().stats(rateLimitKey(userId, tier), tier.maxRequests, tier.windowMs);
}
