// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · ledger-math
// SPRINT-022 — Persistent Intelligence Foundation
//
// Pure recency-weighted scoring math extracted from AdaptiveScoreLedger
// (EPIC-020 §4) so the in-memory ledger and the Postgres-persisted
// ledger share EXACTLY ONE implementation — behavior is identical, only
// the storage backend differs. Recent evidence matters (exponential
// decay); EXPLICIT user feedback outranks INFERRED observation; scores
// are advisory input to role assignment (quality-first keeps authority).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { ProviderPerformanceScore } from '../types/continuous-types.js';

/** One recency-weighted evidence aggregation for (provider × capability). */
export interface LedgerEntry {
  providerId: string;
  capability: CapabilityId;
  sum: number;
  weight: number;
  sampleCount: number;
  source: 'EXPLICIT' | 'INFERRED';
  updatedAt: string;
}

/** One performance sample fed to the ledger. */
export interface LedgerSample {
  providerId: string;
  capability: CapabilityId;
  succeeded: boolean;
  explicit: boolean;
  quality?: number;
  at: string;
}

/** Default half-life of a sample's influence (30 days — matches the ledger). */
export const LEDGER_DEFAULT_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Combine one sample with the prior entry (decay + weighted mean update).
 * Pure — no storage, no clock side effects beyond the injected `now`.
 */
export function computeLedgerEntry(
  existing: LedgerEntry | undefined,
  input: LedgerSample,
  now: () => string,
  halfLifeMs: number,
): LedgerEntry {
  const atMs = Date.parse(input.at) || Date.now();
  const elapsed = existing ? Math.max(0, atMs - Date.parse(existing.updatedAt)) : 0;
  const decay = Math.pow(0.5, elapsed / halfLifeMs);

  // Quality signal: success carries measured/provider quality (or a bounded
  // default when evidence exists); failure is a zero. Explicit user
  // acceptance is weighted as strong positive evidence.
  const sampleQuality = input.succeeded
    ? input.explicit
      ? 0.98
      : Math.min(1, Math.max(0, input.quality ?? 0.85))
    : 0;

  const sum = (existing?.sum ?? 0) * decay + sampleQuality;
  const weight = (existing?.weight ?? 0) * decay + 1;
  const sampleCount = (existing?.sampleCount ?? 0) + 1;
  const source: 'EXPLICIT' | 'INFERRED' = input.explicit ? 'EXPLICIT' : 'INFERRED';

  return {
    providerId: input.providerId,
    capability: input.capability,
    sum,
    weight,
    sampleCount,
    source,
    updatedAt: input.at || now(),
  };
}

/** Project an entry into the public advisory score shape. */
export function ledgerEntryToScore(entry: LedgerEntry): ProviderPerformanceScore {
  return {
    providerId: entry.providerId,
    capability: entry.capability,
    qualityScore: entry.weight > 0 ? Math.min(1, Math.max(0, entry.sum / entry.weight)) : 0,
    sampleCount: entry.sampleCount,
    source: entry.source,
    updatedAt: entry.updatedAt,
  };
}

/** Deterministic quality-first ordering (ties: providerId). */
export function sortScoresByQuality(
  scores: ProviderPerformanceScore[],
): ProviderPerformanceScore[] {
  return [...scores].sort(
    (a, b) => b.qualityScore - a.qualityScore || a.providerId.localeCompare(b.providerId),
  );
}
