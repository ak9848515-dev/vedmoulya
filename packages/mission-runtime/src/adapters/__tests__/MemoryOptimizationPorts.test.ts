import { describe, expect, it, vi } from 'vitest';
import { ExecutionMemoryService } from '@vedmoulya/execution-memory';
import { makeCompletedRun } from '../../../../execution-memory/src/__tests__/fixtures.js';
import {
  MissionExecutionMemoryAdapter,
  MissionExperienceOptimizationAdapter,
} from '../MemoryOptimizationPorts.js';
import { RunRegistry } from '../PlanningExecutionPorts.js';

describe('mission learning adapters — adversarial boundaries', () => {
  it('does not create learning from successful-but-unverified execution', async () => {
    const memory = new ExecutionMemoryService();
    const runs = new RunRegistry();
    const { run } = makeCompletedRun({
      runId: 'run-unverified',
      outcome: 'ACHIEVED',
      actionTraces: [{ stepId: 'step-1', status: 'succeeded', verdict: 'UNKNOWN' }],
    });
    runs.remember(
      { ...run, runId: 'run-unverified' },
      { missionId: 'mission-a', objectiveId: 'objective-a' },
    );
    const adapter = new MissionExecutionMemoryAdapter(memory, runs);

    await adapter.recordVerifiedOutcome('mission-a', 'objective-a', {
      success: true,
      verified: false,
      evidence: ['model claimed completion'],
    });

    expect(await memory.listEntries()).toHaveLength(0);
  });

  it('does not turn an unverified ACHIEVED label into positive task learning', async () => {
    const memory = new ExecutionMemoryService();
    const { run, traces } = makeCompletedRun({
      outcome: 'ACHIEVED',
      actionTraces: [{ stepId: 'step-1', status: 'succeeded', verdict: 'UNKNOWN' }],
    });

    await memory.ingestRun(run, traces);

    expect(
      (await memory.listEntries()).filter((entry) => entry.category === 'TASK_PATTERN'),
    ).toHaveLength(0);
  });

  it('uses the mission/objective association rather than another mission latest run', async () => {
    const memory = new ExecutionMemoryService();
    const runs = new RunRegistry();
    const first = makeCompletedRun({ runId: 'run-a', userId: 'owner-a', outcome: 'ACHIEVED' });
    const second = makeCompletedRun({ runId: 'run-b', userId: 'owner-b', outcome: 'ACHIEVED' });
    runs.remember(first.run, { missionId: 'mission-a', objectiveId: 'objective-a' });
    runs.remember(second.run, { missionId: 'mission-b', objectiveId: 'objective-b' });
    const adapter = new MissionExecutionMemoryAdapter(memory, runs);

    await adapter.recordVerifiedOutcome('mission-a', 'objective-a', {
      success: true,
      verified: true,
      evidence: ['frozen verification'],
    });

    const entries = await memory.listEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) => entry.provenance.executionIds.some((id) => id.includes('run-a'))),
    ).toBe(true);
    expect(
      entries.every((entry) => !entry.provenance.executionIds.some((id) => id.includes('run-b'))),
    ).toBe(true);
  });

  it('passes the owner scope to optimization and remains advisory', async () => {
    const recommend = vi.fn().mockResolvedValue(undefined);
    const adapter = new MissionExperienceOptimizationAdapter({ recommend } as never);

    await adapter.getAdvisorySignal('task', {
      missionId: 'mission-a',
      objectiveId: 'objective-a',
      userId: 'owner-a',
    });

    expect(recommend).toHaveBeenCalledWith('EXECUTION_SEQUENCE', { userId: 'owner-a' });
  });
});
