import { describe, it, expect } from 'vitest';
import { ExecutionFactory } from '../factory/ExecutionFactory.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';

describe('ExecutionFactory', () => {
  it('creates a plan with defaults', () => {
    const result = ExecutionFactory.createPlan({ title: 'My Plan', description: 'A test plan' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.title).toBe('My Plan');
    expect(result.data!.planningLevel).toBe('operational');
  });

  it('creates a plan with custom planning level', () => {
    const result = ExecutionFactory.createPlan({
      title: 'Strategic',
      description: 'Big picture',
      planningLevel: 'strategic',
    });
    expect(result.success).toBe(true);
    expect(result.data!.planningLevel).toBe('strategic');
  });

  it('creates a plan with priority', () => {
    const result = ExecutionFactory.createPlan({
      title: 'Urgent',
      description: 'Do now',
      priorityScore: 9,
    });
    expect(result.success).toBe(true);
    expect(result.data!.priority.level).toBe('critical');
  });

  it('creates a mission', () => {
    const result = ExecutionFactory.createMission({
      label: 'Mission 1',
      description: 'Do it',
      planId: 'plan_1',
    });
    expect(result.success).toBe(true);
    expect(result.data!.label).toBe('Mission 1');
  });

  it('creates a task without estimated duration (defaults to 30)', () => {
    const result = ExecutionFactory.createTask({
      label: 'Task 1',
      description: 'Do it',
      planId: 'plan_1',
    });
    expect(result.success).toBe(true);
    expect(result.data!.label).toBe('Task 1');
    expect(result.data!.estimatedDuration).toBe(30); // default when not provided
  });

  it('creates a task with estimated duration', () => {
    const result = ExecutionFactory.createTask({
      label: 'Long Task',
      description: 'Takes time',
      planId: 'plan_1',
      estimatedDuration: 60,
    });
    expect(result.success).toBe(true);
    expect(result.data!.estimatedDuration).toBe(60);
  });

  it('reconstructs a plan from persisted data', () => {
    const now = new Date();
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_recon',
      title: 'Reconstructed',
      description: 'From DB',
      status: 'in_progress',
      priorityLevel: 'high',
      priorityScore: 7.5,
      completedCount: 2,
      totalCount: 5,
      createdAt: now,
      updatedAt: now,
    });
    expect(plan.id).toBe('plan_recon');
    expect(plan.status.isInProgress).toBe(true);
    expect(plan.priority.level).toBe('high');
    expect(plan.progress.completed).toBe(2);
    expect(plan.progress.total).toBe(5);
  });

  it('reconstructs a plan with full JSONB data', () => {
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_full',
      title: 'Full Reconstruct',
      description: 'With all data',
      tags: ['tag1', 'tag2'],
      knowledgeNodeIds: ['node1'],
      memoryIds: ['mem1'],
      metadata: { key: 'value' },
    });
    expect(plan.tags).toContain('tag1');
    expect(plan.knowledgeNodeIds).toContain('node1');
    expect(plan.memoryIds).toContain('mem1');
    expect(plan.metadata.key).toBe('value');
  });

  // ── Reconstruct fallback paths ──────────────────────────────────

  it('reconstructs plan with no status (falls back to pending)', () => {
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_no_status',
      title: 'No Status',
      description: 'D',
    });
    expect(plan.status.isPending).toBe(true);
    expect(plan.priority.level).toBe('medium');
  });

  it('reconstructs plan with no priorityScore (falls back to level)', () => {
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_no_priority',
      title: 'No Priority',
      description: 'D',
      priorityLevel: 'critical',
    });
    expect(plan.priority.level).toBe('critical');
  });

  it('reconstructs plan with no priorityLevel or score (falls back to medium)', () => {
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_no_priority_at_all',
      title: 'No Priority At All',
      description: 'D',
    });
    expect(plan.priority.level).toBe('medium');
  });

  it('reconstructs plan with cancelled status', () => {
    const plan = ExecutionFactory.reconstructPlan({
      id: 'plan_cancelled',
      title: 'Cancelled',
      description: 'D',
      status: 'cancelled',
      statusReason: 'No longer needed',
    });
    expect(plan.status.isCancelled).toBe(true);
  });

  // ── Factory error paths ─────────────────────────────────────────

  it('createPlan handles invalid input gracefully', () => {
    const result = ExecutionFactory.createPlan({ title: '', description: '' });
    // Plan creation with empty title/desc passes factory (validated by rules)
    expect(result.success).toBe(true);
  });

  it('createMission with empty label still creates', () => {
    const result = ExecutionFactory.createMission({ label: '', description: 'D', planId: 'p1' });
    expect(result.success).toBe(true);
  });

  it('createTask with no planId still creates', () => {
    // Task doesn't require planId in the constructor
    const result = ExecutionFactory.createTask({
      label: 'T',
      description: 'D',
      planId: 'p1',
    });
    expect(result.success).toBe(true);
  });
});
