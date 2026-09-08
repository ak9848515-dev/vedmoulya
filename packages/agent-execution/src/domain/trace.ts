// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Trace Builder
//
// Flattens a run into correlated, sanitized trace records:
//   goalId → planId → stepId → actionId (+ attempt, verification,
//   recovery, outcome). Traces are built ONLY from recorded fields —
//   raw prompts, tool arguments and credentials never enter the trace.
// ──────────────────────────────────────────────────────────────────

import type {
  AgentActionRecord,
  AgentExecutionRun,
  AgentExecutionTraceRecord,
  AgentObservation,
} from '../types/agent-execution-types.js';
import { sanitizeTraceText } from './sanitize.js';

/** Build the flattened, correlated, sanitized trace for a run. */
export function buildExecutionTrace(run: AgentExecutionRun): AgentExecutionTraceRecord[] {
  const records: AgentExecutionTraceRecord[] = [];

  for (const stepResult of run.stepResults) {
    // Action + observation records (chronological).
    for (const action of stepResult.actions) {
      records.push(actionTrace(run, stepResult.stepId, action));
      const observation = stepResult.observations.find(
        (o) => o.observationId === action.observationId,
      );
      if (observation) {
        records.push(observationTrace(run, stepResult.stepId, observation));
      }
    }

    // Verification record.
    if (stepResult.verification) {
      records.push({
        runId: run.runId,
        goalId: run.goalId,
        planId: run.planId,
        stepId: stepResult.stepId,
        phase: 'verification',
        attempt: stepResult.attempts,
        verdict: stepResult.verification.verdict,
        status: stepResult.verification.verdict,
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
        message: sanitizeTraceText(stepResult.verification.reasons.join('; ')),
        endedAt: stepResult.endedAt,
      });
    }

    // Recovery records.
    for (const recovery of stepResult.recoveries) {
      records.push({
        runId: run.runId,
        goalId: run.goalId,
        planId: run.planId,
        stepId: stepResult.stepId,
        phase: 'recovery',
        attempt: recovery.attempt,
        recovery: recovery.strategy,
        failureClass: recovery.failureClass,
        status: 'recovered',
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 0,
        message: sanitizeTraceText(recovery.reason),
        endedAt: recovery.recoveredAt,
      });
    }
  }

  // Outcome record.
  records.push({
    runId: run.runId,
    goalId: run.goalId,
    planId: run.planId,
    stepId: run.currentStepId ?? '',
    phase: 'outcome',
    status: run.state,
    verdict: undefined,
    tokensUsed: run.usage.tokensUsed,
    costUsd: run.usage.costUsd,
    latencyMs: run.usage.latencyMs,
    message: sanitizeTraceText(
      `outcome ${run.outcome ?? 'none'} (${run.state}): ${run.outcomeReasons.join('; ')}`,
    ),
    endedAt: run.finishedAt,
  });

  return records;
}

function actionTrace(
  run: AgentExecutionRun,
  stepId: string,
  action: AgentActionRecord,
): AgentExecutionTraceRecord {
  return {
    runId: run.runId,
    goalId: run.goalId,
    planId: run.planId,
    stepId,
    actionId: action.actionId,
    phase: 'action',
    attempt: action.attempt,
    revision: action.revision,
    kind: action.kind,
    capability: action.capability,
    provider: action.provider,
    model: action.model,
    toolName: action.toolName,
    status: action.status,
    tokensUsed: action.tokensUsed,
    costUsd: action.costUsd,
    latencyMs: action.latencyMs,
    message: sanitizeTraceText(
      action.kind === 'ai'
        ? `AI action via ${action.provider ?? '?'}/${action.model ?? '?'} ${action.status}`
        : `tool action "${action.toolName ?? '?'}" ${action.status}`,
    ),
    startedAt: action.startedAt,
    endedAt: action.endedAt,
  };
}

function observationTrace(
  run: AgentExecutionRun,
  stepId: string,
  observation: AgentObservation,
): AgentExecutionTraceRecord {
  return {
    runId: run.runId,
    goalId: run.goalId,
    planId: run.planId,
    stepId,
    actionId: observation.actionId,
    phase: 'observation',
    attempt: observation.attempt,
    kind: observation.toolName !== undefined ? 'tool' : 'ai',
    capability: observation.capability,
    provider: observation.provider,
    model: observation.model,
    toolName: observation.toolName,
    status: observation.status,
    tokensUsed: 0,
    costUsd: 0,
    latencyMs: 0,
    message: sanitizeTraceText(observation.error ?? observation.resultSummary),
    endedAt: observation.observedAt,
  };
}
