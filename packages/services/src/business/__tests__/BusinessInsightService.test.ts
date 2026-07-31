import { describe, it, expect } from 'vitest';
import { BusinessInsightService } from '../BusinessInsightService.js';

describe('BusinessInsightService', () => {
  let svc: BusinessInsightService;
  beforeEach(() => {
    svc = new BusinessInsightService();
  });

  it('generateInsights returns empty when no triggers', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights).toEqual([]);
  });

  it('generates KPI warning when kpisAtRisk >= 3', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 3,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'kpis')).toBe(true);
    expect(insights.find((i) => i.source === 'kpis')?.type).toBe('warning');
  });

  it('does not generate KPI warning when kpisAtRisk < 3', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 2,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'kpis')).toBe(false);
  });

  it('generates critical risk insight', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: true,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'risks')).toBe(true);
    expect(insights.find((i) => i.source === 'risks')?.severity).toBe('critical');
  });

  it('generates goal achievement when progress > 80', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 90,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'goals')).toBe(true);
    expect(insights.find((i) => i.source === 'goals')?.type).toBe('achievement');
  });

  it('generates revenue growth achievement when growth > 20', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 25,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'finance')).toBe(true);
  });

  it('generates opportunity prediction when available', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: true,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights.some((i) => i.source === 'opportunities')).toBe(true);
    expect(insights.find((i) => i.source === 'opportunities')?.type).toBe('prediction');
  });

  it('generates project delay warning', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 50,
      revenueGrowth: 10,
      hasDelayedProjects: true,
    });
    expect(insights.some((i) => i.source === 'execution')).toBe(true);
  });

  it('generates all insights when all conditions met', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 3,
      hasCriticalRisks: true,
      hasNewOpportunities: true,
      goalProgress: 90,
      revenueGrowth: 25,
      hasDelayedProjects: true,
    });
    expect(insights.length).toBe(6);
  });

  it('sorts insights by severity (critical first)', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 3,
      hasCriticalRisks: true,
      hasNewOpportunities: true,
      goalProgress: 90,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    expect(insights[0].severity).toBe('critical');
    expect(insights[1].severity).toBe('warning');
  });

  it('getActionableInsights filters actionable', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 3,
      hasCriticalRisks: true,
      hasNewOpportunities: true,
      goalProgress: 90,
      revenueGrowth: 10,
      hasDelayedProjects: false,
    });
    const actionable = svc.getActionableInsights(insights);
    expect(actionable.every((i) => i.actionable)).toBe(true);
  });

  it('sort fallback handles unknown severity', () => {
    const insights = svc.generateInsights({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      goalProgress: 95,
      revenueGrowth: 25,
      hasDelayedProjects: false,
    });
    // goalProgress > 80 and revenueGrowth > 20 generate 2 insights with severity 'positive'
    expect(insights.length).toBe(2);
    expect(insights.every((i) => i.severity === 'positive')).toBe(true);
  });
});
