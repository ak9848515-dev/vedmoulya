import { describe, it, expect } from 'vitest';
import { LearningRevisionService } from '../LearningRevisionService.js';
import type { RevisionItemDTO } from '../LearningDTO.js';

function makeItem(overrides: Partial<RevisionItemDTO> = {}): RevisionItemDTO {
  return {
    id: 'r1',
    topic: 'React',
    title: 'React Basics',
    dueDate: new Date(Date.now() - 3600000).toISOString(),
    importance: 5,
    estimatedMinutes: 30,
    status: 'pending',
    confidence: 40,
    ...overrides,
  };
}

describe('LearningRevisionService', () => {
  it('buildSchedule categorizes due today', () => {
    const svc = new LearningRevisionService();
    const items = [makeItem()];
    const schedule = svc.buildSchedule(items);
    expect(schedule.dueToday.length).toBe(1);
    expect(schedule.totalForReview).toBe(1);
  });

  it('buildSchedule categorizes due this week', () => {
    const svc = new LearningRevisionService();
    const future = new Date(Date.now() + 3 * 24 * 3600000).toISOString();
    const items = [makeItem({ dueDate: future })];
    const schedule = svc.buildSchedule(items);
    expect(schedule.dueToday.length).toBe(0);
    expect(schedule.dueThisWeek.length).toBe(1);
  });

  it('buildSchedule categorizes upcoming', () => {
    const svc = new LearningRevisionService();
    const far = new Date(Date.now() + 14 * 24 * 3600000).toISOString();
    const items = [makeItem({ dueDate: far })];
    const schedule = svc.buildSchedule(items);
    expect(schedule.upcoming.length).toBe(1);
  });

  it('buildSchedule excludes completed items', () => {
    const svc = new LearningRevisionService();
    const items = [makeItem({ status: 'completed' })];
    const schedule = svc.buildSchedule(items);
    expect(schedule.dueToday.length).toBe(0);
  });

  it('markCompleted updates item', () => {
    const svc = new LearningRevisionService();
    const items = [makeItem()];
    const updated = svc.markCompleted(items, 'r1');
    expect(updated[0].status).toBe('completed');
    expect(updated[0].lastReviewed).toBeDefined();
  });

  it('getRetentionIndicators calculates decay', () => {
    const svc = new LearningRevisionService();
    const recentlyReviewed = new Date(Date.now() - 3600000).toISOString();
    const items = [makeItem({ lastReviewed: recentlyReviewed })];
    const indicators = svc.getRetentionIndicators(items);
    expect(indicators[0].currentRetention).toBeGreaterThan(80);
    expect(indicators[0].riskLevel).toBe('low');
  });

  it('getRetentionIndicators high risk for old items', () => {
    const svc = new LearningRevisionService();
    const old = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    const items = [makeItem({ lastReviewed: old })];
    const indicators = svc.getRetentionIndicators(items);
    expect(indicators[0].riskLevel).toBe('high');
    expect(indicators[0].currentRetention).toBeLessThan(40);
  });

  it('getRetentionIndicators handles no lastReviewed', () => {
    const svc = new LearningRevisionService();
    const items = [makeItem({ lastReviewed: undefined })];
    const indicators = svc.getRetentionIndicators(items);
    expect(indicators[0].daysSinceReview).toBe(999);
    expect(indicators[0].currentRetention).toBe(0);
  });

  it('getHighRiskTopics filters high risk', () => {
    const svc = new LearningRevisionService();
    const old = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    const recent = new Date().toISOString();
    const items = [
      makeItem({ id: 'r1', lastReviewed: old, confidence: 20 }),
      makeItem({ id: 'r2', lastReviewed: recent, confidence: 80 }),
    ];
    const indicators = svc.getRetentionIndicators(items);
    const highRisk = svc.getHighRiskTopics(indicators);
    expect(highRisk.length).toBe(1);
  });
});
