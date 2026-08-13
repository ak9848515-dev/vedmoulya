import { describe, it, expect } from 'vitest';
import { LifecycleLedger } from '../domain/LifecycleLedger.js';
import { FIXED_NOW, STALE_NOW } from './fixtures.js';

function makeLedger(now: string) {
  return new LifecycleLedger({ now: () => now });
}

describe('LifecycleLedger — intelligence memory', () => {
  it('tracks DISCOVERED → VERIFIED → RECOMMENDED → USER_APPROVED → CONFIGURED with provenance', () => {
    const ledger = makeLedger(FIXED_NOW);
    let record = ledger.create('user-1', 'provider:x', 'provider', 'DISCOVERED', [
      'discovered by catalog source',
    ]);
    record = ledger.transition(record, 'VERIFIED', 'Official catalogue confirms the model.');
    record = ledger.transition(record, 'RECOMMENDED', 'Quality-first selection for video tasks.');
    record = ledger.transition(record, 'USER_APPROVED', 'User explicitly approved activation.');
    record = ledger.transition(record, 'CONFIGURED', 'Provider configuration completed.');

    expect(record.state).toBe('CONFIGURED');
    expect(record.history.map((h) => h.state)).toEqual([
      'DISCOVERED',
      'VERIFIED',
      'RECOMMENDED',
      'USER_APPROVED',
      'CONFIGURED',
    ]);
    expect(record.history.every((h) => h.at === FIXED_NOW && h.reason.length > 0)).toBe(true);
    expect(record.verifiedAt).toBe(FIXED_NOW);
  });

  it('never silently deletes deprecated resources — history is preserved', () => {
    const ledger = makeLedger(FIXED_NOW);
    let record = ledger.create('user-1', 'provider:old', 'provider', 'ACTIVE', ['in use']);
    record = ledger.deprecate(record, 'Provider retired the model line.');
    expect(record.state).toBe('DEPRECATED');
    expect(record.history).toHaveLength(2);
    // The record still exists with full provenance — nothing was deleted.
    expect(record.resourceId).toBe('provider:old');
    expect(record.history[1]?.reason).toBe('Provider retired the model line.');
  });

  it('block attaches evidence and stops the lifecycle', () => {
    const ledger = makeLedger(FIXED_NOW);
    let record = ledger.create('user-1', 'repo:evil', 'github', 'DISCOVERED', []);
    record = ledger.block(record, 'Security gate found credential collection.', [
      'credential_collection',
    ]);
    expect(record.state).toBe('BLOCKED');
    expect(record.evidence).toContain('credential_collection');
  });

  it('stalenessOf: FRESH when verified recently, STALE when aged, UNVERIFIED when never verified', () => {
    const freshLedger = makeLedger(FIXED_NOW);
    const fresh = freshLedger.create('user-1', 'provider:fresh', 'provider', 'VERIFIED', []);
    expect(freshLedger.stalenessOf(fresh, 30 * 24 * 60 * 60 * 1000)).toBe('FRESH');

    const agedLedger = makeLedger(STALE_NOW); // 2 months later
    expect(agedLedger.stalenessOf(fresh, 30 * 24 * 60 * 60 * 1000)).toBe('STALE');

    const never = agedLedger.create('user-1', 'provider:never', 'provider', 'DISCOVERED', []);
    expect(agedLedger.stalenessOf(never, 30 * 24 * 60 * 60 * 1000)).toBe('UNVERIFIED');
  });

  it('markStale transitions explicitly with a reason', () => {
    const ledger = makeLedger(STALE_NOW);
    const record = ledger.markStale(
      ledger.create('user-1', 'provider:x', 'provider', 'ACTIVE', []),
      'Verification evidence has aged.',
    );
    expect(record.state).toBe('STALE');
  });

  it('VALIDATED refreshes the verification timestamp', () => {
    const ledger = makeLedger(FIXED_NOW);
    let record = ledger.create('user-1', 'provider:x', 'provider', 'CONFIGURED', []);
    record = ledger.transition(record, 'VALIDATED', 'Live validation passed.');
    expect(record.verifiedAt).toBe(FIXED_NOW);
  });
});
