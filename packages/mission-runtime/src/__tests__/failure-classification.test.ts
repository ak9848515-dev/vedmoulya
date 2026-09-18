// ──────────────────────────────────────────────────────────────────
// VedMoulya — Failure Classification Boundary (FINAL-03A regression guard)
//
// FINAL-03A reported a `FAILED_FINAL` execution run as VERIFICATION_FAILURE so
// a deterministic plan failure enters the EXISTING revision/diagnosis/repair
// path instead of being blind-retried forever.
//
// A run that ended because an operator REJECTED a high-risk approval is NOT a
// verification failure — it is a deliberate human decision. This suite pins
// that boundary so the FINAL-03A classification can never swallow it:
//
//   FAILED_FINAL                         → VERIFICATION_FAILURE → REVISE_OBJECTIVE
//   FAILED_FINAL + rejected approval     → delegated (never VERIFICATION_FAILURE)
//
// These are pure adapter contracts: the fake agent supplies nothing but the
// run the engine would have produced, and the real adapters are exercised.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type {
  AgentExecutionRun,
  AgentExecutionService,
  AgentPlan,
} from '@vedmoulya/agent-execution';
import { AgentExecutionAdapter, MissionFailureClassifierAdapter, RunRegistry } from '../index.js';

const PROVIDER_STATUS = { available: true, capableProviders: [], unhealthyProviders: [] };

const PLAN = {
  planId: 'plan-1',
  goalId: 'goal-1',
  objective: 'Do the work',
  steps: [],
} as unknown as AgentPlan;

/** The run the frozen engine leaves behind — the only input to the adapter. */
function failedFinalRun(overrides: Partial<AgentExecutionRun>): AgentExecutionRun {
  return {
    runId: 'run-1',
    goalId: 'goal-1',
    planId: 'plan-1',
    userId: 'user-1',
    state: 'FAILED_FINAL',
    stateHistory: ['EXECUTING', 'FAILED_FINAL'],
    stepResults: [],
    approvals: [],
    approvalDecisions: [],
    validationIssues: [],
    outcomeReasons: ['the plan did not reach a verified outcome'],
    usage: { tokensUsed: 0, costUsd: 0, latencyMs: 1, toolCalls: 0, attempts: 1, revisions: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as AgentExecutionRun;
}

function adapterFor(run: AgentExecutionRun): AgentExecutionAdapter {
  const agent = { start: async () => run } as unknown as AgentExecutionService;
  return new AgentExecutionAdapter(agent, new RunRegistry());
}

const classifier = new MissionFailureClassifierAdapter();

async function classify(run: AgentExecutionRun) {
  const result = await adapterFor(run).executePlan(PLAN, 'user-1');
  const classification = await classifier.classify(
    result.error ?? '',
    { failureClass: result.failureClass, usage: result.usage },
    PROVIDER_STATUS,
  );
  return { result, classification };
}

describe('FINAL-03A: FAILED_FINAL classification boundary', () => {
  it('a FAILED_FINAL run without a rejected approval is a VERIFICATION_FAILURE → REVISE_OBJECTIVE', async () => {
    const { result, classification } = await classify(failedFinalRun({}));

    expect(result.success).toBe(false);
    expect(result.failureClass).toBe('VERIFICATION_FAILURE');
    expect(classification.failureClass).toBe('VERIFICATION_FAILURE');
    expect(classification.suggestedAction).toBe('REVISE_OBJECTIVE');
    expect(classification.recoverable).toBe(true);
  });

  it('a FAILED_FINAL run with a REJECTED approval is never classified as a verification failure', async () => {
    const run = failedFinalRun({
      approvalDecisions: [
        {
          approvalId: 'approval-1',
          runId: 'run-1',
          stepId: 'step-1',
          decision: 'rejected',
          decidedBy: 'user-1',
          decidedAt: new Date().toISOString(),
        },
      ],
      outcomeReasons: ['step-1 was rejected by the operator'],
    });

    const { result, classification } = await classify(run);

    // The adapter does NOT claim a verification failure…
    expect(result.failureClass).not.toBe('VERIFICATION_FAILURE');
    expect(result.failureClass).toBeUndefined();
    // …so the frozen text classifier stays the authority and the objective is
    // never pushed into the FINAL-03A revision/repair path.
    expect(classification.failureClass).not.toBe('VERIFICATION_FAILURE');
    expect(classification.suggestedAction).not.toBe('REVISE_OBJECTIVE');
  });

  it('an APPROVED decision does not mask a genuine verification failure', async () => {
    const run = failedFinalRun({
      approvalDecisions: [
        {
          approvalId: 'approval-1',
          runId: 'run-1',
          stepId: 'step-1',
          decision: 'approved',
          decidedBy: 'user-1',
          decidedAt: new Date().toISOString(),
        },
      ],
    });

    const { result, classification } = await classify(run);

    expect(result.failureClass).toBe('VERIFICATION_FAILURE');
    expect(classification.failureClass).toBe('VERIFICATION_FAILURE');
    expect(classification.suggestedAction).toBe('REVISE_OBJECTIVE');
  });

  it('a BLOCKED run stays a permission/capability failure (unaffected by FINAL-03A)', async () => {
    const { result } = await classify(
      failedFinalRun({
        state: 'BLOCKED',
        outcomeReasons: ['tool "deploy" was denied by the security policy'],
      }),
    );

    expect(result.failureClass).toBe('PERMISSION_DENIED');
    expect(result.failureClass).not.toBe('VERIFICATION_FAILURE');
  });
});
