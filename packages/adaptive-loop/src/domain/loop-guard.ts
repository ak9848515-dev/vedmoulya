// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: Loop Guard
//
// Deterministic hard bounds + repetition detection. The decision model
// is NEVER asked "what next" when any budget is exhausted — the run
// stops and returns an explicit bounded outcome. Repetitive behavior is
// detected deterministically (never left to the model to self-police).
//
//   - decision iterations / actions / tool calls / tokens / cost /
//     wall-clock / abstains → hard ceilings (PHASE 10).
//   - permission denials and budget exhaustion are NEVER retried: the
//     guard fires before another consult/action can be requested
//     (PHASE 7/10/30/31).
//   - repeated identical action fingerprints beyond loopThreshold →
//     LOOP_DETECTED (PHASE 11).
// ──────────────────────────────────────────────────────────────────

import type { AgentClockPort } from '@vedmoulya/agent-execution';
import type {
  AdaptiveLoopBudgets,
  AdaptiveRunUsage,
  AdaptiveTerminationReason,
} from '../types/adaptive-loop-types.js';
import { EMPTY_ADAPTIVE_USAGE } from '../types/adaptive-loop-types.js';

/** Wall-clock elapsed guard inputs (deterministic in tests via clock). */
export interface LoopGuardState {
  usage: AdaptiveRunUsage;
  budgets: AdaptiveLoopBudgets;
  startedAtMs: number;
}

export type GuardVerdict =
  { ok: true } | { ok: false; reason: AdaptiveTerminationReason; detail: string };

/** Ordered budget checks — the FIRST exhausted bound stops the run. */
export function checkLoopBudgets(state: LoopGuardState, clock: AgentClockPort): GuardVerdict {
  const usage = state.usage;
  const budgets = state.budgets;
  const elapsedMs = Math.max(clock.timestampMs() - state.startedAtMs, 0);

  if (usage.decisionIterations >= budgets.maxDecisionIterations) {
    return {
      ok: false,
      reason: 'DECISION_LOOP_BUDGET_EXCEEDED',
      detail: `decision iterations reached the ceiling of ${String(budgets.maxDecisionIterations)} — the model is not asked again`,
    };
  }
  if (usage.attempts >= budgets.maxActions) {
    return {
      ok: false,
      reason: 'ACTION_BUDGET_EXCEEDED',
      detail: `executed actions reached the ceiling of ${String(budgets.maxActions)} — no further actions are executed`,
    };
  }
  if (usage.toolCalls >= budgets.maxToolCalls) {
    return {
      ok: false,
      reason: 'TOOL_CALL_BUDGET_EXCEEDED',
      detail: `tool calls reached the ceiling of ${String(budgets.maxToolCalls)} — no further tool calls are executed`,
    };
  }
  if (usage.tokensUsed >= budgets.maxTokens) {
    return {
      ok: false,
      reason: 'TOKEN_BUDGET_EXCEEDED',
      detail: `cumulative tokens reached the ceiling of ${String(budgets.maxTokens)}`,
    };
  }
  if (usage.costUsd >= budgets.maxCostUsd) {
    return {
      ok: false,
      reason: 'COST_BUDGET_EXCEEDED',
      detail: `cumulative cost reached the ceiling of ${String(budgets.maxCostUsd)} USD`,
    };
  }
  if (elapsedMs >= budgets.maxWallClockMs) {
    return {
      ok: false,
      reason: 'WALL_CLOCK_BUDGET_EXCEEDED',
      detail: `wall-clock elapsed ${String(elapsedMs)}ms reached the ceiling of ${String(budgets.maxWallClockMs)}ms`,
    };
  }
  if (usage.abstains >= budgets.maxAbstains) {
    return {
      ok: false,
      reason: 'ABSTAIN_LIMIT_EXCEEDED',
      detail: `runtime abstentions reached the ceiling of ${String(budgets.maxAbstains)} — failing honestly rather than guessing`,
    };
  }
  // REVISE_STEP / REPLAN budgets are enforced at the decision gate (a
  // rejected REVISE/REPLAN never terminates a healthy run — only an
  // exhausted decision budget or a step that cannot progress does).
  return { ok: true };
}

/**
 * Deterministic repetition fingerprint of a decision or an executed
 * action proposal. Two identical fingerprints in a row mean the model
 * proposed (or the loop executed) the same thing again.
 */
export function fingerprintDecision(input: {
  kind: string;
  stepId?: string;
  tool?: string;
  capability?: string;
  argumentsHash?: string;
}): string {
  return [
    input.kind,
    input.stepId ?? '-',
    input.tool ?? '-',
    input.capability ?? '-',
    input.argumentsHash ?? '-',
  ].join(':');
}

export function fingerprintAction(input: {
  kind: 'TOOL_CALL' | 'AI_ACTION';
  stepId: string;
  toolName?: string;
  capability?: string;
  argumentsHash?: string;
}): string {
  return fingerprintDecision({
    kind: input.kind,
    stepId: input.stepId,
    tool: input.toolName,
    capability: input.capability,
    argumentsHash: input.argumentsHash,
  });
}

export function hashArguments(
  argumentsValue: Record<string, unknown> | undefined,
): string | undefined {
  if (argumentsValue === undefined || Object.keys(argumentsValue).length === 0) return undefined;
  try {
    return JSON.stringify(argumentsValue);
  } catch {
    return 'unserializable';
  }
}

/** Track a fingerprint run; returns true when LOOP_DETECTED fires. */
export function detectLoop(
  usage: AdaptiveRunUsage,
  fingerprint: string,
  loopThreshold: number,
): { looped: boolean; repeated: number } {
  if (usage.actionFingerprints.length === 0) {
    usage.actionFingerprints.push(fingerprint);
    return { looped: false, repeated: 1 };
  }
  const last = usage.actionFingerprints[usage.actionFingerprints.length - 1];
  if (last !== fingerprint) {
    usage.actionFingerprints.push(fingerprint);
    return { looped: false, repeated: 1 };
  }
  // Consecutive identical fingerprint — count how many times in a row.
  let repeated = 1;
  for (let i = usage.actionFingerprints.length - 1; i >= 0; i -= 1) {
    if (usage.actionFingerprints[i] === fingerprint) repeated += 1;
    else break;
  }
  usage.actionFingerprints.push(fingerprint);
  return { looped: repeated >= loopThreshold, repeated };
}

/** Fresh usage record for a new adaptive run. */
export function freshUsage(): AdaptiveRunUsage {
  return { ...EMPTY_ADAPTIVE_USAGE, actionFingerprints: [] };
}
