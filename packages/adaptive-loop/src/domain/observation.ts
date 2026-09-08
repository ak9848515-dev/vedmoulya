// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Observation Normalization
//
// Every action result (AI result, tool result, command result,
// verification result, failure, timeout, permission denial, system
// state) is normalized into a safe, bounded AgentObservation — the
// frozen observation type is reused, never redefined.
//
// Safety invariants:
//   - NEVER expose credentials / API keys / access tokens / JWTs /
//     secrets / unnecessary raw provider errors.
//   - Bound every field (sanitizeTraceText + safeSlice, the frozen
//     sanitizers — no new sanitization is invented).
//   - Classify the status deterministically (succeeded / failed /
//     denied / blocked / unknown).
//   - Keep only the information the NEXT decision needs.
// ──────────────────────────────────────────────────────────────────

import { sanitizeTraceText, safeSlice } from '@vedmoulya/agent-execution';
import type {
  AgentObservation,
  AgentObservationStatus,
  AgentArtifactRef,
} from '@vedmoulya/agent-execution';
import type { CapabilityType } from '@vedmoulya/ai';

export const OBSERVATION_MAX_LENGTH = 1_500;
export const MAX_ARTIFACTS = 20;
export const MAX_CONTEXT_OBSERVATIONS = 12;

export interface NormalizeObservationInput {
  runId: string;
  actionId: string;
  stepId: string;
  attempt: number;
  /** Raw success/failure signal (normalized deterministically). */
  status?: AgentObservationStatus | 'success' | 'abstained';
  /** Sanitized summary of the result (may be raw provider text). */
  resultSummary?: string;
  /** Raw error message (sanitized + bounded before storage). */
  error?: string;
  /** Artifacts produced (bounded). */
  artifacts?: AgentArtifactRef[];
  provider?: string;
  model?: string;
  toolName?: string;
  capability?: CapabilityType;
  /** True when the frozen ToolRuntime denied the call. */
  denied?: boolean;
  observedAt: string;
  /** Freeform structured result — flattened into the summary safely. */
  structured?: Record<string, unknown>;
}

/** Deterministic status classification — never inferred from text. */
function classifyStatus(input: NormalizeObservationInput): AgentObservationStatus {
  if (input.denied === true) return 'denied';
  switch (input.status) {
    case 'succeeded':
    case 'success':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'denied':
      return 'denied';
    case 'blocked':
      return 'blocked';
    case 'abstained':
      return 'unknown';
    default:
      return 'unknown';
  }
}

/** Flatten a structured result into a bounded, sanitized summary. */
function flattenStructured(structured: Record<string, unknown> | undefined): string {
  if (structured === undefined) return '';
  try {
    return safeSlice(JSON.stringify(structured), OBSERVATION_MAX_LENGTH);
  } catch {
    return '[structured result could not be serialized]';
  }
}

/**
 * Normalize one raw action result into a safe Observation. Every text
 * field passes through the frozen sanitizer (credentials/keys/JWTs are
 * redacted) and every field is length-bounded.
 */
export function normalizeObservation(input: NormalizeObservationInput): AgentObservation {
  const summary = flattenStructured(input.structured);
  const resultSummary = sanitizeTraceText(
    [input.resultSummary, summary]
      .filter((part) => part !== undefined && part.length > 0)
      .join('\n'),
    { maxLength: OBSERVATION_MAX_LENGTH },
  );
  const error = input.error ? sanitizeTraceText(input.error, { maxLength: 400 }) : undefined;

  return {
    observationId: `obs-${input.actionId}-${input.attempt}`,
    actionId: input.actionId,
    stepId: input.stepId,
    runId: input.runId,
    attempt: input.attempt,
    status: classifyStatus(input),
    resultSummary,
    error,
    artifacts: (input.artifacts ?? []).slice(0, MAX_ARTIFACTS),
    provider: input.provider,
    model: input.model,
    toolName: input.toolName,
    capability: input.capability,
    observedAt: input.observedAt,
  };
}

/**
 * Bounded decision context: keep the most recent observations as full
 * summaries and compress the older ones into one-line digests. Never
 * grows unbounded — the model never receives the whole history.
 */
export function buildBoundedObservationContext(
  observations: AgentObservation[],
  maxRecent: number = MAX_CONTEXT_OBSERVATIONS,
): Array<{
  observationId: string;
  actionId: string;
  stepId: string;
  status: string;
  resultSummary: string;
}> {
  const recent = observations.slice(-maxRecent);
  const context = recent.map((o) => ({
    observationId: o.observationId,
    actionId: o.actionId,
    stepId: o.stepId,
    status: o.status,
    resultSummary: o.resultSummary,
  }));
  if (observations.length > maxRecent) {
    const dropped = observations.length - maxRecent;
    context.unshift({
      observationId: 'summary',
      actionId: 'earlier',
      stepId: 'earlier',
      status: 'succeeded',
      resultSummary: `[${String(dropped)} earlier observation(s) omitted — bounded decision context]`,
    });
  }
  return context;
}
