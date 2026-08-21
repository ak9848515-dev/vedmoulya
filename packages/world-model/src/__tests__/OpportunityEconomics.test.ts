// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OpportunityEconomics tests (SPRINT-032)
// Evidence-only opportunity economics:
//   • factors contribute ONLY when evidence supports them
//   • composite score is advisory with every factor exposed (never truth)
//   • zero/low-capital classification (NO_COST / LOW_COST / CAPITAL_REQUIRED /
//     UNKNOWN) — never promises income
//   • budget tiers (₹0 / ₹1000 / ₹5000 / ₹10000 / ₹25000)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  OpportunityEconomics,
  classifyCapitalMode,
  compositeScore,
  type FactorInput,
} from '../domain/OpportunityEconomics.js';
import { CAPITAL_BUDGET_TIERS_INR } from '../types/world-types.js';

function factor(
  key: FactorInput['key'],
  value: number | undefined,
  status: FactorInput['status'] = 'ESTIMATED',
  evidence: string[] = ['evidence'],
): FactorInput {
  return { key, value, status, evidence };
}

describe('compositeScore', () => {
  it('is 0 when NO factor has evidence (UNKNOWN stays UNKNOWN)', () => {
    const factors: FactorInput[] = [
      factor('marketEvidence', undefined, 'UNKNOWN'),
      factor('customerPain', undefined, 'UNKNOWN'),
      factor('potentialRevenue', undefined, 'UNKNOWN'),
    ];
    expect(compositeScore(factors)).toBe(0);
  });

  it('blends only KNOWN factors with documented weights', () => {
    const factors: FactorInput[] = [
      factor('marketEvidence', 1, 'ESTIMATED'),
      factor('customerPain', 0, 'ESTIMATED'),
    ];
    const score = compositeScore(factors);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('clamps to [0,1]', () => {
    const factors: FactorInput[] = [factor('potentialRevenue', 1.5, 'VERIFIED')];
    expect(compositeScore(factors)).toBe(1);
  });

  it('is 0 when a factor carries no weight (unknown key — defensive, never NaN)', () => {
    // A factor key outside the weights table contributes nothing.
    const factors: FactorInput[] = [
      { key: 'unknownKey', value: 0.5, status: 'ESTIMATED', evidence: ['x'] },
    ];
    expect(compositeScore(factors)).toBe(0);
  });
});

describe('classifyCapitalMode', () => {
  it('NO_COST for zero initial cost', () => {
    expect(classifyCapitalMode({ value: 0, status: 'VERIFIED' }, 0)).toBe('NO_COST');
  });

  it('LOW_COST when within the owner budget tier', () => {
    expect(classifyCapitalMode({ value: 800, status: 'ESTIMATED' }, 1000)).toBe('LOW_COST');
    expect(classifyCapitalMode({ value: 5000, status: 'ESTIMATED' }, 5000)).toBe('LOW_COST');
  });

  it('CAPITAL_REQUIRED when above the owner budget tier', () => {
    expect(classifyCapitalMode({ value: 2000, status: 'ESTIMATED' }, 1000)).toBe(
      'CAPITAL_REQUIRED',
    );
    expect(classifyCapitalMode({ value: 30000, status: 'ESTIMATED' }, 25000)).toBe(
      'CAPITAL_REQUIRED',
    );
  });

  it('UNKNOWN when there is NO initial-cost evidence (never fabricated)', () => {
    expect(classifyCapitalMode(undefined, 1000)).toBe('UNKNOWN');
    expect(classifyCapitalMode({ value: undefined, status: 'UNKNOWN' }, 1000)).toBe('UNKNOWN');
  });

  it('exposes the configured budget tiers', () => {
    expect(CAPITAL_BUDGET_TIERS_INR).toEqual([0, 1000, 5000, 10000, 25000]);
  });

  it('rounds a non-tier budget to the NEAREST configured tier (bounded, deterministic)', () => {
    expect(classifyCapitalMode({ value: 900, status: 'ESTIMATED' }, 2000)).toBe('LOW_COST');
    expect(classifyCapitalMode({ value: 2500, status: 'ESTIMATED' }, 2000)).toBe(
      'CAPITAL_REQUIRED',
    );
  });
});

describe('OpportunityEconomics.evaluate', () => {
  it('produces a full evaluation with EVERY factor exposed (never objective truth)', () => {
    const economics = new OpportunityEconomics();
    const evaluation = economics.evaluate({
      ownerId: 'u1',
      title: 'AI automation service',
      description: 'Deliver workflow automation to local businesses.',
      category: 'Consulting / services',
      baseScore: 0.4,
      baseBusinessCase: ['Capability fit 60%.'],
      baseRiskLevel: 'MEDIUM',
      baseMvpPlan: ['Research the market.', 'Get user approval.'],
      baseEvidence: ['capability fit'],
      factors: [
        factor('marketEvidence', 0.8, 'ESTIMATED'),
        factor('customerPain', 0.9, 'ESTIMATED'),
        factor('potentialRevenue', 0.7, 'UNKNOWN', []),
        factor('initialCost', 0.9, 'ESTIMATED'), // 0..1 score — low cost is favorable
        factor('automationPotential', 0.9, 'ESTIMATED'),
        factor('aiLeverage', 0.9, 'ESTIMATED'),
      ],
      initialCostInr: { value: 5000, status: 'ESTIMATED' },
      capitalBudgetInr: 5000,
    });

    expect(evaluation.authorizationRequired).toBe(true);
    expect(evaluation.capitalMode).toBe('LOW_COST');
    expect(evaluation.capitalBudgetInr).toBe(5000);
    expect(evaluation.factors.length).toBe(6);
    const revenue = evaluation.factors.find((f) => f.key === 'potentialRevenue');
    expect(revenue?.status).toBe('UNKNOWN'); // no evidence — stays UNKNOWN
    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.score).toBeLessThanOrEqual(1);
    // The business case says the score is advisory — never a promise.
    expect(evaluation.businessCase.join(' ')).toContain('advisory');
  });

  it('never fabricates a score when there is no factor evidence', () => {
    const economics = new OpportunityEconomics();
    const evaluation = economics.evaluate({
      ownerId: 'u1',
      title: 'Mystery opportunity',
      description: 'No evidence at all.',
      category: 'Other',
      baseScore: 0,
      baseBusinessCase: ['No evidence yet.'],
      baseRiskLevel: 'UNKNOWN',
      baseMvpPlan: [],
      baseEvidence: [],
      factors: [factor('marketEvidence', undefined, 'UNKNOWN')],
      capitalBudgetInr: 0,
    });
    expect(evaluation.capitalMode).toBe('UNKNOWN');
    expect(evaluation.score).toBe(0);
  });

  it('labels automationPotential and aiLeverage from factor evidence (HIGH/MEDIUM/LOW)', () => {
    const economics = new OpportunityEconomics();
    const high = economics.evaluate({
      ownerId: 'u1',
      title: 'High leverage',
      description: 'x',
      category: 'Other',
      baseScore: 0,
      baseBusinessCase: [],
      baseRiskLevel: 'UNKNOWN',
      baseMvpPlan: [],
      baseEvidence: [],
      factors: [
        factor('automationPotential', 0.9, 'ESTIMATED'),
        factor('aiLeverage', 0.4, 'ESTIMATED'),
      ],
    });
    expect(high.automationPotential).toBe('HIGH');
    expect(high.aiLeverage).toBe('MEDIUM');

    const low = economics.evaluate({
      ownerId: 'u1',
      title: 'Low leverage',
      description: 'x',
      category: 'Other',
      baseScore: 0,
      baseBusinessCase: [],
      baseRiskLevel: 'UNKNOWN',
      baseMvpPlan: [],
      baseEvidence: [],
      factors: [
        factor('automationPotential', 0.1, 'ESTIMATED'),
        factor('aiLeverage', 0.2, 'ESTIMATED'),
      ],
    });
    expect(low.automationPotential).toBe('LOW');
    expect(low.aiLeverage).toBe('LOW');

    const unknown = economics.evaluate({
      ownerId: 'u1',
      title: 'No leverage evidence',
      description: 'x',
      category: 'Other',
      baseScore: 0,
      baseBusinessCase: [],
      baseRiskLevel: 'UNKNOWN',
      baseMvpPlan: [],
      baseEvidence: [],
      factors: [factor('automationPotential', undefined, 'UNKNOWN')],
    });
    expect(unknown.automationPotential).toBe('UNKNOWN');
  });

  it('supports ₹0 / ₹1000 / ₹5000 / ₹10000 / ₹25000 configured budgets', () => {
    const economics = new OpportunityEconomics();
    const results = [0, 1000, 5000, 10000, 25000].map((budget) =>
      economics.evaluate({
        ownerId: 'u1',
        title: 'Costed opportunity',
        description: 'Needs ₹12,000 to start.',
        category: 'Other',
        baseScore: 0.5,
        baseBusinessCase: [],
        baseRiskLevel: 'MEDIUM',
        baseMvpPlan: [],
        baseEvidence: [],
        factors: [factor('initialCost', 0.2, 'ESTIMATED')],
        initialCostInr: { value: 12000, status: 'ESTIMATED' },
        capitalBudgetInr: budget,
      }),
    );
    expect(results[0]?.capitalMode).toBe('CAPITAL_REQUIRED'); // ₹0 budget
    expect(results[1]?.capitalMode).toBe('CAPITAL_REQUIRED'); // ₹1000
    expect(results[2]?.capitalMode).toBe('CAPITAL_REQUIRED'); // ₹5000
    expect(results[3]?.capitalMode).toBe('CAPITAL_REQUIRED'); // ₹10000
    expect(results[4]?.capitalMode).toBe('LOW_COST'); // ₹25000 covers ₹12000
  });
});
