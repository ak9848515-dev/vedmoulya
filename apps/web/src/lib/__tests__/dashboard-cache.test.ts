// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Cache Tests (MOB-002)
// Verifies the offline snapshot cache: round-trip, TTL expiry, staleness, age
// reporting and clearing.
// ─────────────────────────────────────────────────────────────────────────────

// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheDashboardSnapshot,
  readCachedDashboard,
  cachedDashboardAge,
  clearDashboardCache,
} from '../dashboard-cache.js';

const SNAPSHOT = { identity: { displayName: 'Test User' }, metrics: { lifeScore: 42 } };
const NOW = 1_700_000_000_000;
const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  window.localStorage.clear();
});

describe('cacheDashboardSnapshot / readCachedDashboard', () => {
  it('round-trips the latest snapshot', () => {
    cacheDashboardSnapshot(SNAPSHOT, NOW);
    const entry = readCachedDashboard(HOUR_MS, NOW);
    expect(entry?.data).toEqual(SNAPSHOT);
    expect(entry?.fetchedAt).toBe(NOW);
  });

  it('returns null when nothing is cached', () => {
    expect(readCachedDashboard(HOUR_MS, NOW)).toBeNull();
  });

  it('rejects malformed payloads', () => {
    window.localStorage.setItem('vedmoulya-dashboard-cache-v1', '{not json');
    expect(readCachedDashboard(HOUR_MS, NOW)).toBeNull();
  });
});

describe('TTL expiry', () => {
  it('serves a fresh cache', () => {
    cacheDashboardSnapshot(SNAPSHOT, NOW);
    expect(readCachedDashboard(HOUR_MS, NOW + 30 * 60 * 1000)).not.toBeNull();
  });

  it('expires a stale cache beyond the TTL', () => {
    cacheDashboardSnapshot(SNAPSHOT, NOW);
    expect(readCachedDashboard(HOUR_MS, NOW + 2 * HOUR_MS)).toBeNull();
  });
});

describe('cachedDashboardAge / clearDashboardCache', () => {
  it('reports the age of the cached snapshot', () => {
    cacheDashboardSnapshot(SNAPSHOT, NOW);
    expect(cachedDashboardAge(NOW + 10 * 60 * 1000)).toBe(10 * 60 * 1000);
  });

  it('reports null age when nothing is cached', () => {
    expect(cachedDashboardAge(NOW)).toBeNull();
  });

  it('clears the cache', () => {
    cacheDashboardSnapshot(SNAPSHOT, NOW);
    clearDashboardCache();
    expect(readCachedDashboard(HOUR_MS, NOW)).toBeNull();
    expect(cachedDashboardAge(NOW)).toBeNull();
  });
});
