import { describe, it, expect } from 'vitest';
import { BusinessStrategyService } from '../BusinessStrategyService.js';
import type { BusinessStrategyDTO } from '../BusinessDTO.js';

describe('BusinessStrategyService', () => {
  let svc: BusinessStrategyService;
  beforeEach(() => {
    svc = new BusinessStrategyService();
  });

  const makeStrategy = (
    id: string,
    status: BusinessStrategyDTO['status'] = 'draft',
  ): BusinessStrategyDTO => ({
    id,
    title: `Strategy ${id}`,
    description: 'desc',
    type: 'growth',
    goals: [],
    initiatives: [],
    progress: 0,
    status,
    riskLevel: 'medium',
    estimatedInvestment: 10000,
    expectedROI: 20,
  });

  it('getStrategies returns empty for new user', () => {
    expect(svc.getStrategies('user1')).toEqual([]);
  });

  it('addStrategy stores and retrieves', () => {
    svc.addStrategy('user1', makeStrategy('s1'));
    expect(svc.getStrategies('user1').length).toBe(1);
    expect(svc.getStrategy('user1', 's1')?.title).toBe('Strategy s1');
  });

  it('updateStrategy merges', () => {
    svc.addStrategy('user1', makeStrategy('s1'));
    const u = svc.updateStrategy('user1', 's1', { progress: 50 });
    expect(u.progress).toBe(50);
  });

  it('updateStrategy throws for missing', () => {
    expect(() => svc.updateStrategy('user1', 'missing', {})).toThrow('Strategy not found');
  });

  it('deleteStrategy removes', () => {
    svc.addStrategy('user1', makeStrategy('s1'));
    svc.deleteStrategy('user1', 's1');
    expect(svc.getStrategies('user1')).toEqual([]);
  });

  it('getActiveStrategies filters active', () => {
    svc.addStrategy('user1', makeStrategy('s1', 'active'));
    svc.addStrategy('user1', makeStrategy('s2', 'draft'));
    expect(svc.getActiveStrategies('user1').length).toBe(1);
  });
});
