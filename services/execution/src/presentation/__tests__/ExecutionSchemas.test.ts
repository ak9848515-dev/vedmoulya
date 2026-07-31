import { describe, it, expect } from 'vitest';
import {
  createPlanSchema,
  updatePlanSchema,
  createMissionSchema,
  createTaskSchema,
  addStepSchema,
  scheduleTasksSchema,
  completeTaskSchema,
  reportExecutionSchema,
  adaptPlanSchema,
  pausePlanSchema,
  cancelPlanSchema,
  paginationQuery,
  searchQuery,
} from '../validation/ExecutionSchemas.js';

describe('ExecutionSchemas', () => {
  describe('createPlanSchema', () => {
    it('accepts valid plan input', () => {
      const result = createPlanSchema.safeParse({ title: 'Test Plan', description: 'A test' });
      expect(result.success).toBe(true);
    });

    it('accepts plan with all optional fields', () => {
      const result = createPlanSchema.safeParse({
        title: 'Full Plan',
        description: 'Full',
        planningLevel: 'strategic',
        priorityScore: 8,
        tags: ['urgent'],
        metadata: { key: 'val' },
        goalReferences: [{ goalId: 'g1', label: 'Goal 1', description: 'A goal' }],
        decisionReferences: [{ decisionId: 'd1', title: 'Decision 1', selectedOption: 'opt1' }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const result = createPlanSchema.safeParse({ title: '', description: 'desc' });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = createPlanSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects invalid planning level', () => {
      const result = createPlanSchema.safeParse({
        title: 'T',
        description: 'D',
        planningLevel: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePlanSchema', () => {
    it('accepts partial update', () => {
      const result = updatePlanSchema.safeParse({ title: 'Updated' });
      expect(result.success).toBe(true);
    });

    it('rejects empty title', () => {
      const result = updatePlanSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('createMissionSchema', () => {
    it('accepts valid mission', () => {
      const result = createMissionSchema.safeParse({ label: 'Mission 1', description: 'Do it' });
      expect(result.success).toBe(true);
    });

    it('accepts mission with target date', () => {
      const result = createMissionSchema.safeParse({
        label: 'M1',
        description: 'D',
        targetDate: '2026-08-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing label', () => {
      const result = createMissionSchema.safeParse({ description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('createTaskSchema', () => {
    it('accepts valid task', () => {
      const result = createTaskSchema.safeParse({ label: 'Task 1', description: 'Do it' });
      expect(result.success).toBe(true);
    });

    it('accepts task with estimated duration', () => {
      const result = createTaskSchema.safeParse({
        label: 'T1',
        description: 'D',
        estimatedDuration: 60,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid duration (0)', () => {
      const result = createTaskSchema.safeParse({
        label: 'T1',
        description: 'D',
        estimatedDuration: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('addStepSchema', () => {
    it('accepts valid step', () => {
      const result = addStepSchema.safeParse({ label: 'Step 1' });
      expect(result.success).toBe(true);
    });

    it('rejects empty label', () => {
      const result = addStepSchema.safeParse({ label: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('completeTaskSchema', () => {
    it('accepts valid completion', () => {
      const result = completeTaskSchema.safeParse({ result: 'success', description: 'Done' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid result value', () => {
      const result = completeTaskSchema.safeParse({ result: 'invalid', description: 'D' });
      expect(result.success).toBe(false);
    });
  });

  describe('reportExecutionSchema', () => {
    it('accepts valid report', () => {
      const result = reportExecutionSchema.safeParse({
        result: { result: 'success', description: 'Done' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('cancelPlanSchema', () => {
    it('accepts cancel with reason', () => {
      const result = cancelPlanSchema.safeParse({ reason: 'Changed mind' });
      expect(result.success).toBe(true);
    });

    it('rejects cancel without reason', () => {
      const result = cancelPlanSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('paginationQuery', () => {
    it('defaults page and limit', () => {
      const result = paginationQuery.safeParse({});
      expect(result.success).toBe(true);
      expect(result.data!.page).toBe(1);
      expect(result.data!.limit).toBe(20);
    });

    it('coerces string numbers', () => {
      const result = paginationQuery.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      expect(result.data!.page).toBe(2);
      expect(result.data!.limit).toBe(10);
    });
  });

  describe('searchQuery', () => {
    it('accepts query with filters', () => {
      const result = searchQuery.safeParse({
        q: 'test',
        status: 'in_progress',
        planningLevel: 'daily',
      });
      expect(result.success).toBe(true);
      expect(result.data!.q).toBe('test');
    });
  });
});
