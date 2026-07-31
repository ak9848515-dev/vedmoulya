import { describe, it, expect } from 'vitest';
import { BusinessMetricsService } from '../BusinessMetricsService.js';

describe('BusinessMetricsService', () => {
  let svc: BusinessMetricsService;
  beforeEach(() => {
    svc = new BusinessMetricsService();
  });

  it('calculateBusinessScore with zero components', () => {
    const score = svc.calculateBusinessScore({
      revenueHealth: 0,
      expenseEfficiency: 0,
      profitability: 0,
      growthRate: 0,
      projectSuccessRate: 0,
      kpiAchievementRate: 0,
      riskExposure: 0,
      opportunityValue: 0,
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('calculateBusinessScore with perfect components', () => {
    const score = svc.calculateBusinessScore({
      revenueHealth: 100,
      expenseEfficiency: 100,
      profitability: 100,
      growthRate: 100,
      projectSuccessRate: 100,
      kpiAchievementRate: 100,
      riskExposure: 0,
      opportunityValue: 100,
    });
    expect(score).toBe(1000);
  });

  it('calculateBusinessScore with balanced values', () => {
    const score = svc.calculateBusinessScore({
      revenueHealth: 50,
      expenseEfficiency: 50,
      profitability: 50,
      growthRate: 50,
      projectSuccessRate: 50,
      kpiAchievementRate: 50,
      riskExposure: 50,
      opportunityValue: 50,
    });
    // (50*0.2 + 50*0.1 + 50*0.15 + 50*0.15 + 50*0.1 + 50*0.1 + 50*0.1 + 50*0.1) * 10 = 50 * 10 = 500
    expect(score).toBe(500);
  });

  it('aggregate returns complete metricsDTO', () => {
    const m = svc.aggregate({
      revenueHealth: 80,
      expenseEfficiency: 70,
      profitability: 60,
      growthRate: 50,
      projectSuccessRate: 90,
      kpiAchievementRate: 85,
      riskExposure: 20,
      opportunityValue: 75,
      executionVelocity: 65,
      goalProgress: 70,
    });
    expect(m.businessScore).toBeGreaterThan(0);
    expect(m.revenueHealth).toBe(80);
    expect(m.executionVelocity).toBe(65);
    expect(m.goalProgress).toBe(70);
    expect(m.overallProgress).toBeGreaterThan(0);
  });

  it('aggregate computes overallProgress as average of 3 components', () => {
    const m = svc.aggregate({
      revenueHealth: 100,
      expenseEfficiency: 0,
      profitability: 100,
      growthRate: 0,
      projectSuccessRate: 0,
      kpiAchievementRate: 0,
      riskExposure: 0,
      opportunityValue: 0,
      executionVelocity: 0,
      goalProgress: 0,
    });
    expect(m.overallProgress).toBeGreaterThan(0);
  });
});
