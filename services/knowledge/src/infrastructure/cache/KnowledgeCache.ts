// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Cache
// In-memory TTL cache for knowledge graph queries
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class KnowledgeCache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number; // milliseconds
  private hitCount = 0;
  private missCount = 0;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs;
  }

  /** Get a value from cache */
  get(key: string): unknown {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return undefined;
    }
    this.hitCount++;
    return entry.value;
  }

  /** Set a value in cache with optional TTL */
  set(key: string, value: unknown, ttlMs?: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  /** Delete a key from cache */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /** Clear all cache entries */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /** Get cache statistics */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
    };
  }

  /** Get cache entry count */
  get size(): number {
    return this.cache.size;
  }

  /** Invalidate all entries matching a prefix */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}
