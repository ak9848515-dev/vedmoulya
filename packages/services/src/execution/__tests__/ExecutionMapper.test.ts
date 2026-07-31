import { describe, it, expect } from 'vitest';
import { ExecutionMapper } from '../ExecutionMapper.js';
import { ExecutionFactory } from '@vedmoulya/domain';
import {
  ExecutionPlan,
  ExecutionTask,
  ExecutionMission,
  ExecutionPriority,
  ExecutionStep,
  ExecutionSchedule,
  ExecutionResult,
} from '@vedmoulya/domain';

describe('ExecutionMapper', () => {
  it('maps plan to DTO', () => {
    const plan = ExecutionPlan.create({ id: 'plan_1', title: 'Test Plan', description: 'A test' });
    plan.activate();
    const dto = ExecutionMapper.toPlanDTO(plan);
    expect(dto.id).toBe('plan_1');
    expect(dto.title).toBe('Test Plan');
    expect(dto.status).toBe('ready');
    expect(dto.missions).toHaveLength(0);
    expect(dto.tasks).toHaveLength(0);
  });

  it('maps plan with missions and tasks', () => {
    const plan = ExecutionPlan.create({ id: 'plan_2', title: 'Big Plan', description: 'Full' });
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'Mission 1',
      description: 'Do it',
      priority: ExecutionPriority.medium(),
      planId: 'plan_2',
    });
    const task = new ExecutionTask({
      id: 'task_1',
      label: 'Task 1',
      description: 'Step',
      priority: ExecutionPriority.high(),
    });
    plan.addMission(mission);
    plan.addTask(task);
    const dto = ExecutionMapper.toPlanDTO(plan);
    expect(dto.missions).toHaveLength(1);
    expect(dto.tasks).toHaveLength(1);
    expect(dto.progress).toBeDefined();
  });

  it('maps mission to DTO', () => {
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'Mission 1',
      description: 'Do it',
      priority: ExecutionPriority.medium(),
      planId: 'plan_1',
    });
    const dto = ExecutionMapper.toMissionDTO(mission);
    expect(dto.id).toBe('mis_1');
    expect(dto.label).toBe('Mission 1');
  });

  it('maps task to DTO', () => {
    const task = new ExecutionTask({
      id: 'task_1',
      label: 'Task 1',
      description: 'Step',
      priority: ExecutionPriority.high(),
    });
    const dto = ExecutionMapper.toTaskDTO(task);
    expect(dto.id).toBe('task_1');
    expect(dto.label).toBe('Task 1');
    expect(dto.priority.level).toBe('high');
    expect(dto.priority.score).toBe(7);
  });

  it('maps plan list to DTO', () => {
    const plan1 = ExecutionPlan.create({ id: 'a', title: 'A', description: 'First' });
    const plan2 = ExecutionPlan.create({ id: 'b', title: 'B', description: 'Second' });
    const list = ExecutionMapper.toListDTO([plan1, plan2], 5, 1, 20);
    expect(list.data).toHaveLength(2);
    expect(list.total).toBe(5);
    expect(list.page).toBe(1);
    expect(list.limit).toBe(20);
  });

  // ── Step DTO ──────────────────────────────────────────────────

  it('maps step to DTO', () => {
    const step = new ExecutionStep({
      id: 'step_1',
      label: 'Setup',
      description: 'Initial setup',
      order: 1,
    });
    const dto = ExecutionMapper.toStepDTO(step);
    expect(dto.id).toBe('step_1');
    expect(dto.label).toBe('Setup');
    expect(dto.order).toBe(1);
    expect(dto.estimatedDuration).toBeDefined();
  });

  // ── Stats DTO ──────────────────────────────────────────────────

  it('maps stats to DTO', () => {
    const dto = ExecutionMapper.toStatsDTO({
      totalPlans: 10,
      activePlans: 5,
      completedPlans: 3,
      overduePlans: 1,
      completionRate: 30,
    });
    expect(dto.totalPlans).toBe(10);
    expect(dto.activePlans).toBe(5);
    expect(dto.completedPlans).toBe(3);
    expect(dto.completionRate).toBe(30);
  });

  // ── Daily Plan DTO ────────────────────────────────────────────

  it('maps daily plan to DTO', () => {
    const dto = ExecutionMapper.toDailyPlanDTO(
      {
        planId: 'p1',
        tasks: [{ taskId: 't1', label: 'Task 1', estimatedDuration: 30, priority: 'high' }],
        totalEstimatedMinutes: 30,
        priority: 'high',
      },
      '2026-08-01',
    );
    expect(dto.planId).toBe('p1');
    expect(dto.date).toBe('2026-08-01');
    expect(dto.tasks).toHaveLength(1);
    expect(dto.totalEstimatedMinutes).toBe(30);
  });

  it('maps daily plan with mission labels', () => {
    const dto = ExecutionMapper.toDailyPlanDTO(
      {
        planId: 'p1',
        tasks: [
          {
            taskId: 't1',
            label: 'Task 1',
            estimatedDuration: 30,
            priority: 'high',
            missionLabel: 'Mission 1',
          },
        ],
        totalEstimatedMinutes: 30,
        priority: 'high',
      },
      '2026-08-01',
    );
    expect(dto.tasks[0]!.missionLabel).toBe('Mission 1');
  });

  // ── Weekly Review DTO ─────────────────────────────────────────

  it('maps weekly review to DTO', () => {
    const dto = ExecutionMapper.toWeeklyReviewDTO({
      planId: 'p1',
      completedTasks: 3,
      totalTasks: 5,
      completionRate: 60,
      bottlenecks: [{ entityId: 't1', entityType: 'task', issue: 'Blocked' }],
      recommendations: ['Focus on quick wins'],
    });
    expect(dto.planId).toBe('p1');
    expect(dto.completedTasks).toBe(3);
    expect(dto.completionRate).toBe(60);
    expect(dto.weekStart).toBeDefined();
    expect(dto.weekEnd).toBeDefined();
    expect(dto.bottlenecks).toHaveLength(1);
    expect(dto.recommendations).toContain('Focus on quick wins');
  });

  it('maps weekly review with empty bottlenecks', () => {
    const dto = ExecutionMapper.toWeeklyReviewDTO({
      planId: 'p1',
      completedTasks: 0,
      totalTasks: 0,
      completionRate: 0,
      bottlenecks: [],
      recommendations: [],
    });
    expect(dto.bottlenecks).toHaveLength(0);
    expect(dto.recommendations).toHaveLength(0);
  });

  // ── Optional Field Coverage ────────────────────────────────────

  it('maps task with schedule information', () => {
    const schedule = new ExecutionSchedule(
      new Date('2026-08-01T09:00'),
      new Date('2026-08-01T10:00'),
      60,
    );
    const task = new ExecutionTask({
      id: 'task_1',
      label: 'Scheduled Task',
      description: 'With time',
      priority: ExecutionPriority.high(),
      estimatedDuration: 60,
      schedule,
    });
    const dto = ExecutionMapper.toTaskDTO(task);
    expect(dto.schedule).toBeDefined();
    expect(dto.schedule!.estimatedDuration).toBe(60);
  });

  it('maps task without schedule', () => {
    const task = new ExecutionTask({
      id: 'task_1',
      label: 'Unscheduled',
      description: 'No time',
      priority: ExecutionPriority.medium(),
    });
    const dto = ExecutionMapper.toTaskDTO(task);
    expect(dto.schedule).toBeUndefined();
  });

  it('maps mission with target date', () => {
    const target = new Date('2026-09-01');
    const mission = new ExecutionMission({
      id: 'mis_1',
      label: 'M',
      description: 'D',
      priority: ExecutionPriority.medium(),
      planId: 'p1',
      targetDate: target,
    });
    const dto = ExecutionMapper.toMissionDTO(mission);
    expect(dto.targetDate).toBeDefined();
    expect(dto.targetDate).toContain('2026-09-01');
  });

  it('maps plan with context', () => {
    const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
    plan.updateContext({ energyLevel: 80, timeAvailable: 240, location: 'office' });
    const dto = ExecutionMapper.toPlanDTO(plan);
    expect(dto.context.energyLevel).toBe(80);
    expect(dto.context.location).toBe('office');
  });

  it('maps completed plan with completedAt', () => {
    const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
    plan.activate();
    plan.start();
    plan.complete(ExecutionResult.success('All done'));
    const dto = ExecutionMapper.toPlanDTO(plan);
    expect(dto.completedAt).toBeDefined();
  });
});
