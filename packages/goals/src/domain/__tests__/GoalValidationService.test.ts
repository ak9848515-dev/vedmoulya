import { describe, expect, it } from 'vitest';
import { GoalValidationService } from '../services/GoalValidationService.js';
import { GoalUnderstandingService } from '../services/GoalUnderstandingService.js';
import { GoalClassificationService } from '../services/GoalClassificationService.js';
import type { Goal, Task } from '../../types/goal-types.js';

const validation = new GoalValidationService();

function completeGoal(overrides: Partial<Goal> = {}): Goal {
  const goal: Goal = {
    goalId: 'goal_v',
    title: 'Launch a client blog',
    description: 'Publish a weekly blog for a client for four weeks.',
    category: 'business',
    business: ['content'],
    priority: 'high',
    urgency: 0.6,
    importance: 0.8,
    complexity: 'moderate',
    estimatedEffort: 12,
    status: 'accepted',
    confidence: 0.8,
    goalScore: 0.7,
    successCriteria: [
      {
        criterionId: 'c1',
        definition: 'Publish weekly',
        validation: 'Check calendar',
        completionCriteria: ['4 posts'],
        expectedOutcome: 'Pipeline running',
        met: false,
      },
    ],
    milestones: [
      {
        milestoneId: 'm1',
        title: 'Stage 1',
        description: 'First stage',
        taskIds: [],
        order: 1,
        achieved: false,
      },
    ],
    dependencies: [],
    childGoalIds: [],
    tags: ['blog'],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  // Default: attach a classification via the real services (unless the
  // caller explicitly set `classification` — including `undefined`).
  if (!('classification' in overrides) && !goal.classification) {
    const analysis = new GoalUnderstandingService().analyze(goal, goal.goalId);
    goal.classification = new GoalClassificationService().classify(goal, analysis, {
      effortHours: 12,
    });
  }
  return goal;
}

function sampleTask(id: string, deps: string[]): Task {
  return {
    taskId: id,
    goalId: 'goal_v',
    title: `Task ${id}`,
    capability: 'reasoning',
    priority: 50,
    businessValue: 0.5,
    urgency: 0.5,
    importance: 0.5,
    risk: 0.2,
    confidence: 0.8,
    estimatedTokens: 500,
    estimatedCostUsd: 0.05,
    estimatedTimeMs: 1000,
    dependencies: deps,
    parallelEligible: false,
    flowType: 'sequential',
    retryPolicy: { maxRetries: 2, retryDelayMs: 1000, retryableFailures: [] },
    validationRules: [],
    status: 'proposed',
    subTaskIds: [],
    order: 1,
    critical: false,
    slack: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('GoalValidationService', () => {
  it('passes a fully-formed goal with a valid task graph', () => {
    const goal = completeGoal();
    const tasks = [sampleTask('t1', []), sampleTask('t2', ['t1'])];
    const result = validation.validate(goal, tasks);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.checks.length).toBe(8);
  });

  it('fails on missing title/description', () => {
    const goal = completeGoal({ title: '', description: 'x' });
    const result = validation.validate(goal, []);
    expect(result.passed).toBe(false);
    const identity = result.checks.find((c) => c.check === 'goal_identity');
    expect(identity?.passed).toBe(false);
  });

  it('fails when success criteria are incomplete', () => {
    const goal = completeGoal({
      successCriteria: [
        {
          criterionId: 'c_bad',
          definition: 'Only a definition',
          validation: '',
          completionCriteria: [],
          expectedOutcome: '',
          met: false,
        },
      ],
    });
    const result = validation.validate(goal, []);
    const criteria = result.checks.find((c) => c.check === 'success_criteria');
    expect(criteria?.passed).toBe(false);
  });

  it('flags an unclassified goal', () => {
    const goal = completeGoal({ classification: undefined });
    const result = validation.validate(goal, []);
    const classification = result.checks.find((c) => c.check === 'classification');
    expect(classification?.passed).toBe(false);
  });

  it('flags a cyclic task graph', () => {
    const goal = completeGoal();
    const tasks = [sampleTask('x1', ['x2']), sampleTask('x2', ['x1'])];
    const result = validation.validate(goal, tasks);
    const taskGraph = result.checks.find((c) => c.check === 'task_graph');
    expect(taskGraph?.passed).toBe(false);
  });

  it('flags missing task plan', () => {
    const goal = completeGoal();
    const result = validation.validate(goal, []);
    const taskGraph = result.checks.find((c) => c.check === 'task_graph');
    expect(taskGraph?.passed).toBe(false);
  });
});
