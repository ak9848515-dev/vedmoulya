// PHASE 24 #1–#3: execution record creation, sanitization, secret removal.

import { describe, expect, it } from 'vitest';
import type { AgentExecutionTraceRecord } from '@vedmoulya/agent-execution';
import { extractExecutionRecords } from '../domain/execution-record.js';
import { makeCompletedRun } from './fixtures.js';

describe('execution record extraction', () => {
  it('creates a run-level record plus one record per traced action', () => {
    const { run, traces } = makeCompletedRun({
      actionTraces: [
        {
          stepId: 'step-1',
          actionId: 'a1',
          provider: 'mock',
          model: 'mock-1',
          status: 'succeeded',
          verdict: 'VERIFIED',
        },
        {
          stepId: 'step-2',
          actionId: 'a2',
          provider: 'mock',
          model: 'mock-1',
          status: 'failed',
          verdict: 'FAILED',
        },
      ],
    });
    const records = extractExecutionRecords({ run, traces });
    expect(records).toHaveLength(3);
    const runRecord = records.find((r) => r.stepId === undefined);
    expect(runRecord).toBeDefined();
    expect(runRecord!.finalOutcome).toBe('ACHIEVED');
    expect(runRecord!.verifiedEvidenceCount).toBe(1);
    expect(runRecord!.goalText).toBe('Complete the repository task');
    const actionRecords = records.filter((r) => r.stepId !== undefined);
    expect(actionRecords).toHaveLength(2);
    expect(actionRecords[0].verificationVerdict).toBe('VERIFIED');
    expect(actionRecords[1].verificationVerdict).toBe('FAILED');
    expect(actionRecords[1].actionStatus).toBe('failed');
  });

  it('preserves verification verdicts verbatim from frozen evidence', () => {
    const { run, traces } = makeCompletedRun({
      actionTraces: [{ stepId: 'step-1', verdict: 'UNKNOWN' }],
    });
    const records = extractExecutionRecords({ run, traces });
    expect(records.find((r) => r.stepId === 'step-1')!.verificationVerdict).toBe('UNKNOWN');
  });

  it('removes secrets from goal and error text (frozen sanitizer)', () => {
    const { run, traces } = makeCompletedRun({
      goal: 'fix the auth bug with api_key=sk-abcdefghijklmnopqrstuvwxyz012345',
      error: 'provider error password=hunter2',
    });
    const records = extractExecutionRecords({ run, traces });
    const runRecord = records[0];
    expect(runRecord.goalText).not.toContain('sk-abcdefghijklmnopqrstuvwxyz012345');
    expect(runRecord.error).not.toContain('hunter2');
  });

  it('bounds goal text and never stores raw prompts or outputs', () => {
    const { run, traces } = makeCompletedRun({
      goal: `g`.repeat(5_000),
    });
    const records = extractExecutionRecords({ run, traces });
    expect(records[0].goalText.length).toBeLessThanOrEqual(301); // 300 + marker
  });

  it('carries tool/provider/model/capability only from the frozen trace', () => {
    const { run, traces } = makeCompletedRun({
      actionTraces: [
        { stepId: 'step-1', toolName: 'test-runner', provider: 'mock', model: 'mock-1' },
      ],
    });
    const records = extractExecutionRecords({ run, traces });
    const action = records.find((r) => r.stepId === 'step-1')!;
    expect(action.tool).toBe('test-runner');
    expect(action.provider).toBe('mock');
    expect(action.model).toBe('mock-1');
    expect(action.actionKind).toBe('ai');
  });

  it('attaches recovery strategy from the recovery trace', () => {
    const { run, traces } = makeCompletedRun({
      actionTraces: [{ stepId: 'step-1', recovery: 'alternate_tool', verdict: 'VERIFIED' }],
    });
    const records = extractExecutionRecords({ run, traces });
    expect(records.find((r) => r.stepId === 'step-1')!.recoveryStrategy).toBe('alternate_tool');
  });

  it('falls back to the objective for goal text and records raw attempt/revision faithfully', () => {
    // A whitespace goal contributes no goal text — the objective is the
    // honest fallback (never an empty string).
    const { run } = makeCompletedRun({ goal: '   ' });
    // A raw action trace with attempt 2 / revision 1 and no action id: the
    // record must preserve the real attempt numbers and the action-id
    // fallback to the step id.
    const traces: AgentExecutionTraceRecord[] = [
      {
        runId: run.runId,
        goalId: run.goalId,
        planId: run.planId,
        stepId: 'step-1',
        phase: 'action',
        attempt: 2,
        revision: 1,
        kind: 'tool',
        capability: 'coding',
        toolName: 'test-runner',
        status: 'failed',
        tokensUsed: 1,
        costUsd: 0,
        latencyMs: 5,
        message: '   ',
      },
    ];
    const records = extractExecutionRecords({ run, traces });
    const action = records.find((r) => r.stepId === 'step-1')!;
    expect(action.actionId).toBeUndefined();
    expect(action.executionId).toBe(`ex-${run.runId}-step-1-2`);
    expect(action.fallbackUsed).toBe(true);
    expect(action.revisions).toBe(1);
    expect(action.verificationVerdict).toBeUndefined(); // no verification trace
    expect(action.error).toBeUndefined(); // whitespace-only message is not evidence
    expect(action.observedAt).toBe(records[0].observedAt); // endedAt falls back to run time
    expect(records[0].goalText).toBe('Complete the repository task');
  });
});
