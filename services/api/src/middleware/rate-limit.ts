// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Rate Limiter Middleware
// Simple in-memory rate limiting for tRPC procedures
// Supports both procedural (assertRateLimit) and middleware (withRateLimit) patterns
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

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

// Use a Map with auto-cleanup: periodically remove expired entries
const GLOBAL_LIMITS = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL = 300_000; // 5 minutes
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of GLOBAL_LIMITS) {
    if (now > entry.resetAt) {
      GLOBAL_LIMITS.delete(key);
    }
  }
}

// ── Predefined Rate Limit Tiers ─────────────────────────────────────────────

export const RateLimitTiers = {
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

// ── Internal Check (exported for use with t.middleware() in RouterRegistry) ─

/**
 * Checks if a request should be rate limited.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimitInternal(userId: string, tier: RateLimitConfig): boolean {
  cleanupExpiredEntries();
  const now = Date.now();
  const key = `${userId}:${String(tier.maxRequests)}:${String(tier.windowMs)}`;
  const entry = GLOBAL_LIMITS.get(key);

  if (!entry || now > entry.resetAt) {
    GLOBAL_LIMITS.set(key, { count: 1, resetAt: now + tier.windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > tier.maxRequests) {
    return false;
  }

  return true;
}

// ── Procedural API (for handlers that need it) ───────────────────────────────

/**
 * Checks if a request should be rate limited.
 * Returns true if the request is allowed, false if rate limited.
 */
export function checkRateLimit(userId: string, tier: RateLimitConfig = DEFAULT_CONFIG): boolean {
  return checkRateLimitInternal(userId, tier);
}

/**
 * Rate limiter that throws TRPCError if limit exceeded.
 */
export function assertRateLimit(userId: string, tier: RateLimitConfig = DEFAULT_CONFIG): void {
  if (!checkRateLimitInternal(userId, tier)) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }
}

/**
 * Get current rate limit stats for a user and tier.
 */
export function getRateLimitStats(
  userId: string,
  tier: RateLimitConfig = DEFAULT_CONFIG,
): { remaining: number; resetAt: number } | null {
  const key = `${userId}:${String(tier.maxRequests)}:${String(tier.windowMs)}`;
  const entry = GLOBAL_LIMITS.get(key);

  if (!entry) {
    return null;
  }

  return {
    remaining: Math.max(0, tier.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}
