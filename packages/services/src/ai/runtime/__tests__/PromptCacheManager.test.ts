import { describe, it, expect } from 'vitest';
import { PromptCacheManager } from '../PromptCacheManager.js';

describe('PromptCacheManager', () => {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'system', content: 'Task Context: onboarding workflow' },
    { role: 'user', content: 'Summarize the workflow' },
  ];

  it('splits stable prefix from the dynamic user tail', () => {
    const cache = new PromptCacheManager();
    const { stable, dynamic } = cache.splitMessages(messages);
    expect(stable).toHaveLength(2);
    expect(dynamic).toHaveLength(1);
    expect(dynamic[0].role).toBe('user');
  });

  it('never lets the user input into the cache key', () => {
    const cache = new PromptCacheManager();
    const stable = messages.slice(0, 2);
    const keyA = cache.keyFor({ userId: 'u1', capability: 'reasoning', stableMessages: stable });
    const keyB = cache.keyFor({ userId: 'u1', capability: 'reasoning', stableMessages: stable });
    expect(keyA).toBe(keyB);

    // Different users get different keys (no cross-user reuse).
    const keyOtherUser = cache.keyFor({
      userId: 'u2',
      capability: 'reasoning',
      stableMessages: stable,
    });
    expect(keyA).not.toBe(keyOtherUser);
  });

  it('records hits and misses and computes the hit ratio', () => {
    const cache = new PromptCacheManager();
    const stable = messages.slice(0, 2);
    const key = cache.keyFor({ userId: 'u1', capability: 'reasoning', stableMessages: stable });

    expect(cache.get(key)).toBeUndefined();
    cache.set(key, { stableMessages: stable, stableTokens: 20, cachedAt: Date.now() });
    expect(cache.get(key)?.stableTokens).toBe(20);
    expect(cache.hitRatio).toBeGreaterThan(0);
    expect(cache.hitRatio).toBeLessThanOrEqual(1);
  });

  it('expires entries after the TTL', () => {
    const cache = new PromptCacheManager({ ttlMs: 10 });
    const stable = messages.slice(0, 2);
    const key = cache.keyFor({ userId: 'u1', capability: 'reasoning', stableMessages: stable });
    cache.set(key, { stableMessages: stable, stableTokens: 20, cachedAt: Date.now() - 100 });
    expect(cache.get(key)).toBeUndefined();
  });

  it('evicts the oldest entry at the size bound', () => {
    const cache = new PromptCacheManager({ maxEntries: 2 });
    const mkKey = (n: number) =>
      cache.keyFor({
        userId: `u${n}`,
        capability: 'reasoning',
        stableMessages: [{ role: 'system', content: `stable ${n}` }],
      });
    cache.set(mkKey(1), { stableMessages: [], stableTokens: 1, cachedAt: Date.now() });
    cache.set(mkKey(2), { stableMessages: [], stableTokens: 1, cachedAt: Date.now() });
    cache.set(mkKey(3), { stableMessages: [], stableTokens: 1, cachedAt: Date.now() });
    expect(cache.size).toBe(2);
    expect(cache.get(mkKey(1))).toBeUndefined();
  });
});
