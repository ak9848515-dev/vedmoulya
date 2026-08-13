// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · AdaptiveScoreLedger
// EPIC-020 §4 — Adaptive provider allocation evidence.
//
// Internal evidence-backed scores, NOT arbitrary permanent rankings:
//   TASK TYPE (capability) × PROVIDER → recency-weighted quality.
// Recent evidence matters (exponential decay). EXPLICIT user feedback
// outranks INFERRED observation — an inference is never silently
// promoted to a permanent preference. Scores are only ever advisory
// input to role assignment (quality-first selection keeps authority).
//
// SPRINT-022: the scoring math lives in ledger-math.ts — this in-memory
// ledger and the Postgres-persisted PostgresAdaptiveScoreLedger share
// ONE pure implementation (identical behavior, different storage).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { BrainExperiencePort } from '../contracts/brain-ports.js';
import type { ProviderPerformanceScore } from '../types/continuous-types.js';
import {
  computeLedgerEntry,
  ledgerEntryToScore,
  sortScoresByQuality,
  LEDGER_DEFAULT_HALF_LIFE_MS,
} from './ledger-math.js';

export interface AdaptiveScoreLedgerOptions {
  /** Half-life of a sample's influence (recency matters). */
  halfLifeMs?: number;
}

export class AdaptiveScoreLedger implements BrainExperiencePort {
  private readonly entries = new Map<string, import('./ledger-math.js').LedgerEntry>();
  private readonly now: () => string;
  private readonly halfLifeMs: number;

  constructor(now: () => string, options: AdaptiveScoreLedgerOptions = {}) {
    this.now = now;
    this.halfLifeMs = options.halfLifeMs ?? LEDGER_DEFAULT_HALF_LIFE_MS;
  }

  recordPerformance(input: {
    providerId: string;
    capability: CapabilityId;
    succeeded: boolean;
    explicit: boolean;
    quality?: number;
    at: string;
  }): Promise<void> {
    const key = `${input.providerId}|${input.capability}`;
    const existing = this.entries.get(key);
    const entry = computeLedgerEntry(existing, input, this.now, this.halfLifeMs);
    this.entries.set(key, entry);
    return Promise.resolve();
  }

  scoresFor(capability: CapabilityId): ProviderPerformanceScore[] {
    return sortScoresByQuality(
      [...this.entries.values()].filter((e) => e.capability === capability).map(ledgerEntryToScore),
    );
  }

  /** Best evidenced provider for a capability, excluding failed candidates. */
  bestFor(
    capability: CapabilityId,
    excludeProviderIds: string[] = [],
  ): ProviderPerformanceScore | undefined {
    return this.scoresFor(capability).find((s) => !excludeProviderIds.includes(s.providerId));
  }
}
