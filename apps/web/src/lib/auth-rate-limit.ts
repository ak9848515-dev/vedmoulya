// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — In-Process Auth Endpoint Rate Limiter
// MOB-001 hardening (2026-08-09): the mounted `/api/v1/identity/auth/*` Hono
// routes (sign-in, sign-up, refresh) are credential brute-force targets and
// previously carried no in-process throttle (documented Ops note). This module
// adds a per-client-IP sliding-window limiter for those endpoints.
//
// Design notes:
//   • In-memory by design (single Next.js instance). For a horizontally scaled
//     deployment, terminate throttling at the edge (WAF / Redis-backed limit).
//   • Tuned via the same env vars the gateway RateLimitTiers.auth uses:
//       RATE_LIMIT_AUTH_MAX=10        (requests per window)
//       RATE_LIMIT_AUTH_WINDOW_MS=60000
//   • `retry-after` (seconds) is returned to clients that are throttled, so
//     legitimate users see exactly when they can try again.
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_AUTH_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 };

const WINDOW_MS_MIN = 1000;

// Per-IP sliding-window entries, with periodic eviction of expired keys so a
// flood of distinct spoofed X-Forwarded-For values cannot grow the Map forever.
const REQUESTS = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 300_000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of REQUESTS) {
    if (now > entry.resetAt) {
      REQUESTS.delete(key);
    }
  }
}

/**
 * Resolve the auth tier from env (inherits the gateway's RATE_LIMIT_AUTH_*
 * contract). Invalid or non-positive values fall back to the safe default.
 */
export function resolveAuthLimit(): RateLimitConfig {
  const maxRequests = Number(process.env.RATE_LIMIT_AUTH_MAX ?? DEFAULT_AUTH_LIMIT.maxRequests);
  const windowMs = Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS ?? DEFAULT_AUTH_LIMIT.windowMs);
  return {
    maxRequests:
      Number.isFinite(maxRequests) && maxRequests > 0
        ? maxRequests
        : DEFAULT_AUTH_LIMIT.maxRequests,
    windowMs:
      Number.isFinite(windowMs) && windowMs >= WINDOW_MS_MIN
        ? windowMs
        : DEFAULT_AUTH_LIMIT.windowMs,
  };
}

/**
 * Resolve the client IP from forwarded headers. The first entry of
 * `x-forwarded-for` is the client in a trusted-proxy chain; `x-real-ip` is the
 * fallback used by nginx. Unknown/absent addresses share a single bucket so a
 * misconfigured proxy cannot be used to exhaust memory with unique keys.
 */
export function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    if (first) return first.trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Record an attempt from `ip`. Returns 0 when the request is allowed, otherwise
 * the number of milliseconds until the client is allowed to retry.
 */
export function consumeAuthRequest(
  ip: string,
  config: RateLimitConfig = resolveAuthLimit(),
): number {
  cleanupExpiredEntries();
  const now = Date.now();

  const entry = REQUESTS.get(ip);
  if (!entry || now > entry.resetAt) {
    REQUESTS.set(ip, { count: 1, resetAt: now + config.windowMs });
    return 0;
  }

  entry.count += 1;
  return entry.count > config.maxRequests ? entry.resetAt - now : 0;
}

/** Clear all tracked buckets (tests, and operator resets). */
export function resetAuthRateLimits(): void {
  REQUESTS.clear();
  lastCleanup = Date.now();
}
