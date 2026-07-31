import { CACHE_PREFIX } from '../../constants/ExecutionConstants.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class ExecutionCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTLms: number;
  private readonly maxSize: number;

  constructor() {
    this.defaultTTLms = Number(process.env.EXECUTION_CACHE_TTL_MS ?? '300000');
    this.maxSize = Number(process.env.EXECUTION_CACHE_MAX_SIZE ?? '1000');
  }

  private makeKey(prefix: string, key: string): string {
    return `${prefix}${key}`;
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() > entry.expiresAt;
  }

  private evictIfNeeded(): void {
    if (this.store.size >= this.maxSize) {
      const oldest = [...this.store.entries()].sort(([, a], [, b]) => a.expiresAt - b.expiresAt)[0];
      if (oldest) this.store.delete(oldest[0]);
    }
  }

  get(prefix: string, key: string): unknown {
    const cacheKey = this.makeKey(prefix, key);
    const entry = this.store.get(cacheKey);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(cacheKey);
      return undefined;
    }
    return entry.data;
  }

  set(prefix: string, key: string, data: unknown, ttlMs?: number): void {
    this.evictIfNeeded();
    const cacheKey = this.makeKey(prefix, key);
    this.store.set(cacheKey, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTLms),
    });
  }

  invalidate(prefix: string, key: string): void {
    this.store.delete(this.makeKey(prefix, key));
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  // ── Convenience Methods ───────────────────────────────────────────────

  getPlan(id: string): unknown {
    return this.get(CACHE_PREFIX.PLAN, id);
  }
  setPlan(id: string, data: unknown): void {
    this.set(CACHE_PREFIX.PLAN, id, data);
  }
  invalidatePlan(id: string): void {
    this.invalidate(CACHE_PREFIX.PLAN, id);
  }

  getStats(): unknown {
    return this.get(CACHE_PREFIX.STATS, 'global');
  }
  setStats(data: unknown): void {
    this.set(CACHE_PREFIX.STATS, 'global', data);
  }
  invalidateStats(): void {
    this.invalidate(CACHE_PREFIX.STATS, 'global');
  }

  invalidateAllPlans(): void {
    this.invalidatePrefix(CACHE_PREFIX.PLAN);
  }
}
