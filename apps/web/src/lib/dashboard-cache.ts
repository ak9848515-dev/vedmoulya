// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Cache (MOB-002)
// Persists the last successful Life OS snapshot so the dashboard can render
// stale-but-usable data while offline instead of an empty error screen.
//   • Written after every successful fetch.
//   • Read back when the network query fails or the device is offline.
//   • TTL (default 24h) bounds how stale the cached view is allowed to be.
// Pure module — no React, unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

export interface CachedDashboardEntry {
  /** The raw snapshot payload (as returned by lifeOS.getSnapshot). */
  data: unknown;
  /** Fetched-at epoch milliseconds. */
  fetchedAt: number;
}

const CACHE_KEY = 'vedmoulya-dashboard-cache-v1';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readRaw(): CachedDashboardEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const entry = parsed as Partial<CachedDashboardEntry>;
      if ('data' in entry && typeof entry.fetchedAt === 'number') {
        return entry as CachedDashboardEntry;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist the latest successful snapshot (coalesces writes). */
export function cacheDashboardSnapshot(data: unknown, now = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedDashboardEntry = { data, fetchedAt: now };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Quota exceeded / private mode — caching is best-effort.
  }
}

/**
 * Read the cached snapshot if it is fresher than `ttlMs`.
 * Returns null when absent, malformed, or stale.
 */
export function readCachedDashboard(
  ttlMs = DEFAULT_TTL_MS,
  now = Date.now(),
): CachedDashboardEntry | null {
  const entry = readRaw();
  if (!entry) return null;
  if (now - entry.fetchedAt > ttlMs) return null;
  return entry;
}

/** Age (ms) of the cached snapshot; null when nothing is cached. */
export function cachedDashboardAge(now = Date.now()): number | null {
  const entry = readRaw();
  return entry ? now - entry.fetchedAt : null;
}

/** Clear the cache (logout / explicit user action). */
export function clearDashboardCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // no-op
  }
}
