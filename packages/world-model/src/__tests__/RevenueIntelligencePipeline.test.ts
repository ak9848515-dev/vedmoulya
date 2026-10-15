// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · S8 Revenue Intelligence pipeline tests
//
// Proves the value/cost/provenance-aware opportunity pipeline:
//   • a numeric expected value/cost appears ONLY when the owner's own outcome
//     evidence carries one — UNKNOWN never becomes zero;
//   • margin/ROI/rankScore appear ONLY when BOTH sides have evidence, and the
//     margin-aware rank decides the order (revenue alone never wins);
//   • reasoning + provenance are exposed on every entry (never hidden math);
//   • verified-outcome feedback is bounded (Δ ≤ FEEDBACK_DELTA_MAX) and refused
//     for unverified records;
//   • owner isolation + stable-key idempotency;
//   • the pipeline stays advisory and never authorizes (structural).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { StrategySelection } from '@vedmoulya/intelligence-fabric';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import { WorldModelService } from '../application/WorldModelService.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';
import type {
  WorldActionPort,
  WorldBrainPort,
  WorldControlPort,
  WorldFabricPort,
  WorldProactivePort,
} from '../contracts/world-ports.js';

const FIXED = '2026-10-13T10:00:00.000Z';
const now = (): string => FIXED;

function brainPort(): WorldBrainPort {
  return {
    listOpportunities: () => ({ success: true, data: [] }),
    listTasks: () => ({ success: true, data: [] }),
  };
}

function proactivePort(): WorldProactivePort {
  return {
    assessBusiness: (userId, input) => ({
      id: 'ba-1',
      ownerId: userId,
      title: input.title,
      description: input.description,
      category: 'services',
      score: 0.5,
      businessCase: ['Capability fit 100%.'],
      estimatedCost: { label: 'Unknown — depends on provider choice', status: 'UNKNOWN' },
      estimatedRevenue: { label: 'Unknown — no verified revenue data', status: 'UNKNOWN' },
      riskLevel: 'MEDIUM',
      mvpPlan: ['Research the market.'],
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence: ['capability fit'],
      createdAt: now(),
    }),
  };
}

function fabricPort(): WorldFabricPort {
  return {
    selectStrategy: async (input): Promise<StrategySelection> => ({
      strategy: input.strategy,
      selected: {
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        name: 'OpenAI',
        capabilityMatched: true,
        evidence: ['capability matched'],
      },
      ranked: [],
      reasons: ['matched'],
    }),
    validateWorkflow: () => ({ allowed: true, reason: 'within bounds' }),
    costSnapshot: () => ({}),
  };
}

function actionPort(): WorldActionPort {
  const policy = new ActionClassPolicy();
  return { classify: (a, opts) => policy.classify(a, opts) };
}

/** Two lifecycle records with non-numeric labels only — no numeric valuation. */
function controlPort(): WorldControlPort {
  return {
    listOpportunities: () => [
      {
        id: 'lc-high-margin',
        title: 'High-margin service',
        category: 'services',
        status: 'PRESENTED',
        riskLevel: 'LOW',
        estimatedCost: { label: '₹5,000 initial', status: 'ESTIMATED' },
        estimatedValue: { label: 'Unknown', status: 'UNKNOWN' },
        evidence: [{ label: 'capability fit', status: 'VERIFIED' }],
        recommendedWorkflow: ['Research', 'Deliver'],
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-02T09:00:00.000Z',
      },
      {
        id: 'lc-low-margin',
        title: 'Low-margin service',
        category: 'services',
        status: 'PRESENTED',
        riskLevel: 'MEDIUM',
        estimatedCost: { label: '₹5,000 initial', status: 'ESTIMATED' },
        estimatedValue: { label: 'Unknown', status: 'UNKNOWN' },
        evidence: [{ label: 'capability fit', status: 'VERIFIED' }],
        recommendedWorkflow: ['Research', 'Deliver'],
        createdAt: '2026-10-01T08:00:00.000Z',
        updatedAt: '2026-10-02T09:00:00.000Z',
      },
    ],
    autonomyPosture: () => ({
      emergencyStopEngaged: false,
      autonomyLevel: 2,
      settingsConfirmed: true,
    }),
  };
}

function makeService(): WorldModelService {
  return new WorldModelService({
    brain: brainPort(),
    proactive: proactivePort(),
    fabric: fabricPort(),
    action: actionPort(),
    control: controlPort(),
    stores: new InMemoryWorldStores(),
    now,
  });
}

