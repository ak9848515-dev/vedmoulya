import { describe, it, expect } from 'vitest';
import {
  FreeResourceIntelligence,
  DEFAULT_FREE_CLAIM_MAX_AGE_MS,
} from '../domain/FreeResourceIntelligence.js';

const now = () => new Date('2026-08-11T00:00:00.000Z').getTime();
const intelligence = new FreeResourceIntelligence(now);

describe('FreeResourceIntelligence', () => {
  it('FREE_WITH_QUOTA stays distinct from unlimited free and carries its limits', () => {
    const free = intelligence.assess({
      claimedFreeClass: 'FREE_WITH_QUOTA',
      localAvailability: 'UNKNOWN',
      dailyLimit: 1000,
      monthlyLimit: 30000,
      rateLimit: '10 req/min',
      verificationTimestamp: '2026-08-01T00:00:00.000Z',
    });
    expect(free.freeClass).toBe('FREE_WITH_QUOTA');
    expect(free.dailyLimit).toBe(1000);
    expect(free.monthlyLimit).toBe(30000);
    expect(free.status).toBe('ACTIVE');
    expect(intelligence.usable(free)).toBe(true);
  });

  it('stale verification → STALE rather than assumed still free', () => {
    const stale = intelligence.assess({
      claimedFreeClass: 'FREE_API',
      localAvailability: 'UNKNOWN',
      verificationTimestamp: '2026-01-01T00:00:00.000Z', // 7 months ago
    });
    expect(stale.status).toBe('STALE');
    expect(intelligence.usable(stale)).toBe(false);
  });

  it('no verification timestamp → VERIFICATION_REQUIRED (never assumed free)', () => {
    const unverified = intelligence.assess({
      claimedFreeClass: 'FREE_API',
      localAvailability: 'UNKNOWN',
    });
    expect(unverified.status).toBe('VERIFICATION_REQUIRED');
    expect(intelligence.usable(unverified)).toBe(false);
  });

  it('expired free trial → VERIFICATION_REQUIRED', () => {
    const expired = intelligence.assess({
      claimedFreeClass: 'FREE_TRIAL',
      localAvailability: 'UNKNOWN',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    expect(expired.status).toBe('VERIFICATION_REQUIRED');
  });

  it('PAID and UNKNOWN classes are never usable as free', () => {
    expect(
      intelligence.usable(
        intelligence.assess({ claimedFreeClass: 'PAID', localAvailability: 'UNKNOWN' }),
      ),
    ).toBe(false);
    expect(
      intelligence.usable(
        intelligence.assess({ claimedFreeClass: 'UNKNOWN', localAvailability: 'UNKNOWN' }),
      ),
    ).toBe(false);
  });

  it('respects a custom maxAgeMs', () => {
    const fresh = intelligence.assess(
      {
        claimedFreeClass: 'FREE_API',
        localAvailability: 'UNKNOWN',
        verificationTimestamp: '2026-08-01T00:00:00.000Z', // 10 days
      },
      20 * 24 * 60 * 60 * 1000,
    );
    expect(fresh.status).toBe('ACTIVE');

    const aged = intelligence.assess(
      {
        claimedFreeClass: 'FREE_API',
        localAvailability: 'UNKNOWN',
        verificationTimestamp: '2026-08-01T00:00:00.000Z',
      },
      5 * 24 * 60 * 60 * 1000,
    );
    expect(aged.status).toBe('STALE');
  });

  it('exposes the default max age constant for staleness anchors', () => {
    expect(DEFAULT_FREE_CLAIM_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
