import { describe, it, expect } from 'vitest';
import { CareerMarketInsightService } from '../CareerMarketInsightService.js';

describe('CareerMarketInsightService', () => {
  it('returns market insights for technology', () => {
    const svc = new CareerMarketInsightService();
    const m = svc.getMarketInsights('Technology');
    expect(m.industry).toBe('Technology');
    expect(m.trends).toHaveLength(3);
    expect(m.emergingSkills).toContain('AI/ML');
    expect(m.certificationDemand).toHaveLength(3);
    expect(m.salaryInsights).toHaveLength(2);
    expect(m.hiringTrends).toHaveLength(2);
    expect(m.topEmployers).toContain('Google');
  });

  it('returns market insights for finance', () => {
    const svc = new CareerMarketInsightService();
    const m = svc.getMarketInsights('Finance');
    expect(m.emergingSkills).toContain('Blockchain');
    expect(m.topEmployers).toContain('JPMorgan');
  });

  it('returns default insights for unknown industry', () => {
    const svc = new CareerMarketInsightService();
    const m = svc.getMarketInsights('Unknown');
    expect(m.emergingSkills).toContain('Digital Literacy');
    expect(m.topEmployers).toContain('Top Industry Leaders');
  });

  it('declining skills are always the same', () => {
    const svc = new CareerMarketInsightService();
    expect(svc.getMarketInsights('Tech').decliningSkills).toHaveLength(3);
  });
});
