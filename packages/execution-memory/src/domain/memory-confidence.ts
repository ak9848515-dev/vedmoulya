// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Confidence + Recency + Aggregation
//
// Confidence is EVIDENCE-BASED — the model never chooses it. It is a
// deterministic blend of:
//   - success/failure ratio (rate),
//   - sample count (evidence strength),
//   - recency (decay with age, reinforced by new evidence),
//   - verification strength (only VERIFIED evidence counts fully).
//
// Levels are conservative: INSUFFICIENT < LOW < MEDIUM < HIGH, with
// minimum sample requirements per level. INSUFFICIENT / LOW memory is
// never treated as authoritative.
//
// Recency: bounded exponential decay (half-life in days). Historical
// evidence is never silently deleted — its INFLUENCE decays, the
// record stays.
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionMemoryConfidence,
  ExecutionMemoryConfidenceLevel,
  MemoryCandidate,
  MemoryEntry,
} from '../types/execution-memory-types.js';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_HALF_LIFE_DAYS = 45;

export interface ConfidenceInput {
  sampleCount: number;
  successCount: number;
  verifiedCount: number;
  recency: number;
}

function levelFor(
  score: number,
  sampleCount: number,
  verifiedCount: number,
  verifiedRatio: number,
): ExecutionMemoryConfidenceLevel {
  // A single UNVERIFIED sample is never authoritative.
  if (sampleCount < 1 || (sampleCount === 1 && verifiedCount === 0)) return 'INSUFFICIENT';
  if (score >= 0.75 && sampleCount >= 5 && verifiedRatio >= 0.6) return 'HIGH';
  if (score >= 0.55 && sampleCount >= 2) return 'MEDIUM';
  if (score >= 0.35 && sampleCount >= 1) return 'LOW';
  return 'INSUFFICIENT';
}

/** Evidence-based confidence (deterministic — never model-chosen). */
export function computeConfidence(input: ConfidenceInput): ExecutionMemoryConfidence {
  const { sampleCount, successCount, verifiedCount, recency } = input;
  const rate = sampleCount > 0 ? successCount / sampleCount : 0;
  const verifiedRatio = sampleCount > 0 ? verifiedCount / sampleCount : 0;
  const evidenceStrength = Math.min(sampleCount / 8, 1);
  const score = Math.max(
    0,
    Math.min(1, 0.45 * rate + 0.2 * evidenceStrength + 0.2 * recency + 0.15 * verifiedRatio),
  );
  const level = levelFor(score, sampleCount, verifiedCount, verifiedRatio);
  const factors = [
    `success rate ${rate.toFixed(2)}`,
    `samples ${String(sampleCount)}`,
    `verified ratio ${verifiedRatio.toFixed(2)}`,
    `recency ${recency.toFixed(2)}`,
    `level ${level}`,
  ];
  return { score, level, factors };
}

/** Bounded exponential recency decay (half-life in days). */
export function decayRecency(
  updatedAtMs: number,
  nowMs: number,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
): number {
  const ageDays = Math.max(nowMs - updatedAtMs, 0) / DAY_MS;
  if (ageDays === 0) return 1;
  return Math.max(0, Math.min(1, 0.5 ** (ageDays / halfLifeDays)));
}

/** Absolute expiry from a retention window (undefined = permanent). */
export function expiryFor(retentionDays: number | undefined, nowMs: number): string | undefined {
  if (retentionDays === undefined) return undefined;
  return new Date(nowMs + retentionDays * DAY_MS).toISOString();
}

/** Aggregation key — repeated evidence merges into ONE memory entry. */
export function fingerprintFor(input: {
  category: MemoryCandidate['category'];
  scope: MemoryCandidate['scope'];
  subject: string;
  predicate: string;
  capability?: MemoryCandidate['capability'];
  userId?: string;
}): string {
  return [
    input.category,
    input.scope,
    input.subject,
    input.predicate,
    input.capability ?? '-',
    input.userId ?? '-',
  ].join('|');
}

