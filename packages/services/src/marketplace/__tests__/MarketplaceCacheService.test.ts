// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Cache Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceCacheService } from '../MarketplaceCacheService.js';

describe('MarketplaceCacheService', () => {
  it('get returns hit false for missing key', () => {
    const svc = new MarketplaceCacheService();
    expect(svc.get('nonexistent')).toEqual({ hit: false });
  });

  it('set and get returns cached data', () => {
    const svc = new MarketplaceCacheService();
    svc.set('key1', { name: 'test' });
    const result = svc.get<{ name: string }>('key1');
    expect(result.hit).toBe(true);
    expect(result.data?.name).toBe('test');
  });

  it('get returns hit false after TTL expiry', async () => {
    const svc = new MarketplaceCacheService(10);
    svc.set('key2', 'value', 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(svc.get('key2').hit).toBe(false);
  });

  it('invalidate removes entry', () => {
    const svc = new MarketplaceCacheService();
    svc.set('key3', 'value');
    svc.invalidate('key3');
    expect(svc.get('key3').hit).toBe(false);
  });

  it('invalidateByPrefix removes matching entries', () => {
    const svc = new MarketplaceCacheService();
    svc.set('marketplace_user1', 'snapshot1');
    svc.set('marketplace_user2', 'snapshot2');
    svc.set('other_key', 'other');
    svc.invalidateByPrefix('marketplace_');
    expect(svc.get('marketplace_user1').hit).toBe(false);
    expect(svc.get('marketplace_user2').hit).toBe(false);
    expect(svc.get('other_key').hit).toBe(true);
  });

  it('has returns true for valid entry', () => {
    const svc = new MarketplaceCacheService();
    svc.set('key4', 'value');
    expect(svc.has('key4')).toBe(true);
  });

  it('has returns false for expired entry', async () => {
    const svc = new MarketplaceCacheService(10);
    svc.set('key_expired', 'value', 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(svc.has('key_expired')).toBe(false);
  });

  it('has returns false for missing entry', () => {
    const svc = new MarketplaceCacheService();
    expect(svc.has('nope')).toBe(false);
  });

  it('clear resets all state', () => {
    const svc = new MarketplaceCacheService();
    svc.set('a', 1);
    svc.set('b', 2);
    svc.get('a');
    svc.get('b');
    svc.clear();
    expect(svc.has('a')).toBe(false);
    expect(svc.getMetrics().totalEntries).toBe(0);
    expect(svc.getMetrics().hitRate).toBe(0);
  });

  it('getMetrics returns correct stats', () => {
    const svc = new MarketplaceCacheService();
    svc.set('m1', 'v1');
    svc.set('m2', 'v2');
    svc.get('m1');
    svc.get('m1');
    svc.get('nonexistent');
    const m = svc.getMetrics();
    expect(m.totalEntries).toBe(2);
    expect(m.hitRate).toBeCloseTo(2 / 3);
    expect(m.missRate).toBeCloseTo(1 / 3);
  });
});
