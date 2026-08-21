import { describe, expect, it } from 'vitest';
import { ProviderHealthLedger } from '../domain/ProviderHealthLedger.js';
import type { HealthObservation } from '../types/fabric-types.js';

const at = '2026-08-14T00:00:00.000Z';

function success(providerId: string, latencyMs?: number): HealthObservation {
  return { providerId, kind: 'success', latencyMs, at };
}
function failure(providerId: string, errorCode?: string): HealthObservation {
  return { providerId, kind: 'failure', errorCode, at };
}
function timeout(providerId: string): HealthObservation {
  return { providerId, kind: 'timeout', at };
}

describe('ProviderHealthLedger', () => {
  it('reports UNKNOWN until a real observation exists (never fabricated)', () => {
    const ledger = new ProviderHealthLedger();
    const health = ledger.health('openai');
    expect(health.state).toBe('UNKNOWN');
    expect(health.observedCalls).toBe(0);
    expect(health.recentSuccessRate).toBe(0);
    expect(health.evidence[0]).toContain('UNKNOWN');
    expect(health.lastObservedAt).toBeUndefined();
  });

  it('derives HEALTHY from a high success rate with average latency', () => {
    const ledger = new ProviderHealthLedger();
    for (let i = 0; i < 10; i++) ledger.observe(success('openai', 120));
    ledger.observe(failure('openai'));
    const health = ledger.health('openai');
    expect(health.state).toBe('HEALTHY');
    expect(health.observedCalls).toBe(11);
    expect(health.recentSuccessRate).toBeCloseTo(10 / 11, 5);
    expect(health.avgLatencyMs).toBe(120);
    expect(health.lastObservedAt).toBe(at);
  });

  it('derives DEGRADED from a middling success rate', () => {
    const ledger = new ProviderHealthLedger();
    for (let i = 0; i < 7; i++) ledger.observe(success('deepseek'));
    for (let i = 0; i < 3; i++) ledger.observe(failure('deepseek'));
    const health = ledger.health('deepseek');
    expect(health.state).toBe('DEGRADED');
    expect(health.evidence.join(' ')).toContain('between 50% and 90%');
  });

  it('derives UNAVAILABLE from a low success rate or quota exhaustion', () => {
    const low = new ProviderHealthLedger();
    for (let i = 0; i < 3; i++) low.observe(success('a'));
    for (let i = 0; i < 4; i++) low.observe(failure('a'));
    expect(low.health('a').state).toBe('UNAVAILABLE');

    const quota = new ProviderHealthLedger();
    quota.observe({ providerId: 'b', kind: 'quota_exhausted', at });
    expect(quota.health('b').state).toBe('UNAVAILABLE');
    expect(quota.health('b').evidence.join(' ')).toContain('quota');
  });

  it('derives MISCONFIGURED from a config error regardless of other observations', () => {
    const ledger = new ProviderHealthLedger();
    ledger.observe(success('c'));
    ledger.observe({ providerId: 'c', kind: 'config_error', errorCode: 'INVALID_API_KEY', at });
    expect(ledger.health('c').state).toBe('MISCONFIGURED');
  });

  it('stays bounded — observations beyond the cap are dropped (oldest first)', () => {
    const ledger = new ProviderHealthLedger({ maxObservationsPerProvider: 5 });
    for (let i = 0; i < 10; i++) ledger.observe(success('openai'));
    expect(ledger.health('openai').observedCalls).toBe(5);
  });

  it('lists provider ids and returns all snapshots deterministically', () => {
    const ledger = new ProviderHealthLedger();
    ledger.observe(success('openai'));
    ledger.observe(failure('deepseek'));
    expect(ledger.listProviderIds().sort()).toEqual(['deepseek', 'openai']);
    const all = ledger.all();
    expect(all.length).toBe(2);
    expect(all.map((h) => h.providerId).sort()).toEqual(['deepseek', 'openai']);
  });
});
