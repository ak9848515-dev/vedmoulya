import { describe, expect, it } from 'vitest';
import { GoalClassificationService } from '../services/GoalClassificationService.js';
import { GoalUnderstandingService } from '../services/GoalUnderstandingService.js';
import type { Goal } from '../../types/goal-types.js';

const understanding = new GoalUnderstandingService();
const classification = new GoalClassificationService();

function sampleGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalId: 'goal_sample',
    title: 'Grow client revenue',
    description: 'Sell retainers and grow recurring revenue.',
    category: 'revenue',
    business: ['sales'],
    priority: 'high',
    urgency: 0.7,
    importance: 0.8,
    complexity: 'moderate',
    estimatedEffort: 30,
    status: 'proposed',
    confidence: 0.5,
    goalScore: 0,
    successCriteria: [],
    milestones: [],
    dependencies: [],
    childGoalIds: [],
    tags: ['revenue'],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('GoalClassificationService', () => {
  it('classifies business domain, capabilities, context, and risk', () => {
    const goal = sampleGoal();
    const analysis = understanding.analyze(goal, goal.goalId);
    const result = classification.classify(goal, analysis, { effortHours: 30 });
    expect(result.businessDomain.length).toBeGreaterThan(0);
    expect(result.requiredCapabilities).toContain('reasoning');
    expect(result.requiredContext).toContain('business_rules');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.riskScore).toBeLessThanOrEqual(1);
    expect(['very_low', 'low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
  });

  it('escalates complexity with more tasks', () => {
    const goal = sampleGoal();
    const analysis = understanding.analyze(goal, goal.goalId);
    const simple = classification.classify(goal, analysis, { taskCountHint: 2 });
    const complex = classification.classify(goal, analysis, { taskCountHint: 14 });
    const rank = { simple: 1, moderate: 2, complex: 3, very_complex: 4 };
    expect(rank[complex.complexity]).toBeGreaterThanOrEqual(rank[simple.complexity]);
  });

  it('raises risk with dependency load and lower confidence', () => {
    const goal = sampleGoal({
      dependencies: ['goal_a', 'goal_b', 'goal_c', 'goal_d'],
      confidence: 0.2,
    });
    const analysis = understanding.analyze(goal, goal.goalId);
    const result = classification.classify(goal, analysis, { effortHours: 30 });
    expect(result.riskScore).toBeGreaterThan(0.3);
  });

  it('maps risk bands correctly', () => {
    expect(classification.riskLevel(0.1)).toBe('very_low');
    expect(classification.riskLevel(0.3)).toBe('low');
    expect(classification.riskLevel(0.5)).toBe('medium');
    expect(classification.riskLevel(0.7)).toBe('high');
    expect(classification.riskLevel(0.9)).toBe('critical');
  });

  it('produces finite token and cost ranges', () => {
    const goal = sampleGoal();
    const analysis = understanding.analyze(goal, goal.goalId);
    const result = classification.classify(goal, analysis, { effortHours: 30 });
    expect(result.estimatedTokenRange.min).toBeGreaterThan(0);
    expect(result.estimatedTokenRange.max).toBeGreaterThan(result.estimatedTokenRange.min);
    expect(result.estimatedCostRangeUsd.max).toBeGreaterThan(result.estimatedCostRangeUsd.min);
  });
});