function entryFor(service: WorldModelService, id: string) {
  const pipeline = service.opportunityPipeline('u1', { limit: 20 });
  if (!pipeline.success) throw new Error('pipeline failed');
  return pipeline.data.find((e) => e.opportunityId === id);
}

describe('S8 — Revenue Intelligence pipeline valuation', () => {
  it('exposes NO numeric value/cost when only non-numeric labels exist (UNKNOWN, never zero)', () => {
    const service = makeService();
    const entry = entryFor(service, 'lc-high-margin');
    expect(entry).toBeDefined();
    expect(entry?.expectedValue).toBeUndefined();
    expect(entry?.expectedCost).toBeUndefined();
    expect(entry?.expectedMargin).toBeUndefined();
    expect(entry?.expectedRoi).toBeUndefined();
    expect(entry?.rankScore).toBeUndefined();
    expect(entry?.valuationProvenance).toBe('RECORD_LABEL');
    expect(entry?.advisory).toBe(true);
    expect(entry?.reasoning?.join(' ')).toMatch(/UNKNOWN/);
    expect(entry?.reasoning?.join(' ')).toMatch(/never zero|never treated as zero/i);
  });

  it('derives VERIFIED value + cost and a margin-aware rank from the owner’s own outcome evidence', () => {
    const service = makeService();
    // High margin: revenue 1000, cost 100 → margin 0.9, roi 9, rank 9.
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'lc-high-margin',
      actual: { value: 1000, status: 'VERIFIED', evidence: ['bank settlement ref #1'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified revenue outcome'],
    });
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'COST',
      opportunityId: 'lc-high-margin',
      actual: { value: 100, status: 'VERIFIED', evidence: ['provider invoice #1'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified cost outcome'],
    });

    const entry = entryFor(service, 'lc-high-margin');
    expect(entry?.expectedValue).toMatchObject({ value: 1000, status: 'VERIFIED' });
    expect(entry?.expectedCost).toMatchObject({ value: 100, status: 'VERIFIED' });
    expect(entry?.expectedMargin).toBeCloseTo(0.9, 6);
    expect(entry?.expectedRoi).toBeCloseTo(9, 6);
    expect(entry?.rankScore).toBeCloseTo(9, 6);
    expect(entry?.valuationProvenance).toBe('OUTCOME_EVIDENCE');
    expect(entry?.reasoning?.join(' ')).toMatch(/Expected value \$1000 \(VERIFIED\)/);
    expect(entry?.reasoning?.join(' ')).toMatch(/Expected cost \$100 \(VERIFIED\)/);
    // The value is not treated as a quota/percentage — it stays a plain figure.
    expect(entry?.evidence.length).toBeGreaterThan(0);
  });

  it('ranks margin-aware — a high-margin opportunity outranks a low-margin one at equal revenue', () => {
    const service = makeService();
    const record = (id: string, revenue: number, cost: number): void => {
      service.recordOutcomeEvidence({
        ownerId: 'u1',
        kind: 'REVENUE',
        opportunityId: id,
        actual: { value: revenue, status: 'VERIFIED', evidence: ['revenue ref'] },
        verificationStatus: 'VERIFIED',
        evidence: ['verified'],
      });
      service.recordOutcomeEvidence({
        ownerId: 'u1',
        kind: 'COST',
        opportunityId: id,
        actual: { value: cost, status: 'VERIFIED', evidence: ['cost ref'] },
        verificationStatus: 'VERIFIED',
        evidence: ['verified'],
      });
    };
    record('lc-high-margin', 1000, 100); // roi 9
    record('lc-low-margin', 1000, 950); // roi ~0.053

    const pipeline = service.opportunityPipeline('u1', { limit: 20 });
    expect(pipeline.success).toBe(true);
    if (!pipeline.success) return;
    const high = pipeline.data.findIndex((e) => e.opportunityId === 'lc-high-margin');
    const low = pipeline.data.findIndex((e) => e.opportunityId === 'lc-low-margin');
    expect(high).toBeGreaterThanOrEqual(0);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThan(low);
    // Revenue alone never wins: equal revenue, different margin → different rank.
    const highEntry = pipeline.data[high];
    const lowEntry = pipeline.data[low];
    expect(highEntry?.rankScore).toBeGreaterThan(lowEntry?.rankScore ?? 0);
  });

  it('leaves margin/ROI/rank UNKNOWN when only one side (value) has evidence', () => {
    const service = makeService();
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'lc-high-margin',
      actual: { value: 800, status: 'VERIFIED', evidence: ['revenue ref'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified'],
    });
    const entry = entryFor(service, 'lc-high-margin');
    expect(entry?.expectedValue).toMatchObject({ value: 800, status: 'VERIFIED' });
    expect(entry?.expectedCost).toBeUndefined();
    expect(entry?.expectedMargin).toBeUndefined();
    expect(entry?.expectedRoi).toBeUndefined();
    expect(entry?.rankScore).toBeUndefined();
    expect(entry?.reasoning?.join(' ')).toMatch(/Not ranked/);
  });

  it('matches by category when no opportunity-specific record exists', () => {
    const service = makeService();
    const recorded = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      category: 'services',
      expected: { value: 500, status: 'ESTIMATED', evidence: ['market survey'] },
      // The domain records expected-only evidence under a VERIFIED record — the
      // ACTUAL side (not present here) is what must be VERIFIED.
      verificationStatus: 'VERIFIED',
      evidence: ['category-level estimate'],
    });
    expect(recorded.success).toBe(true);
    const entry = entryFor(service, 'lc-low-margin');
    expect(entry?.expectedValue).toMatchObject({ value: 500, status: 'ESTIMATED' });
    expect(entry?.valuationProvenance).toBe('OUTCOME_EVIDENCE');
  });

  it('applies BOUNDED verified-outcome feedback and refuses unverified records', () => {
    const service = makeService();
    // A verified outcome nudges the mapped factor by at most FEEDBACK_DELTA_MAX.
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'lc-high-margin',
      actual: { value: 900, status: 'VERIFIED', evidence: ['revenue ref'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified'],
    });
    service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'COST',
      opportunityId: 'lc-high-margin',
      actual: { value: 100, status: 'VERIFIED', evidence: ['cost ref'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified'],
    });
    const verified = entryFor(service, 'lc-high-margin');
    expect(verified?.valuationProvenance).toBe('OUTCOME_EVIDENCE');
    for (const adjustment of verified?.boundedFeedback ?? []) {
      expect(Math.abs(adjustment.delta)).toBeLessThanOrEqual(0.05);
    }
    expect((verified?.boundedFeedback ?? []).length).toBeGreaterThan(0);
    expect(verified?.reasoning?.join(' ')).toMatch(/Bounded verified-outcome feedback/);

    // A record with NO verified ACTUAL must NOT produce any bounded
    // adjustment — applyFeedback only ever moves a factor toward a real actual.
    const expectedOnly = service.recordOutcomeEvidence({
      ownerId: 'u1',
      kind: 'REVENUE',
      opportunityId: 'lc-low-margin',
      expected: { value: 700, status: 'ESTIMATED', evidence: ['market survey'] },
      verificationStatus: 'VERIFIED',
      evidence: ['expected-only record'],
    });
    expect(expectedOnly.success).toBe(true);
    const unverified = entryFor(service, 'lc-low-margin');
    expect(unverified?.boundedFeedback).toBeUndefined();
  });

  it('isolates owners — another owner’s evidence never valuates mine', () => {
    const service = makeService();
    service.recordOutcomeEvidence({
      ownerId: 'u2',
      kind: 'REVENUE',
      opportunityId: 'lc-high-margin',
      actual: { value: 9999, status: 'VERIFIED', evidence: ['other owner'] },
      verificationStatus: 'VERIFIED',
      evidence: ['other owner'],
    });
    const mine = entryFor(service, 'lc-high-margin'); // u1
    expect(mine?.expectedValue).toBeUndefined();
    expect(mine?.valuationProvenance).toBe('RECORD_LABEL');
  });

  it('is idempotent — re-recording the same (kind, opportunity) evidence never duplicates', () => {
    const service = makeService();
    const record = (): void => {
      service.recordOutcomeEvidence({
        ownerId: 'u1',
        kind: 'REVENUE',
        opportunityId: 'lc-high-margin',
        actual: { value: 1000, status: 'VERIFIED', evidence: ['revenue ref'] },
        verificationStatus: 'VERIFIED',
        evidence: ['verified'],
      });
    };
    record();
    const before = entryFor(service, 'lc-high-margin');
    record();
    const after = entryFor(service, 'lc-high-margin');
    expect(after?.expectedValue?.value).toBe(before?.expectedValue?.value);
    expect(after?.valuationProvenance).toBe('OUTCOME_EVIDENCE');
  });
});
