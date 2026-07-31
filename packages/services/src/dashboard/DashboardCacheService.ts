// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Cache Service
// Caching layer for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { CacheMetricsDTO } from './DashboardDTO.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

export class DashboardCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private totalLatency = 0;
  private latencyCount = 0;

  constructor(defaultTtlMs: number = 300_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /** Get a cached value */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  get<T>(key: string): { data?: T; hit: boolean } {
    const start = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      this.totalLatency += Date.now() - start;
      this.latencyCount++;
      return { hit: false };
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      this.totalLatency += Date.now() - start;
      this.latencyCount++;
      return { hit: false };
    }

    entry.hitCount++;
    this.hits++;
    this.totalLatency += Date.now() - start;
    this.latencyCount++;
    return { data: entry.data as T, hit: true };
  }

  /** Set a cached value */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  /** Invalidate a specific key */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Invalidate all keys matching a prefix */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Clear all cached entries */
  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.totalLatency = 0;
    this.latencyCount = 0;
  }

  /** Get cache metrics */
  getMetrics(): CacheMetricsDTO {
    const total = this.hits + this.misses;
    return {
      totalEntries: this.store.size,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
      averageLatency: this.latencyCount > 0 ? this.totalLatency / this.latencyCount : 0,
      memoryUsage: this.store.size,
      oldestEntry: this.getOldestEntry(),
      newestEntry: this.getNewestEntry(),
    };
  }

  /** Check if a key exists and is not expired */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Get remaining TTL for a key in milliseconds */
  getTtl(key: string): number | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  private getOldestEntry(): string | undefined {
    let oldest: string | undefined;
    let oldestTime = Infinity;
    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldest = key;
      }
    }
    return oldest ? new Date(oldestTime).toISOString() : undefined;
  }

  private getNewestEntry(): string | undefined {
    let newest: string | undefined;
    let newestTime = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt > newestTime) {
        newestTime = entry.createdAt;
        newest = key;
      }
    }
    return newest ? new Date(newestTime).toISOString() : undefined;
  }
}
