import { describe, it, expect } from 'vitest';
import { BusinessRiskService } from '../BusinessRiskService.js';
import type { BusinessRiskDTO } from '../BusinessDTO.js';

describe('BusinessRiskService', () => {
  let svc: BusinessRiskService;
  beforeEach(() => {
    svc = new BusinessRiskService();
  });

  const makeRisk = (id: string, score: number): BusinessRiskDTO => ({
    id,
    title: `Risk ${id}`,
    description: 'desc',
    category: 'financial',
    likelihood: 3,
    impact: 3,
    riskScore: score,
    status: 'identified',
    mitigationPlan: 'mitigate',
    owner: 'me',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('getRisks returns empty for new user', () => {
    expect(svc.getRisks('user1')).toEqual([]);
  });

  it('addRisk stores and retrieves', () => {
    svc.addRisk('user1', makeRisk('r1', 10));
    expect(svc.getRisks('user1').length).toBe(1);
    expect(svc.getRisk('user1', 'r1')?.title).toBe('Risk r1');
  });

  it('updateRisk merges', () => {
    svc.addRisk('user1', makeRisk('r1', 10));
    const u = svc.updateRisk('user1', 'r1', { status: 'mitigated' });
    expect(u.status).toBe('mitigated');
  });

  it('updateRisk throws for missing', () => {
    expect(() => svc.updateRisk('user1', 'missing', {})).toThrow('Risk not found');
  });

  it('deleteRisk removes', () => {
    svc.addRisk('user1', makeRisk('r1', 10));
    svc.deleteRisk('user1', 'r1');
    expect(svc.getRisks('user1')).toEqual([]);
  });

  it('calculateRiskScore returns likelihood * impact', () => {
    expect(svc.calculateRiskScore(3, 4)).toBe(12);
    expect(svc.calculateRiskScore(5, 5)).toBe(25);
    expect(svc.calculateRiskScore(1, 1)).toBe(1);
  });

  it('getCriticalRisks filters score >= 15', () => {
    svc.addRisk('user1', makeRisk('r1', 15));
    svc.addRisk('user1', makeRisk('r2', 10));
    svc.addRisk('user1', makeRisk('r3', 20));
    expect(svc.getCriticalRisks('user1').length).toBe(2);
  });

  it('getHighRisks filters 10 <= score < 15', () => {
    svc.addRisk('user1', makeRisk('r1', 10));
    svc.addRisk('user1', makeRisk('r2', 14));
    svc.addRisk('user1', makeRisk('r3', 15));
    expect(svc.getHighRisks('user1').length).toBe(2);
  });

  it('getRisksByCategory filters', () => {
    svc.addRisk('user1', { ...makeRisk('r1', 10), category: 'financial' });
    svc.addRisk('user1', { ...makeRisk('r2', 10), category: 'operational' });
    expect(svc.getRisksByCategory('user1', 'operational').length).toBe(1);
  });

  it('getHeatMap computes counts correctly', () => {
    svc.addRisk('user1', makeRisk('r1', 15)); // critical
    svc.addRisk('user1', makeRisk('r2', 12)); // high
    svc.addRisk('user1', makeRisk('r3', 7)); // medium
    svc.addRisk('user1', makeRisk('r4', 3)); // low
    const hm = svc.getHeatMap('user1');
    expect(hm.totalRisks).toBe(4);
    expect(hm.criticalCount).toBe(1);
    expect(hm.highCount).toBe(1);
    expect(hm.mediumCount).toBe(1);
    expect(hm.lowCount).toBe(1);
  });
});
