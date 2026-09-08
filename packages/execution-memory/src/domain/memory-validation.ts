// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Candidate Validation (PHASE 10)
//
// Before persistence every candidate is validated deterministically.
// Rejected: missing scope, unknown category, malformed evidence,
// impossible statistics (negative counts, success > sample), fabricated
// provider/model/tool (must appear in the provenance records),
// secret-containing content, unbounded text, model-supplied confidence
// (the candidate carries no confidence field at all — confidence is
// ALWAYS computed from evidence), unsupported claims (no provenance).
// ──────────────────────────────────────────────────────────────────

import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';
import { CAPABILITY_TYPES } from '@vedmoulya/ai';
import type { ExecutionRecord, MemoryCandidate } from '../types/execution-memory-types.js';
import { MEMORY_CATEGORIES, MEMORY_SCOPES } from '../types/execution-memory-types.js';

export const MAX_SUBJECT_LENGTH = 120;
export const MAX_PREDICATE_LENGTH = 80;
export const MAX_CANDIDATE_EVIDENCE = 500;

export interface CandidateValidationContext {
  records: ExecutionRecord[];
  /** Authoritative registry exposure, when available (fabricated tools). */
  knownTools?: string[];
  /** Authoritative provider/model surface, when available. */
  knownProviders?: string[];
}

export function validateMemoryCandidate(
  candidate: MemoryCandidate,
  ctx: CandidateValidationContext,
): string[] {
  const reasons: string[] = [];

  // Closed category / scope sets.
  if (!(MEMORY_CATEGORIES as readonly string[]).includes(candidate.category)) {
    reasons.push(`unknown memory category "${candidate.category}"`);
  }
  if (!(MEMORY_SCOPES as readonly string[]).includes(candidate.scope)) {
    reasons.push(`unknown memory scope "${candidate.scope}"`);
  }
  if (candidate.scope === 'USER' && candidate.userId === undefined) {
    reasons.push('USER scope requires a userId');
  }
  if (candidate.scope !== 'USER' && candidate.userId !== undefined) {
    reasons.push('userId is only allowed on USER-scoped memory');
  }

  // Impossible statistics.
  if (candidate.sampleCount < 0 || candidate.successCount < 0 || candidate.failureCount < 0) {
    reasons.push('statistics must be non-negative');
  }
  if (
    candidate.successCount > candidate.sampleCount ||
    candidate.failureCount > candidate.sampleCount
  ) {
    reasons.push('success/failure counts cannot exceed the sample count');
  }
  if (candidate.successCount + candidate.failureCount > candidate.sampleCount) {
    reasons.push('success + failure counts cannot exceed the sample count');
  }
  if (candidate.verifiedCount < 0 || candidate.verifiedCount > candidate.sampleCount) {
    reasons.push('verified count must be within [0, sampleCount]');
  }
  if (!Number.isFinite(candidate.value) || candidate.value < 0 || candidate.value > 1) {
    reasons.push('value must be a finite rate in [0, 1]');
  }

  // Capability membership (frozen taxonomy).
  if (
    candidate.capability !== undefined &&
    !(CAPABILITY_TYPES as readonly string[]).includes(candidate.capability)
  ) {
    reasons.push(`unknown capability "${candidate.capability}" — not in the frozen taxonomy`);
  }

  // Bounded text.
  if (candidate.subject.length === 0 || candidate.subject.length > MAX_SUBJECT_LENGTH) {
    reasons.push(`subject must be 1..${String(MAX_SUBJECT_LENGTH)} chars`);
  }
  if (candidate.predicate.length === 0 || candidate.predicate.length > MAX_PREDICATE_LENGTH) {
    reasons.push(`predicate must be 1..${String(MAX_PREDICATE_LENGTH)} chars`);
  }

  // Provenance — every candidate must trace to actual execution evidence.
  if (candidate.executionIds.length === 0) {
    reasons.push('candidate has no provenance (no execution evidence)');
  }
  if (candidate.executionIds.length > MAX_CANDIDATE_EVIDENCE) {
    reasons.push(`provenance exceeds ${String(MAX_CANDIDATE_EVIDENCE)} execution ids`);
  }
  if (candidate.signalKinds.length === 0) {
    reasons.push('candidate has no producing signal kinds');
  }

  // Fabricated entities — must appear in the actual execution records.
  const recordIds = new Set(ctx.records.map((r) => r.executionId));
  for (const id of candidate.executionIds) {
    if (!recordIds.has(id)) {
      reasons.push(`execution id "${id}" is not part of the supplied evidence`);
    }
  }
  const provenance = ctx.records.filter((r) => candidate.executionIds.includes(r.executionId));

  if (candidate.category === 'TOOL_RELIABILITY') {
    const toolSeen = provenance.some((r) => r.tool === candidate.subject);
    if (!toolSeen) {
      reasons.push(
        `fabricated tool "${candidate.subject}" — not observed in the execution evidence`,
      );
    }
    if (ctx.knownTools !== undefined && !ctx.knownTools.includes(candidate.subject)) {
      reasons.push(`tool "${candidate.subject}" is not exposed by the authoritative registry`);
    }
  }
  if (candidate.category === 'ROUTING_SIGNAL') {
    const seen = provenance.some((r) => {
      if (r.provider !== undefined && candidate.subject.includes(r.provider)) return true;
      if (r.model !== undefined && candidate.subject.includes(r.model)) return true;
      return false;
    });
    if (!seen) {
      reasons.push(
        `fabricated provider/model "${candidate.subject}" — not observed in the execution evidence`,
      );
    }
    if (ctx.knownProviders !== undefined) {
      // Only the PROVIDER entity is checked against the known routing
      // surface — a model name is validated by the execution provenance.
      const providers = candidate.subject.match(/provider:([^/]+)/g) ?? [];
      const names = providers.map((e) => e.replace(/^provider:/, ''));
      if (names.some((name) => !(ctx.knownProviders as string[]).includes(name))) {
        reasons.push(`provider "${names.join(', ')}" is not part of the known routing surface`);
      }
    }
  }

  // Secret-containing content — the frozen sanitizer must not change it
  // (a changed string means something looked like a credential).
  const subjectSanitized = sanitizeTraceText(candidate.subject, { maxLength: MAX_SUBJECT_LENGTH });
  const predicateSanitized = sanitizeTraceText(candidate.predicate, {
    maxLength: MAX_PREDICATE_LENGTH,
  });
  if (subjectSanitized !== candidate.subject || predicateSanitized !== candidate.predicate) {
    reasons.push('candidate subject/predicate contains secret-like content');
  }

  return reasons;
}

export interface ValidatedCandidate {
  candidate: MemoryCandidate;
  reasons: string[];
}

export function validateCandidates(
  candidates: MemoryCandidate[],
  ctx: CandidateValidationContext,
): { accepted: MemoryCandidate[]; rejected: ValidatedCandidate[] } {
  const accepted: MemoryCandidate[] = [];
  const rejected: ValidatedCandidate[] = [];
  for (const candidate of candidates) {
    const reasons = validateMemoryCandidate(candidate, ctx);
    if (reasons.length === 0) accepted.push(candidate);
    else rejected.push({ candidate, reasons });
  }
  return { accepted, rejected };
}

export function isKnownCapability(value: unknown): value is CapabilityType {
  return typeof value === 'string' && (CAPABILITY_TYPES as readonly string[]).includes(value);
}
