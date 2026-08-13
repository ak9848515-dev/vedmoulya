// ──────────────────────────────────────────────────────────────────
// VedMoulya — Prompt Cache Manager
// Provider-aware prompt-caching abstraction. Splits assembled messages
// into STABLE context (system instructions + reusable context) and
// DYNAMIC request context (user input + conversation). Cache keys are
// derived from (identity, capability, stable-content hash) — never from
// user input — so cross-user and cross-tenant leakage is impossible by
// construction. Hit/miss telemetry feeds AIMetrics.
//
// The abstraction is provider-agnostic: adapters surface provider-native
// cached-token accounting through their usage payloads; this manager
// governs the VedMoulya side (key safety, TTL, metrics, re-optimization
// reuse). AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import { AIMetrics } from '../AIMetrics.js';

export interface PromptCacheEntry {
  /** Optimized stable messages (system + context prefix) to reuse. */
  stableMessages: Array<{ role: string; content: string }>;
  /** Token count of the stable prefix. */
  stableTokens: number;
  cachedAt: number;
}

export interface PromptCacheOptions {
  /** Entry TTL. Default: 15 minutes. */
  ttlMs?: number;
  /** Maximum entries (FIFO eviction). Default: 200. */
  maxEntries?: number;
}

export class PromptCacheManager {
  private readonly cache = new Map<string, PromptCacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(
    options: PromptCacheOptions = {},
    private readonly metrics: AIMetrics = AIMetrics.getInstance(),
  ) {
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 200;
  }

  /** Split messages into the stable prefix and the dynamic tail. */
  splitMessages(messages: Array<{ role: string; content: string }>): {
    stable: Array<{ role: string; content: string }>;
    dynamic: Array<{ role: string; content: string }>;
  } {
    const stable: Array<{ role: string; content: string }> = [];
    let idx = 0;
    for (const message of messages) {
      if (message.role === 'user') break;
      stable.push(message);
      idx += 1;
    }
    return { stable, dynamic: messages.slice(idx) };
  }

  /**
   * Tenant/user-safe cache key: identity + capability + stable content hash.
   * The user input NEVER participates in the key.
   */
  keyFor(input: {
    userId: string;
    tenant?: string;
    capability: string;
    stableMessages: Array<{ role: string; content: string }>;
  }): string {
    const identity = [input.tenant ?? 'default', input.userId, input.capability].join('|');
    const stableHash = this.hash(input.stableMessages.map((m) => m.content).join('\n'));
    return this.hash(`${identity}|${stableHash}`);
  }

  get(key: string): PromptCacheEntry | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.metrics.recordPromptCacheMiss();
      return undefined;
    }
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      this.metrics.recordPromptCacheMiss();
      return undefined;
    }
    this.metrics.recordPromptCacheHit();
    return entry;
  }

  set(key: string, entry: PromptCacheEntry): void {
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, entry);
  }

  get hitRatio(): number {
    return this.metrics.getPromptCacheHitRatio();
  }

  get size(): number {
    return this.cache.size;
  }

  private hash(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }
}
