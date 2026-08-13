import { describe, expect, it } from 'vitest';
import { GoalUnderstandingService } from '../services/GoalUnderstandingService.js';

describe('GoalUnderstandingService', () => {
  const service = new GoalUnderstandingService();

  it('detects a revenue category goal from keywords', () => {
    const result = service.analyze(
      {
        title: 'Grow recurring revenue by 25%',
        description: 'Analyze the sales pipeline and increase retainers.',
      },
      'goal_1',
    );
    expect(result.category).toBe('revenue');
    expect(result.categoryConfidence).toBeGreaterThan(0);
    expect(result.capabilityHints).toContain('reasoning');
  });

  it('detects a learning category goal from keywords', () => {
    const result = service.analyze(
      {
        title: 'Master TypeScript',
        description: 'Complete a course, summarize the key concepts, and pass the exam.',
      },
      'goal_2',
    );
    expect(result.category).toBe('learning');
    expect(result.capabilityHints).toContain('summarization');
    // Word-boundary matching: "TypeScript" must not trigger the "script" coding hint.
    expect(result.capabilityHints).not.toContain('coding');
  });

  it('respects an explicit category', () => {
    const result = service.analyze(
      { title: 'Read 12 books', description: 'Personal reading habit.', category: 'personal' },
      'goal_3',
    );
    expect(result.category).toBe('personal');
    expect(result.categoryConfidence).toBe(0.95);
  });

  it('falls back to custom for unknown text', () => {
    const result = service.analyze(
      { title: 'Organize the garage', description: 'Sort and label shelves.' },
      'goal_4',
    );
    expect(result.category).toBe('custom');
  });

  it('suggests critical priority on urgency signals', () => {
    const result = service.analyze(
      { title: 'Fix outage immediately', description: 'Production is down asap.' },
      'goal_5',
    );
    expect(result.suggestedPriority).toBe('critical');
  });

  it('collects context hints from text', () => {
    const result = service.analyze(
      {
        title: 'Client proposal research',
        description: 'Research the client market before writing the proposal.',
      },
      'goal_6',
    );
    expect(result.contextHints).toContain('client_data');
  });

  it('does not over-match substring keywords', () => {
    const result = service.analyze(
      {
        title: 'Renew the subscription plan',
        description: 'Manage the manuscript index for the publication.',
      },
      'goal_7',
    );
    expect(result.capabilityHints).not.toContain('coding');
  });
});