export interface MergeResult {
  entry: MemoryEntry;
  /** True when this was a NEW entry (not an aggregation). */
  created: boolean;
}

/** Merge a validated candidate into the store's entry (create or aggregate). */
export function mergeCandidate(
  existing: MemoryEntry | undefined,
  candidate: MemoryCandidate,
  nowMs: number,
  nowIso: string,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
  retentionDays?: number,
  sourceType: MemoryEntry['provenance']['sourceType'] = 'execution',
): MergeResult {
  const fingerprint = fingerprintFor(candidate);
  if (existing === undefined) {
    const createdAt = nowIso;
    const recency = 1;
    const confidence = computeConfidence({
      sampleCount: candidate.sampleCount,
      successCount: candidate.successCount,
      verifiedCount: candidate.verifiedCount,
      recency,
    });
    return {
      created: true,
      entry: {
        entryId: `mem-${candidate.candidateId}`,
        fingerprint,
        category: candidate.category,
        scope: candidate.scope,
        subject: candidate.subject,
        predicate: candidate.predicate,
        value:
          candidate.sampleCount > 0
            ? candidate.successCount / candidate.sampleCount
            : candidate.value,
        capability: candidate.capability,
        userId: candidate.userId,
        sampleCount: candidate.sampleCount,
        successCount: candidate.successCount,
        failureCount: candidate.failureCount,
        verifiedCount: candidate.verifiedCount,
        evidence: {
          executionIds: candidate.executionIds,
          evidenceCount: candidate.executionIds.length,
        },
        confidence,
        recency,
        provenance: {
          executionIds: candidate.executionIds,
          sourceType,
          lastExecutionId: candidate.executionIds[candidate.executionIds.length - 1],
        },
        retentionDays,
        createdAt,
        updatedAt: nowIso,
        expiresAt: expiryFor(retentionDays, nowMs),
      },
    };
  }

  // Aggregation: merge counts (never drop historical evidence), decay the
  // old recency, then reinforce to 1 (new evidence refreshes influence).
  const sampleCount = existing.sampleCount + candidate.sampleCount;
  const successCount = existing.successCount + candidate.successCount;
  const failureCount = existing.failureCount + candidate.failureCount;
  const verifiedCount = existing.verifiedCount + candidate.verifiedCount;
  const executionIds = [...existing.evidence.executionIds, ...candidate.executionIds].slice(
    -MAX_ENTRY_EVIDENCE,
  );
  const decayed = decayRecency(new Date(existing.updatedAt).getTime(), nowMs, halfLifeDays);
  const recency = Math.max(decayed, candidate.sampleCount > 0 ? 1 : decayed);
  const confidence = computeConfidence({ sampleCount, successCount, verifiedCount, recency });
  return {
    created: false,
    entry: {
      ...existing,
      value: sampleCount > 0 ? successCount / sampleCount : existing.value,
      sampleCount,
      successCount,
      failureCount,
      verifiedCount,
      evidence: { executionIds, evidenceCount: executionIds.length },
      confidence,
      recency,
      provenance: {
        executionIds,
        sourceType: 'aggregation',
        lastExecutionId:
          candidate.executionIds[candidate.executionIds.length - 1] ??
          existing.provenance.lastExecutionId,
      },
      updatedAt: nowIso,
      expiresAt: expiryFor(existing.retentionDays ?? retentionDays, nowMs),
    },
  };
}

export const MAX_ENTRY_EVIDENCE = 200;

/** Passive decay applied at retrieval time (influence fades, record stays). */
export function applyPassiveDecay(
  entry: MemoryEntry,
  nowMs: number,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
): MemoryEntry {
  const recency = decayRecency(new Date(entry.updatedAt).getTime(), nowMs, halfLifeDays);
  if (recency >= entry.recency) return entry;
  const confidence = computeConfidence({
    sampleCount: entry.sampleCount,
    successCount: entry.successCount,
    verifiedCount: entry.verifiedCount,
    recency,
  });
  return { ...entry, recency, confidence };
}
