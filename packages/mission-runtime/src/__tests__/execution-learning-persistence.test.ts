// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission execution-learning persistence (QUALITY-SPRINT-006)
//
// Root cause this locks down: `MissionExecutionMemoryAdapter.ingestObjectiveRun`
// called `ExecutionMemoryService.ingestRun(run)` WITHOUT the run's sanitized
// trace. The learning cycle derives EVERY step/tool/verification candidate from
// that trace, so a clean successful mission produced ZERO memory candidates and
// therefore ZERO durable learning entries — the "no learning for a successful
// mission" defect.
//
// These tests exercise the REAL adapter + REAL RunRegistry + REAL
// ExecutionMemoryService over the enterprise MemoryIntelligenceStoreAdapter
// (InMemoryMemoryRepository hermetic double). No learning pipeline is mocked.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { AgentExecutionRun, AgentPlan } from '@vedmoulya/agent-execution';
import {
  ExecutionMemoryService,
  MemoryIntelligenceStoreAdapter,
} from '@vedmoulya/execution-memory';
import { InMemoryMemoryRepository } from '@vedmoulya/memory-intelligence';
import { MissionExecutionMemoryAdapter } from '../adapters/MemoryOptimizationPorts.js';
import { RunRegistry } from '../adapters/PlanningExecutionPorts.js';

const NOW = '2026-01-01T00:00:00.000Z';

/** A production-shaped verified run: stepResults carry real actions + verification. */
function verifiedToolRun(runId = 'run-learning-1'): AgentExecutionRun {
  const plan: AgentPlan = {
    planId: 'plan-learning-1',
    goalId: 'goal-learning-1',
    objective: 'Write the acceptance artifact',
    steps: [
      {
        stepId: 'step-1',
        objective: 'Write the file',
        capability: 'coding',
        dependencies: [],
        allowedTools: ['workspace_write'],
        actions: [
          {
            actionId: 'step-1-a1',
            kind: 'tool',
            capability: 'coding',
            instruction: 'write the acceptance file',
            expectedOutcome: 'file written',
          },
        ],
        recoveryPolicy: { maxAttempts: 2, maxRevisions: 1 },
      },
    ],
  };

  return {
    runId,
    goalId: plan.goalId,
    planId: plan.planId,
    userId: 'user-learning-1',
    missionContext: { missionId: 'mission-learning-1', objectiveId: 'objective-learning-1' },
    goal: 'Write the acceptance artifact',
    objective: plan.objective,
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    plan,
    budget: {
      maxAttemptsPerStep: 2,
      maxRevisionsPerStep: 1,
      maxToolCalls: 8,
      maxTokens: 64_000,
      maxCostUsd: 1,
      maxLatencyMs: 300_000,
    },
    usage: {
      // No recovery attempts: isolates the trace dependency (a second
      // attempt would emit a run-level RECOVERY_SUCCESS candidate).
      attempts: 0,
      revisions: 0,
      toolCalls: 1,
      tokensUsed: 50,
      costUsd: 0.001,
      latencyMs: 10,
    },
    state: 'COMPLETED',
    stateHistory: ['PLANNING', 'EXECUTING', 'COMPLETED'],
    stepResults: [
      {
        stepId: 'step-1',
        objective: 'Write the file',
        status: 'completed',
        verified: true,
        verification: {
          verdict: 'VERIFIED',
          checks: [],
          reasons: ['artifact matches the expected contents'],
          policyKind: 'rule',
        },
        actions: [
          {
            actionId: 'step-1-a1',
            stepId: 'step-1',
            runId,
            kind: 'tool',
            attempt: 1,
            revision: 0,
            fallbackUsed: false,
            capability: 'coding',
            toolName: 'workspace_write',
            status: 'succeeded',
            tokensUsed: 50,
            costUsd: 0.001,
            latencyMs: 10,
            startedAt: NOW,
            endedAt: NOW,
          },
        ],
        observations: [],
        recoveries: [],
        attempts: 1,
        revisions: 0,
        toolCalls: 1,
        tokensUsed: 50,
        costUsd: 0.001,
        latencyMs: 10,
        output: 'file written',
      },
    ],
    approvals: [],
    approvalDecisions: [],
    validationIssues: [],
    outcome: 'ACHIEVED',
    outcomeReasons: [],
    createdAt: NOW,
    updatedAt: NOW,
    finishedAt: NOW,
  };
}

function makeAdapter(): {
  adapter: MissionExecutionMemoryAdapter;
  runs: RunRegistry;
  entries: () => Promise<Awaited<ReturnType<ExecutionMemoryService['listEntries']>>>;
} {
  const repository = new InMemoryMemoryRepository();
  const service = new ExecutionMemoryService({
    store: new MemoryIntelligenceStoreAdapter(repository),
  });
  const runs = new RunRegistry();
  return {
    adapter: new MissionExecutionMemoryAdapter(service, runs),
    runs,
    entries: () => service.listEntries(),
  };
}

describe('MissionExecutionMemoryAdapter — execution learning persistence', () => {
  it('persists durable learning for a verified objective from the run trace', async () => {
    const { adapter, runs, entries } = makeAdapter();
    const run = verifiedToolRun();
    runs.remember(run, { missionId: 'mission-learning-1', objectiveId: 'objective-learning-1' });

    await adapter.recordVerifiedOutcome('mission-learning-1', 'objective-learning-1', {
      success: true,
      verified: true,
      evidence: ['run outcome: ACHIEVED'],
    });

    const learned = await entries();
    // The verified tool step must become TOOL_RELIABILITY learning.
    expect(learned.length).toBeGreaterThan(0);
    const tool = learned.find((entry) => entry.category === 'TOOL_RELIABILITY');
    expect(tool?.subject).toBe('workspace_write');
    expect(tool?.verifiedCount).toBeGreaterThan(0);
  });

  it('does NOT write learning when the objective is not verified (negative case)', async () => {
    const { adapter, runs, entries } = makeAdapter();
    runs.remember(verifiedToolRun(), {
      missionId: 'mission-learning-1',
      objectiveId: 'objective-learning-1',
    });

    await adapter.recordVerifiedOutcome('mission-learning-1', 'objective-learning-1', {
      success: true,
      verified: false,
      evidence: ['verification failed'],
    });

    await expect(entries()).resolves.toHaveLength(0);
  });

  it('records nothing when no run is registered for the objective', async () => {
    const { adapter, entries } = makeAdapter();

    await adapter.recordVerifiedOutcome('mission-missing', 'objective-missing', {
      success: true,
      verified: true,
      evidence: ['run outcome: ACHIEVED'],
    });

    await expect(entries()).resolves.toHaveLength(0);
  });
});
