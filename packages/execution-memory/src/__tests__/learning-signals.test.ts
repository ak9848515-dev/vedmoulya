// PHASE 24 #4–#7 (+ Phase 17): deterministic, evidence-based signals.
// Positive signals REQUIRE frozen verification evidence — model claims,
// unverified output and UNKNOWN verdicts never produce them.

import { describe, expect, it } from 'vitest';
import { extractLearningSignals } from '../domain/learning-signals.js';
import { extractExecutionRecords } from '../domain/execution-record.js';
import { makeCompletedRun } from './fixtures.js';

function signalsFor(options: Parameters<typeof makeCompletedRun>[0]) {
  const { run, traces } = makeCompletedRun(options);
  return extractLearningSignals(extractExecutionRecords({ run, traces }));
}

function kinds(signals: ReturnType<typeof extractLearningSignals>): string[] {
  return signals.map((s) => s.kind);
}

describe('learning signal extraction — verified evidence', () => {
  it('verified success produces the full positive signal set', () => {
    const signals = signalsFor({
      outcome: 'ACHIEVED',
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: 'VERIFIED',
        },
      ],
    });
    const all = kinds(signals);
    expect(all).toContain('GOAL_ACHIEVED');
    expect(all).toContain('SUCCESSFUL_PLAN');
    expect(all).toContain('VERIFICATION_SUCCESS');
    expect(all).toContain('MODEL_SUCCESS');
  });

  it('unverified success does NOT produce positive success memory', () => {
    // Model claims success, but the action was never verified.
    const signals = signalsFor({
      outcome: 'ACHIEVED',
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: undefined,
        },
      ],
    });
    const all = kinds(signals);
    expect(all).not.toContain('TOOL_SUCCESS');
    expect(all).not.toContain('MODEL_SUCCESS');
    expect(all).not.toContain('SUCCESSFUL_PLAN'); // no VERIFIED evidence on the run
    // But the run-level outcome still produced GOAL_ACHIEVED (frozen outcome).
    expect(all).toContain('GOAL_ACHIEVED');
  });

  it('UNKNOWN verification never yields a positive signal', () => {
    const signals = signalsFor({
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: 'UNKNOWN',
        },
      ],
    });
    const all = kinds(signals);
    expect(all).not.toContain('VERIFICATION_SUCCESS');
    expect(all).not.toContain('TOOL_SUCCESS');
    expect(all).not.toContain('MODEL_SUCCESS');
  });

  it('verification failure creates failure evidence, not tool success', () => {
    // Tool/action succeeded but frozen verification FAILED (Phase 17).
    const signals = signalsFor({
      outcome: 'FAILED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'succeeded', verdict: 'FAILED' },
      ],
    });
    const all = kinds(signals);
    expect(all).toContain('VERIFICATION_FAILURE');
    expect(all).not.toContain('TOOL_SUCCESS');
    expect(all).toContain('GOAL_FAILED');
    expect(all).toContain('FAILED_PLAN');
  });

  it('tool failures and permission denials become tool failure evidence', () => {
    const signals = signalsFor({
      outcome: 'BLOCKED',
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', status: 'failed' },
        { stepId: 'step-2', toolName: 'admin.purge', status: 'denied' },
      ],
    });
    const all = kinds(signals);
    expect(all).toContain('TOOL_FAILURE');
    expect(all).toContain('TOOL_PERMISSION_DENIED');
    expect(all).toContain('GOAL_BLOCKED');
  });

  it('a slow failed tool call becomes TOOL_TIMEOUT', () => {
    const signals = signalsFor({
      actionTraces: [
        { stepId: 'step-1', toolName: 'slow.tool', status: 'failed', latencyMs: 120_000 },
      ],
    });
    expect(kinds(signals)).toContain('TOOL_TIMEOUT');
  });

  it('recovery learning: bounded recovery that verifies → RECOVERY_SUCCESS', () => {
    const signals = signalsFor({
      outcome: 'ACHIEVED',
      attempts: 2,
      actionTraces: [{ stepId: 'step-1', recovery: 'alternate_tool', verdict: 'VERIFIED' }],
    });
    const all = kinds(signals);
    expect(all).toContain('RECOVERY_SUCCESS');
  });

  it('recovery that fails verification → RECOVERY_FAILURE', () => {
    const signals = signalsFor({
      outcome: 'FAILED',
      attempts: 2,
      actionTraces: [{ stepId: 'step-1', recovery: 'retry', verdict: 'FAILED' }],
    });
    expect(kinds(signals)).toContain('RECOVERY_FAILURE');
  });

  it('replan evidence is bounded and outcome-based', () => {
    const success = signalsFor({
      outcome: 'ACHIEVED',
      actionTraces: [{ stepId: 'step-1', verdict: 'VERIFIED' }],
    });
    const failed = signalsFor({
      outcome: 'FAILED',
      actionTraces: [{ stepId: 'step-1', verdict: 'FAILED' }],
    });
    expect(kinds(success)).toContain('GOAL_ACHIEVED');
    expect(kinds(failed)).toContain('GOAL_FAILED');
  });

  it('LOOP_DETECTED is signalled from the run termination reason', () => {
    const signals = signalsFor({
      outcome: 'FAILED',
      error: 'identical action repeated 3 times — LOOP_DETECTED',
      actionTraces: [{ stepId: 'step-1', status: 'succeeded', verdict: 'FAILED' }],
    });
    expect(kinds(signals)).toContain('LOOP_DETECTED');
  });

  it('a model FALLBACK that succeeds and verifies → MODEL_FALLBACK_SUCCESS', () => {
    const { run, traces } = makeCompletedRun({
      actionTraces: [
        {
          stepId: 'step-1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: 'VERIFIED',
          fallback: true,
        },
      ],
    });
    const records = extractExecutionRecords({ run, traces });
    // Mark the action record as a fallback via attempts > 1 (bounded heuristic).
    const signals = extractLearningSignals(
      records.map((r) => (r.stepId === undefined ? r : { ...r, fallbackUsed: true })),
    );
    expect(kinds(signals)).toContain('MODEL_FALLBACK_SUCCESS');
  });
});
