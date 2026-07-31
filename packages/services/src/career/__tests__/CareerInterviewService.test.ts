import { describe, it, expect } from 'vitest';
import { CareerInterviewService } from '../CareerInterviewService.js';

describe('CareerInterviewService', () => {
  it('assesses readiness with all scores', () => {
    const svc = new CareerInterviewService();
    const cats = svc.getDefaultCategories();
    const r = svc.assessReadiness(80, 70, 60, 2, cats);
    expect(r.overallScore).toBe(70);
    expect(r.behavioralScore).toBe(80);
    expect(r.technicalScore).toBe(70);
    expect(r.systemDesignScore).toBe(60);
    expect(r.mockInterviewCount).toBe(2);
  });

  it('identifies weak areas below 50', () => {
    const svc = new CareerInterviewService();
    const cats = [
      { name: 'Weak', score: 30, questionCount: 5, sampleQuestions: [], resources: [] },
      { name: 'Strong', score: 80, questionCount: 5, sampleQuestions: [], resources: [] },
    ];
    const r = svc.assessReadiness(50, 50, 50, 0, cats);
    expect(r.weakAreas).toContain('Weak');
    expect(r.strongAreas).toContain('Strong');
  });

  it('generates practice recommendations for low scores', () => {
    const svc = new CareerInterviewService();
    const r = svc.assessReadiness(30, 30, 30, 0, svc.getDefaultCategories());
    expect(r.recommendedPractice.length).toBeGreaterThanOrEqual(4);
  });

  it('generates well-prepared message for high scores', () => {
    const svc = new CareerInterviewService();
    const r = svc.assessReadiness(90, 90, 80, 5, svc.getDefaultCategories());
    expect(r.recommendedPractice.some((p) => p.includes('well-prepared'))).toBe(true);
  });

  it('sets lastPracticed when mockInterviewCount > 0', () => {
    const svc = new CareerInterviewService();
    const r = svc.assessReadiness(50, 50, 50, 1, []);
    expect(r.lastPracticed).toBeDefined();
  });

  it('lastPracticed is undefined with no mock interviews', () => {
    const svc = new CareerInterviewService();
    const r = svc.assessReadiness(50, 50, 50, 0, []);
    expect(r.lastPracticed).toBeUndefined();
  });

  it('getDefaultCategories returns 3 categories', () => {
    expect(new CareerInterviewService().getDefaultCategories()).toHaveLength(3);
  });

  it('recordMockInterview increments count', () => {
    const svc = new CareerInterviewService();
    const prev = svc.assessReadiness(50, 50, 50, 2, []);
    const next = svc.recordMockInterview(prev);
    expect(next.mockInterviewCount).toBe(3);
  });
});
