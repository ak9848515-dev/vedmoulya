// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// LifecycleLedger — EPIC-015
//
// Intelligence memory: DISCOVERED → VERIFIED → SECURITY_REVIEWED →
// RECOMMENDED → USER_APPROVED → CONFIGURED → VALIDATED → ACTIVE →
// STALE → DEPRECATED → BLOCKED. Deprecated models/providers/repos are
// NEVER silently deleted — every transition keeps provenance (when +
// why + evidence). Staleness is explicit.
// ──────────────────────────────────────────────────────────────────

import type { IntelligenceLifecycleState, LifecycleRecord } from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

export class LifecycleLedger {
  constructor(private readonly clock: ClockPort) {}

  create(
    userId: string,
    resourceId: string,
    resourceKind: LifecycleRecord['resourceKind'],
    state: IntelligenceLifecycleState,
    evidence: string[],
  ): LifecycleRecord {
    const now = this.clock.now();
    return {
      resourceId,
      resourceKind,
      state,
      evidence,
      history: [{ state, at: now, reason: 'Initial lifecycle state.' }],
      verifiedAt: state === 'VERIFIED' ? now : undefined,
      updatedAt: now,
    };
  }

  transition(
    record: LifecycleRecord,
    to: IntelligenceLifecycleState,
    reason: string,
    evidence?: string[],
  ): LifecycleRecord {
    const now = this.clock.now();
    const state: LifecycleRecord = {
      ...record,
      state: to,
      evidence: evidence ?? record.evidence,
      history: [...record.history, { state: to, at: now, reason }],
      verifiedAt: to === 'VERIFIED' || to === 'VALIDATED' ? now : record.verifiedAt,
      updatedAt: now,
    };
    return state;
  }

  /** Mark stale when verification evidence has aged — never assume freshness. */
  markStale(record: LifecycleRecord, reason: string): LifecycleRecord {
    return this.transition(record, 'STALE', reason);
  }

  block(record: LifecycleRecord, reason: string, evidence: string[]): LifecycleRecord {
    return this.transition(record, 'BLOCKED', reason, evidence);
  }

  /** Deprecated resources are preserved with provenance — never deleted. */
  deprecate(record: LifecycleRecord, reason: string): LifecycleRecord {
    return this.transition(record, 'DEPRECATED', reason);
  }

  /** A resource whose verification evidence is older than maxAgeMs is stale. */
  stalenessOf(record: LifecycleRecord, maxAgeMs: number): 'FRESH' | 'STALE' | 'UNVERIFIED' {
    if (!record.verifiedAt) return 'UNVERIFIED';
    const age = new Date(this.clock.now()).getTime() - new Date(record.verifiedAt).getTime();
    return age > maxAgeMs ? 'STALE' : 'FRESH';
  }
}
