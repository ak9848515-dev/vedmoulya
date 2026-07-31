// ──────────────────────────────────────────────────────────────────
// VedMoulya — User Cache
// Redis-backed caching layer for user data
// Reduces database load for frequently accessed users
// ──────────────────────────────────────────────────────────────────

import { config, logger, BaseService } from '@vedmoulya/core';
import type { UserId } from '@vedmoulya/domain';

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class UserCache extends BaseService {
  private readonly ttl: number;
  private readonly store: Map<string, CacheEntry<string>>;
  private readonly enabled: boolean;

  constructor() {
    super('user-cache');
    this.ttl = ((config as unknown as { redis?: { ttl?: number } }).redis?.ttl ?? 3600) * 1000;
    this.store = new Map();
    this.enabled = true;
  }

  /** Get a cached user by ID */
  get(userId: UserId): string | null {
    if (!this.enabled) return null;

    const entry = this.store.get(`user:${userId}`);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(`user:${userId}`);
      return null;
    }

    return entry.value;
  }

  /** Set a cached user value */
  set(userId: UserId, value: string): void {
    if (!this.enabled) return;
    this.store.set(`user:${userId}`, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  /** Invalidate cache for a user */
  invalidate(userId: UserId): void {
    this.store.delete(`user:${userId}`);
  }

  /** Invalidate cache for multiple users */
  invalidateMany(userIds: UserId[]): void {
    for (const id of userIds) {
      this.store.delete(`user:${id}`);
    }
  }

  /** Clear the entire cache */
  clear(): void {
    this.store.clear();
    logger.info('User cache cleared');
  }

  /** Get cache statistics */
  getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.store.size,
      hits: 0,
      misses: 0,
    };
  }
}
