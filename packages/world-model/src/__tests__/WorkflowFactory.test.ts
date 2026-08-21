// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — WorkflowFactory tests (SPRINT-032)
// Generic business workflow factory + BOUNDED decomposition:
//   • decomposition respects the SPRINT-030 bounds (depth ≤ 8 · tasks ≤ 24 ·
//     fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 · time ≤ 600 s)
//   • no infinite loops / unbounded fan-out
//   • decomposition NEVER executes (executed:false is structural)
//   • "Build a YouTube video" decomposes into a bounded task graph with
//     per-step capabilities (each may use a different provider)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_LIMITS,
  WorkflowFactory,
  createWorkflowRecord,
  planWithinBounds,
} from '../domain/WorkflowFactory.js';

const factory = new WorkflowFactory();

describe('WorkflowFactory.decompose', () => {
  it('"Build a YouTube video" decomposes into a bounded task graph', () => {
    const result = factory.decompose({
      ownerId: 'u1',
      goal: 'Build a YouTube video',
      steps: [
        { label: 'research', capability: 'RESEARCH' },
        { label: 'outline', capability: 'REASONING' },
        { label: 'script', capability: 'TEXT_GENERATION' },
        { label: 'fact verification', capability: 'RESEARCH' },
        { label: 'visual plan', capability: 'VISION' },
        { label: 'voice', capability: 'TEXT_TO_SPEECH' },
        { label: 'editing', capability: 'VIDEO_EDITING' },
        { label: 'thumbnail', capability: 'IMAGE_GENERATION' },
        { label: 'SEO', capability: 'TEXT_GENERATION' },
        { label: 'publishing preparation' },
        { label: 'analytics', capability: 'REASONING' },
      ],
      estimatedCostUsd: 2,
      estimatedTimeMs: 300_000,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.executed).toBe(false); // structural — never executes
    expect(result.data.steps).toHaveLength(11);
    expect(result.data.plan.taskCount).toBe(11);
    expect(result.data.plan.depth).toBeLessThanOrEqual(8);
    expect(result.data.plan.maxParallelFanout).toBeLessThanOrEqual(8);
    expect(result.data.bounds.allowed).toBe(true);
  });

  it('rejects decompositions that exceed the SPRINT-030 bounds', () => {
    const result = factory.decompose({
      ownerId: 'u1',
      goal: 'Unbounded plan',
      steps: Array.from({ length: 100 }, (_, i) => ({ label: `task-${i}` })),
      estimatedCostUsd: 50,
      estimatedTimeMs: 9_000_000,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.bounds.allowed).toBe(false);
    expect(result.data.bounds.exceeded).toBeDefined();
    expect(result.data.executed).toBe(false);
  });

  it('planWithinBounds blocks unbounded fan-out and infinite loops deterministically', () => {
    expect(
      planWithinBounds({
        taskCount: 2,
        depth: 1,
        maxParallelFanout: 100,
        estimatedProviderCalls: 2,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'parallel' });
    expect(
      planWithinBounds({
        taskCount: 2,
        depth: 100,
        maxParallelFanout: 1,
        estimatedProviderCalls: 2,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'depth' });
    expect(
      planWithinBounds({
        taskCount: 100,
        depth: 1,
        maxParallelFanout: 1,
        estimatedProviderCalls: 2,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'tasks' });
    expect(
      planWithinBounds({
        taskCount: 2,
        depth: 1,
        maxParallelFanout: 1,
        estimatedProviderCalls: 100,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'calls' });
    expect(
      planWithinBounds({
        taskCount: 2,
        depth: 1,
        maxParallelFanout: 1,
        estimatedProviderCalls: 2,
        estimatedCostUsd: 100,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'cost' });
    expect(
      planWithinBounds({
        taskCount: 2,
        depth: 1,
        maxParallelFanout: 1,
        estimatedProviderCalls: 2,
        estimatedTimeMs: 10_000_000,
      }),
    ).toMatchObject({ allowed: false, exceeded: 'time' });
    expect(
      planWithinBounds({ taskCount: 2, depth: 1, maxParallelFanout: 1, estimatedProviderCalls: 2 }),
    ).toMatchObject({ allowed: true });
  });

  it('documents the SPRINT-030 bounds constants', () => {
    expect(DEFAULT_WORKFLOW_LIMITS.maxWorkflowDepth).toBe(8);
    expect(DEFAULT_WORKFLOW_LIMITS.maxWorkflowTasks).toBe(24);
    expect(DEFAULT_WORKFLOW_LIMITS.maxParallelProviders).toBe(8);
    expect(DEFAULT_WORKFLOW_LIMITS.maxProviderCalls).toBe(64);
    expect(DEFAULT_WORKFLOW_LIMITS.maxWorkflowCostUsd).toBe(5);
    expect(DEFAULT_WORKFLOW_LIMITS.maxWorkflowTimeMs).toBe(600_000);
  });

  it('refuses empty goals and empty step lists', () => {
    expect(factory.decompose({ ownerId: 'u1', goal: '', steps: [{ label: 'x' }] }).success).toBe(
      false,
    );
    expect(factory.decompose({ ownerId: 'u1', goal: 'goal', steps: [] }).success).toBe(false);
  });

  it('refuses over-long goals', () => {
    expect(
      factory.decompose({ ownerId: 'u1', goal: 'g'.repeat(301), steps: [{ label: 'x' }] }).success,
    ).toBe(false);
  });
});

describe('createWorkflowRecord', () => {
  it('creates a validated owner-scoped workflow with stable key', () => {
    const result = createWorkflowRecord({
      ownerId: 'u1',
      name: 'Client delivery',
      description: 'Generic client delivery pipeline',
      trigger: 'CLIENT_REQUEST',
      inputs: ['request'],
      steps: [
        { id: 's1', label: 'analyze', capability: 'REASONING', dependsOn: [] },
        { id: 's2', label: 'propose', dependsOn: ['s1'] },
        { id: 's3', label: 'build', capability: 'CODING', dependsOn: ['s2'] },
        { id: 's4', label: 'test', capability: 'CODE_EXECUTION', dependsOn: ['s3'] },
        { id: 's5', label: 'deliver', approvalGate: 'external publication', dependsOn: ['s4'] },
      ],
      outputs: ['delivered artifact'],
      expectedOutcome: 'client accepts delivery',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stableKey).toContain('client-delivery');
    expect(result.data.steps).toHaveLength(5);
    expect(result.data.status).toBe('DEFINED');
  });

  it('refuses workflows with more than 24 steps (SPRINT-030 bound)', () => {
    const result = createWorkflowRecord({
      ownerId: 'u1',
      name: 'Too big',
      description: 'x',
      trigger: 't',
      inputs: [],
      steps: Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, label: `s${i}`, dependsOn: [] })),
      outputs: [],
    });
    expect(result.success).toBe(false);
  });

  it('refuses missing names / triggers / steps', () => {
    expect(
      createWorkflowRecord({
        ownerId: 'u1',
        name: '',
        description: 'x',
        trigger: 't',
        inputs: [],
        steps: [{ id: 's1', label: 'x', dependsOn: [] }],
        outputs: [],
      }).success,
    ).toBe(false);
    expect(
      createWorkflowRecord({
        ownerId: 'u1',
        name: 'n',
        description: 'x',
        trigger: '',
        inputs: [],
        steps: [{ id: 's1', label: 'x', dependsOn: [] }],
        outputs: [],
      }).success,
    ).toBe(false);
    expect(
      createWorkflowRecord({
        ownerId: 'u1',
        name: 'n',
        description: 'x',
        trigger: 't',
        inputs: [],
        steps: [],
        outputs: [],
      }).success,
    ).toBe(false);
  });
});
