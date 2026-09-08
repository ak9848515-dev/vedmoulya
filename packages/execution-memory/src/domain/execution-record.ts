// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Execution Record Extraction (PHASE 3)
//
// A sanitized ExecutionRecord is derived from the frozen foundations'
// own data: the AgentExecutionRun + its sanitized execution trace
// (AgentExecutionTraceRecord). Nothing is invented: capability, tool,
// provider/model, outcomes, verification verdicts and usage all come
// from the frozen run/trace fields.
//
// Safety invariants:
//   - Never stores API keys / passwords / OAuth tokens / JWTs /
//     credentials / secrets (frozen sanitizeTraceText applied).
//   - Never persists raw prompts or complete model outputs — only the
//     bounded, sanitized information necessary for learning.
//   - Verification verdicts are copied VERBATIM from frozen evidence
//     (VERIFIED/FAILED/UNKNOWN are never inferred).
// ──────────────────────────────────────────────────────────────────

import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import type { AgentExecutionTraceRecord, VerificationVerdict } from '@vedmoulya/agent-execution';
import type { ExecutionRecord, ExecutionSource } from '../types/execution-memory-types.js';

export const MAX_GOAL_TEXT_LENGTH = 300;
export const MAX_ERROR_LENGTH = 300;
export const MAX_RECORDS = 200;

function bounded(text: string | undefined, max: number): string | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  return sanitizeTraceText(trimmed, { maxLength: max });
}

/** Verification verdict for a step, from the sanitized trace (verbatim). */
function verdictForStep(
  traces: AgentExecutionTraceRecord[],
  stepId: string,
  attempt?: number,
): VerificationVerdict | undefined {
  const candidates = traces.filter(
    (t) => t.phase === 'verification' && t.stepId === stepId && t.verdict !== undefined,
  );
  if (candidates.length === 0) return undefined;
  const exact = candidates.find((t) => t.attempt === attempt);
  const chosen = exact ?? candidates.at(-1);
  return chosen?.verdict;
}

/** Recovery strategy for a step, from the sanitized trace (last one). */
function recoveryForStep(
  traces: AgentExecutionTraceRecord[],
  stepId: string,
): AgentExecutionTraceRecord['recovery'] {
  const candidates = traces.filter((t) => t.phase === 'recovery' && t.stepId === stepId);
  const last = candidates[candidates.length - 1];
  return last?.recovery;
}

/** Sanitized, bounded, complete execution records from a frozen run. */
export function extractExecutionRecords(source: ExecutionSource): ExecutionRecord[] {
  const { run, traces = [], replanCount = 0 } = source;
  const observedAt = run.finishedAt ?? run.updatedAt;
  const userId = run.userId;

  // 1. Run-level record — the historical evidence of the whole execution.
  const verifiedEvidenceCount = traces.filter((t) => t.verdict === 'VERIFIED').length;
  const runRecord: ExecutionRecord = {
    executionId: `ex-${run.runId}`,
    runId: run.runId,
    userId,
    goalId: run.goalId,
    planId: run.planId,
    fallbackUsed: traces.some(
      (t) => t.kind === 'ai' && t.status === 'succeeded' && t.latencyMs > 0,
    ),
    attempts: run.usage.attempts,
    revisions: run.usage.revisions,
    replanCount,
    tokensUsed: run.usage.tokensUsed,
    costUsd: run.usage.costUsd,
    latencyMs: run.usage.latencyMs,
    finalOutcome: run.outcome,
    verifiedEvidenceCount,
    error: bounded(run.error, MAX_ERROR_LENGTH),
    goalText:
      bounded(run.goal, MAX_GOAL_TEXT_LENGTH) ?? bounded(run.objective, MAX_GOAL_TEXT_LENGTH) ?? '',
    observedAt,
  };

  // 2. Per-action records from the sanitized trace.
  const actionRecords: ExecutionRecord[] = [];
  for (const trace of traces) {
    if (trace.phase !== 'action') continue;
    const recovery = recoveryForStep(traces, trace.stepId);
    const actionId = trace.actionId !== undefined ? trace.actionId : trace.stepId;
    actionRecords.push({
      executionId: `ex-${run.runId}-${actionId}-${String(trace.attempt ?? 1)}`,
      runId: run.runId,
      userId,
      goalId: run.goalId,
      planId: run.planId,
      stepId: trace.stepId,
      actionId: trace.actionId,
      capability: trace.capability,
      tool: trace.toolName,
      provider: trace.provider,
      model: trace.model,
      actionKind: trace.kind,
      actionStatus: trace.status as ExecutionRecord['actionStatus'],
      verificationVerdict: verdictForStep(traces, trace.stepId, trace.attempt),
      recoveryStrategy: recovery,
      fallbackUsed: trace.attempt !== undefined && trace.attempt > 1,
      attempts: run.usage.attempts,
      revisions: trace.revision ?? 0,
      replanCount,
      tokensUsed: trace.tokensUsed,
      costUsd: trace.costUsd,
      latencyMs: trace.latencyMs,
      verifiedEvidenceCount: trace.verdict === 'VERIFIED' ? 1 : 0,
      error: bounded(trace.message, MAX_ERROR_LENGTH),
      goalText: runRecord.goalText,
      observedAt: trace.endedAt ?? observedAt,
    });
  }

  return [runRecord, ...actionRecords].slice(0, MAX_RECORDS);
}
