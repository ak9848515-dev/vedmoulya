import { describe, it, expect } from 'vitest';
import {
  planContentRule,
  planHasTasksOrMissionsRule,
  missionHasTasksRule,
  taskContentRule,
  taskDependenciesMetRule,
  validate,
} from '../rules/ExecutionRules.js';
import { ExecutionFactory } from '../factory/ExecutionFactory.js';
import { ExecutionPlan } from '../entities/ExecutionPlan.js';
import { ExecutionTask } from '../entities/ExecutionTask.js';
import { ExecutionMission } from '../entities/ExecutionMission.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';

describe('ExecutionRules', () => {
  describe('planContentRule', () => {
    it('passes for valid plan', () => {
      const plan = ExecutionPlan.create({
        id: 'p1',
        title: 'Valid Plan',
        description: 'Has both title and description',
      });
      expect(planContentRule(plan).valid).toBe(true);
    });

    it('fails for empty title', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: '', description: 'Has description' });
      expect(planContentRule(plan).valid).toBe(false);
    });

    it('fails for whitespace-only title', () => {
      const plan = ExecutionPlan.create({
        id: 'p1',
        title: '   ',
        description: 'Whitespace title',
      });
      expect(planContentRule(plan).valid).toBe(false);
    });

    it('fails for empty description', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Title', description: '' });
      expect(planContentRule(plan).valid).toBe(false);
    });

    it('fails for whitespace-only description', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Title', description: '   ' });
      expect(planContentRule(plan).valid).toBe(false);
    });

    it('fails for title exceeding 200 chars', () => {
      const longTitle = 'a'.repeat(201);
      const plan = ExecutionPlan.create({
        id: 'p1',
        title: longTitle,
        description: 'Too long title',
      });
      expect(planContentRule(plan).valid).toBe(false);
      expect(planContentRule(plan).message).toContain('200');
    });

    it('accepts title exactly 200 chars', () => {
      const exactTitle = 'a'.repeat(200);
      const plan = ExecutionPlan.create({
        id: 'p1',
        title: exactTitle,
        description: 'Exactly 200 chars',
      });
      expect(planContentRule(plan).valid).toBe(true);
    });
  });

  describe('planHasTasksOrMissionsRule', () => {
    it('passes for pending plan without tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });

    it('passes for in-progress plan with tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.medium(),
        }),
      );
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });

    it('passes for in-progress plan with missions', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.addMission(
        new ExecutionMission({
          id: 'm1',
          label: 'M',
          description: 'D',
          priority: ExecutionPriority.medium(),
          planId: 'p1',
        }),
      );
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });

    it('fails for in-progress plan with no tasks or missions', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(false);
      expect(planHasTasksOrMissionsRule(plan).message).toContain('task or mission');
    });

    it('passes for completed plan without tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.complete(ExecutionResult.success('Done'));
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });
  });

  describe('missionHasTasksRule', () => {
    it('passes for plan without missions', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      expect(missionHasTasksRule(plan).valid).toBe(true);
    });

    it('passes for mission with tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const mission = new ExecutionMission({
        id: 'm1',
        label: 'M',
        description: 'D',
        priority: ExecutionPriority.medium(),
        planId: 'p1',
      });
      plan.addMission(mission);
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.medium(),
          missionId: 'm1',
        }),
      );
      expect(missionHasTasksRule(plan).valid).toBe(true);
    });

    it('passes for pending mission without tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const mission = new ExecutionMission({
        id: 'm1',
        label: 'Empty Mission',
        description: 'No tasks',
        priority: ExecutionPriority.medium(),
        planId: 'p1',
      });
      plan.addMission(mission);
      expect(missionHasTasksRule(plan).valid).toBe(true);
    });
  });

  describe('taskContentRule', () => {
    it('passes for valid task', () => {
      const task = new ExecutionTask({ id: 't1', label: 'Valid Task', description: 'Has label' });
      expect(taskContentRule(task).valid).toBe(true);
    });

    it('fails for empty label', () => {
      const task = new ExecutionTask({ id: 't1', label: '', description: 'No label' });
      expect(taskContentRule(task).valid).toBe(false);
    });

    it('fails for whitespace-only label', () => {
      const task = new ExecutionTask({ id: 't1', label: '   ', description: 'Whitespace label' });
      expect(taskContentRule(task).valid).toBe(false);
    });
  });

  describe('taskDependenciesMetRule', () => {
    it('passes for task without dependencies', () => {
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      expect(taskDependenciesMetRule(task).valid).toBe(true);
    });

    it('passes for pending task with hard dependencies', () => {
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      task.addDependency(ExecutionDependency.finishToStart('t1', 't0', 'Depends on t0'));
      expect(taskDependenciesMetRule(task).valid).toBe(true);
    });

    it('fails for in-progress task with hard dependencies', () => {
      // The rule checks: task.status.isInProgress && task.hasHardDependencies
      // We simulate this by creating a task, adding a soft dependency (not blocking),
      // then starting it, then adding a hard dependency to simulate the state where
      // a task is already in-progress but gains a hard dependency.
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      // Add a soft dependency first to allow starting
      task.addDependency(ExecutionDependency.finishToStart('t1', 't0', 'Soft dep', false));
      task.start();
      // Now add a hard dependency
      task.addDependency(ExecutionDependency.finishToStart('t1', 't2', 'Hard dep'));
      expect(taskDependenciesMetRule(task).valid).toBe(false);
      expect(taskDependenciesMetRule(task).message).toContain('dependencies');
    });
  });

  describe('validate', () => {
    it('passes when all rules pass', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'Valid', description: 'Good plan' });
      const result = validate([planContentRule], plan);
      expect(result.valid).toBe(true);
    });

    it('fails on first rule that fails', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: '', description: '' });
      const result = validate([planContentRule, planHasTasksOrMissionsRule], plan);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('title');
    });

    it('returns valid for empty rules array', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const result = validate([], plan);
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('planContentRule handles null/undefined gracefully', () => {
      expect(planContentRule({} as ExecutionPlan).valid).toBe(false);
    });

    it('taskContentRule handles task with no label property', () => {
      expect(taskContentRule({ id: 't1' } as ExecutionTask).valid).toBe(false);
    });

    it('multiple validation rules compose correctly', () => {
      const plan = ExecutionPlan.create({
        id: 'p1',
        title: 'Valid Title',
        description: 'Valid description',
      });
      const result = validate([planContentRule], plan);
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    // ── Additional branch coverage ─────────────────────────────────

    it('planHasTasksOrMissionsRule passes for completed plan with tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.medium(),
        }),
      );
      plan.complete(ExecutionResult.success('Done'));
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });

    it('planHasTasksOrMissionsRule passes for completed plan with missions', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      plan.activate();
      plan.start();
      plan.addMission(
        new ExecutionMission({
          id: 'm1',
          label: 'M',
          description: 'D',
          priority: ExecutionPriority.medium(),
          planId: 'p1',
        }),
      );
      plan.complete(ExecutionResult.success('Done'));
      expect(planHasTasksOrMissionsRule(plan).valid).toBe(true);
    });

    it('missionHasTasksRule passes for completed mission with tasks', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: 'P', description: 'D' });
      const mission = new ExecutionMission({
        id: 'm1',
        label: 'M',
        description: 'D',
        priority: ExecutionPriority.medium(),
        planId: 'p1',
      });
      plan.addMission(mission);
      plan.addTask(
        new ExecutionTask({
          id: 't1',
          label: 'T',
          description: 'D',
          priority: ExecutionPriority.medium(),
          missionId: 'm1',
        }),
      );
      plan.activate();
      plan.start();
      plan.complete(ExecutionResult.success('Done'));
      expect(missionHasTasksRule(plan).valid).toBe(true);
    });

    it('taskDependenciesMetRule passes for completed task with dependencies', () => {
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      task.addDependency(ExecutionDependency.finishToStart('t1', 't0', 'Dep'));
      task.complete(ExecutionResult.success('Done'));
      expect(taskDependenciesMetRule(task).valid).toBe(true);
    });

    it('taskDependenciesMetRule passes for paused task with dependencies', () => {
      const task = new ExecutionTask({
        id: 't1',
        label: 'T',
        description: 'D',
        priority: ExecutionPriority.medium(),
      });
      task.addDependency(ExecutionDependency.finishToStart('t1', 't0', 'Dep'));
      task.pause('Blocked');
      expect(taskDependenciesMetRule(task).valid).toBe(true);
    });

    it('taskContentRule fails for whitespace label', () => {
      const task = new ExecutionTask({ id: 't1', label: '  ', description: 'Just whitespace' });
      expect(taskContentRule(task).valid).toBe(false);
    });

    it('taskContentRule passes for valid label with long description', () => {
      const longDesc = 'a'.repeat(1000);
      const task = new ExecutionTask({ id: 't1', label: 'Valid', description: longDesc });
      expect(taskContentRule(task).valid).toBe(true);
    });

    it('validate returns valid for empty rules array with invalid input', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: '', description: '' });
      const result = validate([], plan);
      expect(result.valid).toBe(true);
    });

    it('validate returns first failure only', () => {
      const plan = ExecutionPlan.create({ id: 'p1', title: '', description: '' });
      const result = validate([planContentRule, planHasTasksOrMissionsRule], plan);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('title');
    });
  });
});
