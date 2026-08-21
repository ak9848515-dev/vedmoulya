import { describe, it, expect } from 'vitest';
import { BusinessOpportunityAssessor } from '../domain/BusinessOpportunityAssessor.js';

const assessor = new BusinessOpportunityAssessor();

function assess(overrides: Partial<Parameters<BusinessOpportunityAssessor['assess']>[0]> = {}) {
  return assessor.assess({
    ownerId: 'u1',
    title: 'YouTube automation service',
    description: 'Produce and publish YouTube content for clients.',
    availableCapabilities: ['TEXT_GENERATION', 'VIDEO', 'VOICE'],
    requiredCapabilities: ['TEXT_GENERATION', 'VIDEO', 'VOICE', 'AVATAR'],
    relatedWork: [
      {
        objective: 'Made a product video',
        status: 'COMPLETED',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    marketSignals: [
      {
        title: 'Video content demand rising',
        relevance: 0.8,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    now: () => '2026-08-13T00:00:00.000Z',
    ...overrides,
  });
}

describe('BusinessOpportunityAssessor', () => {
  it('scores from evidence and marks the assessment RESEARCHED', () => {
    const a = assess();
    expect(a.status).toBe('RESEARCHED');
    expect(a.authorizationRequired).toBe(true);
    expect(a.score).toBeGreaterThan(0);
    expect(a.evidence.length).toBeGreaterThan(0);
  });

  it('scores zero with no evidence (UNKNOWN stays UNKNOWN)', () => {
    const a = assess({
      requiredCapabilities: [],
      relatedWork: [],
      marketSignals: [],
    });
    expect(a.score).toBe(0);
    expect(a.businessCase[0]).toMatch(/No evidence yet/);
  });

  it('never fabricates cost or revenue — they stay UNKNOWN without data', () => {
    const a = assess();
    expect(a.estimatedCost?.status).toBe('UNKNOWN');
    expect(a.estimatedRevenue?.status).toBe('UNKNOWN');
  });

  it('builds an MVP plan that never executes without approval', () => {
    const a = assess();
    expect(a.mvpPlan.join(' ')).toMatch(/approval/);
    expect(a.mvpPlan.join(' ')).toMatch(/execution bridge/);
  });

  it('flags a missing capability as MEDIUM risk', () => {
    const a = assess();
    expect(a.riskLevel).toBe('MEDIUM');
  });

  it('categorizes by keyword', () => {
    expect(assess({ title: 'YouTube channel', description: 'video content' }).category).toBe(
      'Content creation',
    );
    expect(assess({ title: 'SaaS product', description: 'software' }).category).toBe(
      'SaaS / digital product',
    );
    expect(assess({ title: 'Consulting', description: 'agency services' }).category).toBe(
      'Consulting / services',
    );
  });
});
