import { describe, it, expect } from 'vitest';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { ExecutionMission } from '../entities/ExecutionMission.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';

function createPlan(): ExecutionPlan {
  return new ExecutionPlan({ id: 'plan_1', title: 'Plan', description: 'A plan' });
}

describe('ExecutionPlan advanced behavior', () => {
  it('rejects invalid transitions', () => {
    const plan = createPlan();
    // pending → paused is not allowed
    expect(() => plan.pause('nope')).toThrow(/Cannot transition plan/);
    // pending → in_progress is not allowed
    expect(() => plan.start()).toThrow(/Cannot transition plan/);
  });

  it('allows cancelled plans to transition to nothing else', () => {
    const plan = createPlan();
    plan.cancel('done');
    expect(() => plan.activate()).toThrow(/Cannot transition plan/);
  });

  it('resume is a no-op when not paused', () => {
    const plan = createPlan();
    plan.activate();
    plan.resume();
    expect(plan.status.isReady).toBe(true);
  });

  it('completeMission completes and recalculates progress', () => {
    const plan = createPlan();
    const m = new ExecutionMission({ id: 'mis_1', label: 'M', description: 'D', planId: plan.id });
    plan.addMission(m);
    plan.completeMission('mis_1', ExecutionResult.success('Done'));
    expect(plan.completedMissions).toBe(1);
    expect(plan.progress.completed).toBe(1);
  });

  it('completeMission throws for unknown mission', () => {
    const plan = createPlan();
    expect(() => plan.completeMission('nope', ExecutionResult.success('D'))).toThrow(
      /Mission not found/,
    );
  });

  it('completeTask completes and recalculates progress', () => {
    const plan = createPlan();
    const t = new ExecutionTask({ id: 'task_1', label: 'T', description: 'D' });
    plan.addTask(t);
    plan.completeTask('task_1', ExecutionResult.success('Done'));
    expect(plan.completedTasks).toBe(1);
    expect(plan.progress.percentage).toBe(100);
  });

  it('completeTask throws for unknown task', () => {
    const plan = createPlan();
    expect(() => plan.completeTask('nope', ExecutionResult.success('D'))).toThrow(/Task not found/);
  });

  it('updates priority', () => {
    const plan = createPlan();
    plan.updatePriority(ExecutionPriority.critical());
    expect(plan.priority.level).toBe('critical');
  });

  it('rebalances priorities based on mission priority', () => {
    const plan = createPlan();
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'M',
      description: 'D',
      priority: ExecutionPriority.critical(),
      planId: plan.id,
    });
    plan.addMission(mission);
    const t1 = new ExecutionTask({
      id: 't1',
      label: 'T1',
      description: 'D',
      priority: ExecutionPriority.optional(),
      missionId: 'mis_1',
    });
    plan.addTask(t1);
    plan.rebalancePriorities();
    // critical mission → high priority tasks
    expect(t1.priority.level).toBe('high');
  });

  it('rebalances priorities to medium for low-priority missions', () => {
    const plan = createPlan();
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'M',
      description: 'D',
      priority: ExecutionPriority.optional(),
      planId: plan.id,
    });
    plan.addMission(mission);
    const t1 = new ExecutionTask({
      id: 't1',
      label: 'T1',
      description: 'D',
      priority: ExecutionPriority.critical(),
      missionId: 'mis_1',
    });
    plan.addTask(t1);
    plan.rebalancePriorities();
    expect(t1.priority.level).toBe('medium');
  });

  it('updates context', () => {
    const plan = createPlan();
    const ctx = new ExecutionContext({ energyLevel: 9 });
    plan.updateContext(ctx);
    expect(plan.context.energyLevel).toBe(9);
  });

  it('tracks progress including per-mission progress', () => {
    const plan = createPlan();
    const m = new ExecutionMission({ id: 'mis_1', label: 'M', description: 'D', planId: plan.id });
    plan.addMission(m);
    const t = new ExecutionTask({ id: 't1', label: 'T', description: 'D' });
    plan.addTask(t);
    const tracking = plan.trackProgress();
    expect(tracking.overall.total).toBeGreaterThan(0);
    expect(tracking.missions).toHaveLength(1);
    expect(tracking.missions[0]!.id).toBe('mis_1');
  });

  it('analyzes bottlenecks for blocked, dependency-heavy, and paused tasks', () => {
    const plan = createPlan();
    const blocked = new ExecutionTask({
      id: 't_blocked',
      label: 'Blocked',
      description: 'D',
      status: ExecutionStatus.blocked('external'),
    });
    const dependent = new ExecutionTask({
      id: 't_dep',
      label: 'Dep',
      description: 'D',
      status: ExecutionStatus.inProgress(),
    });
    dependent.addDependency(ExecutionDependency.finishToStart('other', 't_dep', 'hard dep'));
    const paused = new ExecutionTask({
      id: 't_paused',
      label: 'Paused',
      description: 'D',
      status: ExecutionStatus.paused('waiting'),
    });
    plan.addTask(blocked);
    plan.addTask(dependent);
    plan.addTask(paused);
    const bottlenecks = plan.analyzeBottlenecks();
    expect(bottlenecks.some((b) => b.issue === 'Task is blocked')).toBe(true);
    expect(bottlenecks.some((b) => b.issue.includes('Waiting for dependencies'))).toBe(true);
    expect(bottlenecks.some((b) => b.issue === 'Task is paused')).toBe(true);
  });

  it('analyzes no bottlenecks for healthy tasks', () => {
    const plan = createPlan();
    const t = new ExecutionTask({
      id: 't_ok',
      label: 'OK',
      description: 'D',
      status: ExecutionStatus.inProgress(),
    });
    plan.addTask(t);
    expect(plan.analyzeBottlenecks()).toHaveLength(0);
  });

  it('links goals and decisions without duplicates', () => {
    const plan = createPlan();
    plan.linkGoal({ goalId: 'g1', label: 'Goal', description: 'D' });
    plan.linkGoal({ goalId: 'g1', label: 'Goal again', description: 'D' });
    expect(plan.goalReferences).toHaveLength(1);
    plan.linkDecision({ decisionId: 'd1', title: 'Decision', selectedOption: 'A' });
    plan.linkDecision({ decisionId: 'd1', title: 'Decision again', selectedOption: 'B' });
    expect(plan.decisionReferences).toHaveLength(1);
    expect(plan.decisionReferences[0]!.selectedOption).toBe('A');
  });

  it('links knowledge nodes and memory ids without duplicates', () => {
    const plan = createPlan();
    plan.linkKnowledgeNode('kn_1');
    plan.linkKnowledgeNode('kn_1');
    expect(plan.knowledgeNodeIds).toEqual(['kn_1']);
    plan.linkMemory('mem_1');
    plan.linkMemory('mem_1');
    expect(plan.memoryIds).toEqual(['mem_1']);
  });

  it('adds tags without duplicates', () => {
    const plan = createPlan();
    plan.addTag('urgent');
    plan.addTag('urgent');
    expect(plan.tags).toEqual(['urgent']);
  });

  it('updates metadata by merging', () => {
    const plan = createPlan();
    plan.updateMetadata({ a: 1 });
    plan.updateMetadata({ b: 2 });
    expect(plan.metadata).toEqual({ a: 1, b: 2 });
  });

  it('recalculateProgress updates completed counts', () => {
    const plan = createPlan();
    const t = new ExecutionTask({ id: 't1', label: 'T', description: 'D' });
    plan.addTask(t);
    plan.recalculateProgress();
    expect(plan.progress.total).toBe(1);
  });

  it('returns planning level and metadata defaults', () => {
    const plan = new ExecutionPlan({
      id: 'p1',
      title: 'P',
      description: 'D',
      planningLevel: 'strategic',
    });
    expect(plan.planningLevel).toBe('strategic');
    expect(plan.metadata).toEqual({});
    expect(plan.createdAt).toBeInstanceOf(Date);
    expect(plan.updatedAt).toBeInstanceOf(Date);
    expect(plan.completedAt).toBeUndefined();
    expect(plan.toString()).toContain('strategic');
  });

  it('constructs with all optional params via constructor', () => {
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'M',
      description: 'D',
      planId: 'p1',
    });
    const plan = new ExecutionPlan({
      id: 'p1',
      title: 'P',
      description: 'D',
      planningLevel: 'daily',
      status: ExecutionStatus.ready(),
      priority: ExecutionPriority.high(),
      progress: new ExecutionProgress(1, 4),
      missions: [mission],
      tasks: [],
      dependencies: [],
      context: new ExecutionContext({ focusScore: 8 }),
      tags: ['x'],
      goalReferences: [],
      decisionReferences: [],
      knowledgeNodeIds: [],
      memoryIds: [],
      metadata: { k: 'v' },
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      completedAt: new Date('2026-01-03'),
    });
    expect(plan.status.isReady).toBe(true);
    expect(plan.priority.level).toBe('high');
    expect(plan.progress.percentage).toBe(25);
    expect(plan.missions).toHaveLength(1);
    expect(plan.context.focusScore).toBe(8);
    expect(plan.tags).toEqual(['x']);
    expect(plan.metadata.k).toBe('v');
    expect(plan.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(plan.completedAt?.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('emits decision-linked events', () => {
    const plan = createPlan();
    plan.linkDecision({ decisionId: 'd1', title: 'Decision', selectedOption: 'A' });
    const events = plan.pullEvents();
    expect(events.some((e) => e.type === 'plan.decision_linked')).toBe(true);
  });

  it('resolves dependencies identifying blocked tasks', () => {
    const plan = createPlan();
    const t = new ExecutionTask({ id: 't1', label: 'T', description: 'D' });
    t.addDependency(ExecutionDependency.finishToStart('t2', 't1', 'blocks'));
    plan.addTask(t);
    const resolved = plan.resolveDependencies();
    expect(resolved).toHaveLength(1);
    // resolveDependencies reports the dependency's sourceId (the blocker),
    // not its targetId (the blocked task itself)
    expect(resolved[0]!.blockedBy).toEqual(['t2']);
  });
});
