// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Retrieval + Ranking (PHASE 12/26)
//
// Retrieval is BOUNDED: max entries, max evidence text, max query
// scopes, compact structured evidence only. Ranking is deterministic:
//   1. scope relevance (exact user/scope match > GLOBAL),
//   2. capability/task relevance,
//   3. confidence (evidence-based),
//   4. recency (decayed),
//   5. evidence strength (sample count).
//
// Retrieved memory is ADVISORY evidence. It can never bypass runtime
// validation — consumers (planner / adaptive loop / router) validate
// through their own frozen gates, and resolveMemoryConflicts drops
// anything contradicted by current runtime truth.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  MemoryEntry,
  MemoryEvidence,
  MemoryEvidenceBlock,
  MemoryQuery,
} from '../types/execution-memory-types.js';

export const MAX_RETRIEVED = 8;
export const MAX_EVIDENCE_BLOCK_CHARS = 1_500;
export const MAX_EVIDENCE_LINES = 12;
/** Below this composite score an entry's influence has decayed too far
 *  to surface — the record itself is retained. */
export const MIN_RETRIEVAL_SCORE = 0.01;

function scopeWeight(query: MemoryQuery, entry: MemoryEntry): number {
  if (entry.scope === 'GLOBAL') return 0.8;
  if (entry.scope === 'USER') {
    // USER memory is never promoted to global knowledge and never leaks
    // across users: an anonymous query gets nothing.
    if (query.userId === undefined) return 0;
    return entry.userId === query.userId ? 1 : 0;
  }
  if (entry.scope === 'TOOL' && query.tools !== undefined && query.tools.includes(entry.subject))
    return 1;
  if (
    entry.scope === 'CAPABILITY' &&
    query.capabilities !== undefined &&
    query.capabilities.includes(entry.capability as CapabilityType)
  )
    return 1;
  if (
    entry.scope === 'PROVIDER' &&
    query.provider !== undefined &&
    entry.subject.includes(query.provider)
  )
    return 1;
  if (entry.scope === 'MODEL' && query.model !== undefined && entry.subject.includes(query.model))
    return 1;
  if (
    entry.scope === 'PLAN_PATTERN' &&
    query.planPattern !== undefined &&
    entry.subject.includes(query.planPattern)
  )
    return 1;
  if (
    entry.scope === 'GOAL_TYPE' &&
    query.goalType !== undefined &&
    entry.subject === query.goalType
  )
    return 1;
  return 0.5;
}

function relevance(query: MemoryQuery, entry: MemoryEntry): number {
  if (query.capabilities !== undefined && entry.capability !== undefined) {
    if (query.capabilities.includes(entry.capability)) return 1;
  }
  if (query.tools !== undefined && entry.category === 'TOOL_RELIABILITY') {
    if (query.tools.includes(entry.subject)) return 1;
  }
  return 0.5;
}

function evidenceStrength(entry: MemoryEntry): number {
  return Math.min(entry.sampleCount / 6, 1);
}

export function rankEvidence(
  entries: MemoryEntry[],
  query: MemoryQuery,
  nowMs: number,
): MemoryEvidence[] {
  const limit = Math.min(Math.max(query.limit ?? MAX_RETRIEVED, 1), MAX_RETRIEVED);
  const scored: Array<{ entry: MemoryEntry; score: number }> = [];

  for (const raw of entries) {
    // Category filtering is applied at retrieval (e.g. advisory routing
    // evidence returns ROUTING_SIGNAL only).
    if (query.categories !== undefined && !query.categories.includes(raw.category)) continue;
    // Cross-user isolation is enforced at retrieval time: a USER-scoped
    // entry never leaks to another user (scopeWeight returns 0).
    const weight = scopeWeight(query, raw);
    if (weight === 0) continue;
    const ageDays = Math.max(nowMs - new Date(raw.updatedAt).getTime(), 0) / (24 * 60 * 60 * 1000);
    const recency = raw.recency * Math.max(0, Math.min(1, 1 - ageDays / 365));
    const score =
      weight * relevance(query, raw) * raw.confidence.score * recency * evidenceStrength(raw);
    if (score < MIN_RETRIEVAL_SCORE) continue;
    scored.push({ entry: raw, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ entry, score }) => toEvidence(entry, score));
}

export function toEvidence(entry: MemoryEntry, score: number): MemoryEvidence {
  return {
    entryId: entry.entryId,
    category: entry.category,
    scope: entry.scope,
    subject: entry.subject,
    predicate: entry.predicate,
    value: entry.value,
    capability: entry.capability,
    confidenceScore: entry.confidence.score,
    confidenceLevel: entry.confidence.level,
    recency: entry.recency,
    sampleCount: entry.sampleCount,
    successCount: entry.successCount,
    failureCount: entry.failureCount,
    verifiedCount: entry.verifiedCount,
    score,
    advisory: true,
  };
}

/** Compact structured evidence block for model context (never raw entries). */
export function buildEvidenceBlock(
  evidence: MemoryEvidence[],
  maxChars: number = MAX_EVIDENCE_BLOCK_CHARS,
): MemoryEvidenceBlock {
  const lines = evidence.slice(0, MAX_EVIDENCE_LINES).map((e) => {
    const rate = e.sampleCount > 0 ? (e.successCount / e.sampleCount).toFixed(2) : 'n/a';
    return `- [${e.category}/${e.scope}] ${e.subject}: ${rate} (samples=${String(e.sampleCount)}, confidence=${e.confidenceLevel}, recency=${e.recency.toFixed(2)})`;
  });
  let text = lines.join('\n');
  if (text.length > maxChars) {
    text = `${text.slice(0, maxChars)}…`;
  }
  return { evidence: evidence.slice(0, MAX_EVIDENCE_LINES), text, charCount: text.length };
}
