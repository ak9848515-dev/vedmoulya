// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Cache Service
// Caching layer for the Career Intelligence Platform
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerCacheMetricsDTO } from './CareerDTO.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
  hitCount: number;
}

export class CareerCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private totalLatency = 0;
  private latencyCount = 0;

  constructor(defaultTtlMs: number = 300_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  set<T>(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
    this.totalLatency = 0;
    this.latencyCount = 0;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  getMetrics(): CareerCacheMetricsDTO {
    const total = this.hits + this.misses;
    return {
      totalEntries: this.store.size,
      hitRate: total > 0 ? this.hits / total : 0,
      missRate: total > 0 ? this.misses / total : 0,
      averageLatency: this.latencyCount > 0 ? this.totalLatency / this.latencyCount : 0,
      memoryUsage: this.store.size,
    };
  }
}
