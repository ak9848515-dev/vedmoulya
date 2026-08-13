// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Incident Diagnostics
// EPIC-012 — Production Observability & Control Plane (Phase 12)
//
// When an execution fails, the operator gets a STRUCTURED diagnosis —
// never "Something went wrong.":
//
//   WHAT FAILED / WHEN / WHERE / WHY / WHAT WAS ATTEMPTED / WHAT PROVIDER
//   WAS USED / WHAT RETRIES OCCURRED / WHAT FALLBACK OCCURRED / WHAT
//   EVIDENCE EXISTS / WHAT THE USER SHOULD DO / WHAT AN OPERATOR CAN DO
//
// Everything is derived from the correlated trace spans + events — no
// secrets, no raw prompts, no stack traces.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionTrace } from '@vedmoulya/core';

export interface FailedSpanDiagnostic {
  spanId: string;
  name: string;
  kind: string;
  status: string;
  startedAt: number;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  provider?: string;
}

export interface IncidentDiagnostics {
  traceId: string;
  traceName: string;
  traceStatus: string;
  executionId?: string;
  applicationId?: string;
  userId?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  /** WHAT FAILED — non-OK spans. */
  whatFailed: FailedSpanDiagnostic[];
  /** WHEN. */
  when: string;
  /** WHERE — span names along the failing path. */
  where: string[];
  /** WHY — error codes/messages from the failing spans. */
  why: string[];
  /** WHAT WAS ATTEMPTED — span names + step events. */
  attempted: string[];
  /** WHAT PROVIDER WAS USED. */
  providersUsed: string[];
  /** WHAT RETRIES OCCURRED. */
  retries: number;
  /** WHAT FALLBACK OCCURRED. */
  fallbacks: number;
  /** WHAT EVIDENCE EXISTS. */
  evidence: string[];
  /** WHAT THE USER SHOULD DO (derived, deterministic). */
  userNextSteps: string[];
  /** WHAT AN OPERATOR CAN DO. */
  operatorActions: string[];
}

const FAILED_STATUSES = new Set([
  'ERROR',
  'FAILED',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'PROVIDER_FAILURE',
  'VALIDATION_FAILURE',
  'SECURITY_BLOCK',
]);

/** Build the structured diagnosis for one trace. */
export function buildIncidentDiagnostics(trace: ExecutionTrace): IncidentDiagnostics {
  const whatFailed: FailedSpanDiagnostic[] = [];
  const where = new Set<string>();
  const why = new Set<string>();
  const attempted = new Set<string>();
  const providersUsed = new Set<string>();
  let retries = 0;
  let fallbacks = 0;
  const evidence: string[] = [];

  for (const span of trace.spans) {
    attempted.add(span.name);
    if (span.kind === 'ai') {
      const provider = stringAttr(span.attributes.provider);
      if (provider) providersUsed.add(provider);
      if (span.name === 'ai.retry') retries += 1;
      if (span.name === 'ai.fallback') fallbacks += 1;
    }
    if (span.name === 'ai.evidence') {
      evidence.push(`item_count=${numAttr(span.attributes.item_count)} state=${span.status}`);
    }
    if (FAILED_STATUSES.has(span.status)) {
      whatFailed.push({
        spanId: span.spanId,
        name: span.name,
        kind: span.kind,
        status: span.status,
        startedAt: span.startedAt,
        durationMs: span.durationMs,
        errorCode: span.error?.code,
        errorMessage: span.error?.message,
        provider: stringAttr(span.attributes.provider),
      });
      where.add(span.name);
      if (span.error) {
        why.add(span.error.code ? `${span.error.code}: ${span.error.message}` : span.error.message);
      } else {
        why.add(`${span.name} ended with status ${span.status}`);
      }
    }
  }

  const userNextSteps: string[] = [];
  const operatorActions: string[] = [];
  if (whatFailed.some((f) => f.status === 'SECURITY_BLOCK')) {
    userNextSteps.push(
      'A security gate blocked this execution — review the security findings and resolve critical/high items before retrying.',
    );
    operatorActions.push(
      'Open the application security report and remediate the blocking findings; then use ops.retry (application).',
    );
  }
  if (whatFailed.some((f) => f.status === 'VALIDATION_FAILURE')) {
    userNextSteps.push(
      'Validation failed — check the failed gates (lint/typecheck/tests/build) in the application validation report.',
    );
    operatorActions.push(
      'Use ops.revalidate to re-run validation after a deterministic fix, or ops.retry after the repair loop.',
    );
  }
  if (whatFailed.some((f) => f.status === 'BUDGET_EXCEEDED')) {
    userNextSteps.push(
      'The execution exceeded its bounded budget — reduce scope or raise the budget before retrying.',
    );
    operatorActions.push(
      'Inspect token/cost in the cost ledger; adjust the loop/factory budget override and retry.',
    );
  }
  if (whatFailed.some((f) => f.status === 'PROVIDER_FAILURE' || f.status === 'TIMEOUT')) {
    userNextSteps.push(
      'A provider failed or timed out — the runtime retried/falled back; if it persists, try again later.',
    );
    operatorActions.push(
      'Check provider health (ops.providerHealth); disable an unhealthy provider (ops.disableProvider) so routing avoids it.',
    );
  }
  if (whatFailed.length > 0 && userNextSteps.length === 0) {
    userNextSteps.push(
      'Review the failure details above and retry the execution when the underlying cause is resolved.',
    );
    operatorActions.push(
      'Re-run the failed execution with ops.retry, or re-validate with ops.revalidate / ops.requality.',
    );
  }

  return {
    traceId: trace.traceId,
    traceName: trace.name,
    traceStatus: trace.status,
    executionId: trace.executionId,
    applicationId: trace.applicationId,
    userId: trace.userId,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    durationMs: trace.endedAt !== undefined ? trace.endedAt - trace.startedAt : undefined,
    whatFailed,
    when: new Date(trace.startedAt).toISOString(),
    where: [...where],
    why: [...why],
    attempted: [...attempted],
    providersUsed: [...providersUsed],
    retries,
    fallbacks,
    evidence,
    userNextSteps,
    operatorActions,
  };
}

function stringAttr(value: string | number | boolean | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numAttr(value: string | number | boolean | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
