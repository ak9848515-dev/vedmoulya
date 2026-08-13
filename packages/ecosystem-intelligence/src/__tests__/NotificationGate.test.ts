import { describe, it, expect } from 'vitest';
import { NotificationGate, MIN_MEANINGFUL_RELEVANCE } from '../domain/NotificationGate.js';
import { FIXED_NOW } from './fixtures.js';

const gate = new NotificationGate({ now: () => FIXED_NOW });

describe('NotificationGate — meaningful events only', () => {
  it('emits a relevant meaningful event', () => {
    const notification = gate.maybeNotify({
      kind: 'BETTER_PROVIDER_DISCOVERED',
      title: 'Better video provider found',
      body: 'A provider with materially higher quality is available.',
      relevance: 92,
    });
    expect(notification?.kind).toBe('BETTER_PROVIDER_DISCOVERED');
    expect(notification?.relevance).toBe(92);
  });

  it('drops events below the relevance threshold', () => {
    const dropped = gate.maybeNotify({
      kind: 'NEW_FREE_MODEL',
      title: 'Minor model update',
      body: 'Not worth interrupting the user.',
      relevance: 30,
    });
    expect(dropped).toBeUndefined();
  });

  it('only meaningful kinds are ever surfaced', () => {
    const result = gate.maybeNotify({
      // @ts-expect-error — non-meaningful event kinds are rejected by construction
      kind: 'EVERY_SMALL_CHANGE',
      title: 'Noise',
      body: 'Should never surface.',
      relevance: 99,
    });
    expect(result).toBeUndefined();
  });

  it('each meaningful kind is recognized', () => {
    const kinds = [
      'BETTER_PROVIDER_DISCOVERED',
      'NEW_FREE_MODEL',
      'FREE_QUOTA_INCREASED',
      'PROVIDER_UNAVAILABLE',
      'PROVIDER_RETIRED',
      'USEFUL_GITHUB_PROJECT',
      'SECURITY_WARNING',
      'LICENSE_CONCERN',
      'LOCAL_MODEL_SUITABLE',
      'PAID_TOOL_MATERIALLY_BETTER',
      'CONFIGURED_PROVIDER_CHANGED',
      'NEW_OPPORTUNITY',
    ] as const;
    for (const kind of kinds) {
      const notification = gate.maybeNotify({ kind, title: 't', body: 'b', relevance: 90 });
      expect(notification?.kind).toBe(kind);
    }
  });

  it('the threshold constant is exported and applied', () => {
    expect(MIN_MEANINGFUL_RELEVANCE).toBe(60);
    expect(
      gate.maybeNotify({ kind: 'PROVIDER_RETIRED', title: 't', body: 'b', relevance: 59 }),
    ).toBeUndefined();
    expect(
      gate.maybeNotify({ kind: 'PROVIDER_RETIRED', title: 't', body: 'b', relevance: 60 })?.kind,
    ).toBe('PROVIDER_RETIRED');
  });
});
