import { describe, it, expect } from 'vitest';
import { BusinessKPIService } from '../BusinessKPIService.js';
import type { BusinessKPIDTO } from '../BusinessDTO.js';

describe('BusinessKPIService', () => {
  let svc: BusinessKPIService;
  beforeEach(() => {
    svc = new BusinessKPIService();
  });

  const makeKPI = (id: string, current: number, target: number): BusinessKPIDTO => ({
    id,
    name: `KPI ${id}`,
    description: 'desc',
    category: 'revenue',
    currentValue: current,
    targetValue: target,
    unit: '$',
    trend: 'stable',
    period: 'monthly',
    lastUpdated: new Date().toISOString(),
  });

  it('getKPIs returns empty for new user', () => {
    expect(svc.getKPIs('user1')).toEqual([]);
  });

  it('addKPI stores and retrieves', () => {
    svc.addKPI('user1', makeKPI('k1', 80, 100));
    expect(svc.getKPIs('user1').length).toBe(1);
    expect(svc.getKPI('user1', 'k1')?.name).toBe('KPI k1');
  });

  it('updateKPI merges', () => {
    svc.addKPI('user1', makeKPI('k1', 80, 100));
    const u = svc.updateKPI('user1', 'k1', { currentValue: 95 });
    expect(u.currentValue).toBe(95);
  });

  it('updateKPI throws for missing', () => {
    expect(() => svc.updateKPI('user1', 'missing', {})).toThrow('KPI not found');
  });

  it('deleteKPI removes', () => {
    svc.addKPI('user1', makeKPI('k1', 80, 100));
    svc.deleteKPI('user1', 'k1');
    expect(svc.getKPIs('user1')).toEqual([]);
  });

  it('getKPIsByCategory filters', () => {
    svc.addKPI('user1', { ...makeKPI('k1', 80, 100), category: 'revenue' });
    svc.addKPI('user1', { ...makeKPI('k2', 80, 100), category: 'cost' });
    expect(svc.getKPIsByCategory('user1', 'cost').length).toBe(1);
  });

  it('getKPIsAtRisk filters where current < 50% of target', () => {
    svc.addKPI('user1', makeKPI('k1', 20, 100));
    svc.addKPI('user1', makeKPI('k2', 80, 100));
    svc.addKPI('user1', makeKPI('k3', 49, 100));
    expect(svc.getKPIsAtRisk('user1').length).toBe(2);
  });

  it('getKPIsOnTrack filters where current >= target', () => {
    svc.addKPI('user1', makeKPI('k1', 100, 100));
    svc.addKPI('user1', makeKPI('k2', 120, 100));
    svc.addKPI('user1', makeKPI('k3', 80, 100));
    expect(svc.getKPIsOnTrack('user1').length).toBe(2);
  });
});
