import { describe, it, expect } from 'vitest';
import { BusinessRecommendationService } from '../BusinessRecommendationService.js';

describe('BusinessRecommendationService', () => {
  let svc: BusinessRecommendationService;
  beforeEach(() => {
    svc = new BusinessRecommendationService();
  });

  it('generateRecommendations returns baseline when no triggers', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    // Always returns at least 2 baseline recs (strategy + operations)
    expect(recs.length).toBe(2);
    expect(recs.some((r) => r.title.includes('Business Strategy'))).toBe(true);
  });

  it('generates critical risk recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: true,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.category === 'risk')).toBe(true);
  });

  it('generates opportunity recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: true,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.category === 'opportunity')).toBe(true);
  });

  it('generates KPI recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 3,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.category === 'strategic')).toBe(true);
  });

  it('generates goal acceleration when progress < 30 and > 0', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 20,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.title.includes('Accelerate Goal'))).toBe(true);
  });

  it('does not generate goal acceleration when progress is 0', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 0,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.title.includes('Accelerate Goal'))).toBe(false);
  });

  it('does not generate goal acceleration when progress is 30 (boundary)', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 30,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    // goalProgress < 30 is false, so no acceleration rec
    expect(recs.some((r) => r.title.includes('Accelerate Goal'))).toBe(false);
  });

  it('generates delay recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: true,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.title.includes('Project Delays'))).toBe(true);
  });

  it('generates revenue decline recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: true,
      hasBlockedProjects: false,
    });
    expect(recs.some((r) => r.title.includes('Revenue Decline'))).toBe(true);
  });

  it('generates blocker recommendation', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: true,
    });
    expect(recs.some((r) => r.title.includes('Project Blockers'))).toBe(true);
  });

  it('generates all recommendations when all triggers active', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: true,
      hasHighValueOpps: true,
      kpisAtRisk: 2,
      goalProgress: 20,
      hasDelayedProjects: true,
      revenueDeclining: true,
      hasBlockedProjects: true,
    });
    // 7 triggered + 2 baseline = 9
    expect(recs.length).toBe(9);
  });

  it('prioritizeRecommendations returns sorted by priority and confidence', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    const prioritized = svc.prioritizeRecommendations(recs, 5);
    expect(prioritized.length).toBe(2);
    for (let i = 1; i < prioritized.length; i++) {
      expect(prioritized[i].priority).toBeLessThanOrEqual(prioritized[i - 1].priority);
    }
  });

  it('prioritizeRecommendations excludes dismissed', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: true,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    const dismissed = svc.dismissRecommendation(recs, recs[0].id);
    const prioritized = svc.prioritizeRecommendations(dismissed);
    expect(prioritized.some((r) => r.id === recs[0].id)).toBe(false);
  });

  it('dismissRecommendation sets isDismissed', () => {
    const recs = svc.generateRecommendations({
      hasCriticalRisks: false,
      hasHighValueOpps: false,
      kpisAtRisk: 0,
      goalProgress: 50,
      hasDelayedProjects: false,
      revenueDeclining: false,
      hasBlockedProjects: false,
    });
    const updated = svc.dismissRecommendation(recs, recs[0].id);
    expect(updated[0].isDismissed).toBe(true);
    expect(updated[1].isDismissed).toBe(false);
  });
});
