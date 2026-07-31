import { describe, it, expect } from 'vitest';
import { BusinessOpportunityService } from '../BusinessOpportunityService.js';
import type { BusinessOpportunityDTO } from '../BusinessDTO.js';

describe('BusinessOpportunityService', () => {
  let svc: BusinessOpportunityService;
  beforeEach(() => {
    svc = new BusinessOpportunityService();
  });

  const makeOpp = (
    id: string,
    roi: number,
    status: BusinessOpportunityDTO['status'] = 'identified',
    confidence: number = 0.8,
  ): BusinessOpportunityDTO => ({
    id,
    title: `Opp ${id}`,
    description: 'desc',
    type: 'growth',
    potentialValue: 100000,
    investmentRequired: 10000,
    roi,
    confidence,
    timeframe: 'short_term',
    status,
    dependencies: [],
    risks: [],
    createdAt: new Date().toISOString(),
  });

  it('getOpportunities returns empty for new user', () => {
    expect(svc.getOpportunities('user1')).toEqual([]);
  });

  it('addOpportunity stores and retrieves', () => {
    svc.addOpportunity('user1', makeOpp('o1', 150));
    expect(svc.getOpportunities('user1').length).toBe(1);
    expect(svc.getOpportunity('user1', 'o1')?.title).toBe('Opp o1');
  });

  it('updateOpportunity merges', () => {
    svc.addOpportunity('user1', makeOpp('o1', 150));
    const u = svc.updateOpportunity('user1', 'o1', { roi: 200 });
    expect(u.roi).toBe(200);
  });

  it('updateOpportunity throws for missing', () => {
    expect(() => svc.updateOpportunity('user1', 'missing', {})).toThrow('Opportunity not found');
  });

  it('deleteOpportunity removes', () => {
    svc.addOpportunity('user1', makeOpp('o1', 150));
    svc.deleteOpportunity('user1', 'o1');
    expect(svc.getOpportunities('user1')).toEqual([]);
  });

  it('getHighValueOpportunities filters by minRoi and status', () => {
    svc.addOpportunity('user1', makeOpp('o1', 200));
    svc.addOpportunity('user1', { ...makeOpp('o2', 50), status: 'completed' });
    svc.addOpportunity('user1', { ...makeOpp('o3', 150), status: 'declined' });
    svc.addOpportunity('user1', makeOpp('o4', 100));
    expect(svc.getHighValueOpportunities('user1', 100).length).toBe(2);
  });

  it('getOpportunitiesByType filters', () => {
    svc.addOpportunity('user1', { ...makeOpp('o1', 150), type: 'growth' });
    svc.addOpportunity('user1', { ...makeOpp('o2', 150), type: 'market' });
    expect(svc.getOpportunitiesByType('user1', 'market').length).toBe(1);
  });

  it('getTopOpportunities returns top N by roi*confidence', () => {
    svc.addOpportunity('user1', makeOpp('o1', 50));
    svc.addOpportunity('user1', { ...makeOpp('o2', 200), confidence: 0.9 });
    svc.addOpportunity('user1', { ...makeOpp('o3', 300), confidence: 0.5 });
    const top = svc.getTopOpportunities('user1', 2);
    expect(top.length).toBe(2);
    expect(top[0].id).toBe('o2'); // 200*0.9 = 180
    expect(top[1].id).toBe('o3'); // 300*0.5 = 150
  });

  it('getTopOpportunities excludes declined/completed', () => {
    svc.addOpportunity('user1', { ...makeOpp('o1', 200), status: 'declined' });
    svc.addOpportunity('user1', { ...makeOpp('o2', 200), status: 'completed' });
    svc.addOpportunity('user1', makeOpp('o3', 200));
    expect(svc.getTopOpportunities('user1', 5).length).toBe(1);
  });
});
