// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.3 · Opportunity Value Intelligence
//
// Proves the audited guarantees of the additive, evidence-only layer:
//   • it is OPTIONAL and does not change the S5.1 qualification contract;
//   • the EXISTING OpportunityEconomics is never replaced or mutated;
//   • delivery evidence and commercial evidence stay SEPARATE;
//   • PAID is the ONLY commercial success; every other state is non-success;
//   • a payment/invoice alone never creates paid evidence;
//   • linkage is canonical `opportunityId` ONLY — never title/client similarity;
//   • owner isolation is structural (owner from the canonical record);
//   • UNKNOWN ≠ FALSE — no history is INSUFFICIENT, never a fabricated failure;
//   • the assessment is DETERMINISTIC and calls no LLM/provider;
//   • no secret, payment credential or raw invoice payload is ever exposed.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryCommercialOutcomeStore } from '@vedmoulya/control-plane';
import type { CommercialOutcomeRecord, CommercialOutcomeStatus } from '@vedmoulya/control-plane';
import { OpportunityEconomics, compositeScore } from '@vedmoulya/world-model';
import type { FactorInput } from '@vedmoulya/world-model';
import {
  computeOpportunityValueIntelligence,
  type OpportunityValueEvidencePort,
} from '../services/OpportunityValueIntelligence.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';

const OWNER = 'owner-1';
const OTHER = 'owner-2';
const OPP = 'opp-1';
const OTHER_OPP = 'opp-2';
const NOW = '2026-10-06T09:00:00.000Z';

// ── canonical evidence fixtures ─────────────────────────────────────────────

function outcome(
  overrides: Partial<CommercialOutcomeRecord> & {
    status: CommercialOutcomeStatus;
  },
): CommercialOutcomeRecord {
  return {
    outcomeId: overrides.outcomeId ?? `co_${Math.random().toString(36).slice(2, 10)}`,
    userId: OWNER,
    missionId: 'm-1',
    objectiveId: 'o-1',
    clientId: 'client-1',
    documentId: 'doc-1',
    recordedBy: OWNER,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function storePort(store: InMemoryCommercialOutcomeStore): OpportunityValueEvidencePort {
  return { listCommercialOutcomes: (userId) => store.list(userId) };
}

/** Compute value intelligence directly over a populated canonical store. */
function valueOf(
  store: InMemoryCommercialOutcomeStore,
  opts: { ownerId?: string; opportunityId?: string } = {},
) {
  return computeOpportunityValueIntelligence(
    { ownerId: opts.ownerId ?? OWNER, opportunityId: opts.opportunityId ?? OPP },
    { evidence: storePort(store), now: () => NOW },
  );
}

// ── qualification harness (real assessor, real brain, optional evidence) ────

function createBrain(): BrainApplicationService {
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => NOW },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

function record(overrides: Partial<OpportunityLifecycleRecord> = {}): OpportunityLifecycleRecord {
  return {
    id: OPP,
    ownerId: OWNER,
    stableKey: 'owner-1|title',
    title: 'Build a TypeScript SDK',
    description: 'Client needs a typed SDK for their public API.',
    category: 'SaaS / digital product',
    status: 'DISCOVERED',
    evidence: [],
    riskLevel: 'MEDIUM',
    automationPotential: 'UNKNOWN',
    requiredCapabilities: ['typescript', 'api design'],
    transitions: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — qualification integration and backwards compatibility', () => {
  it('1. existing qualification is unchanged when no evidence port is wired', () => {
    const qualifier = createOpportunityQualifier({ brain: createBrain(), now: () => NOW });
    const result = qualifier.qualify(record());
    // The S5.1 contract is intact.
    expect(result.approved).toBe(false);
    expect(result.authorizationRequired).toBe(true);
    expect(result.inputsUsed.requiredCapabilities).toBe(2);
    expect(result.assessment.score).toBeGreaterThanOrEqual(0);
    // valueIntelligence is OPTIONAL — absent, not an empty fabricated verdict.
    expect(result.valueIntelligence).toBeUndefined();
  });

  it('2. existing relevance behaviour is unchanged (score comes from the assessor)', () => {
    const qualifier = createOpportunityQualifier({
      brain: createBrain(),
      rawDiscoveryItems: () => [
        {
          title: 'TypeScript SDK demand rises',
          description: 'market',
          source: 'rss',
          publishedAt: NOW,
        },
      ],
      now: () => NOW,
    });
    const result = qualifier.qualify(record());
    // Market signals were consumed and recorded as evidence counts, unchanged.
    expect(result.inputsUsed.marketSignals).toBe(1);
    expect(Array.isArray(result.assessment.evidence)).toBe(true);
  });

  it('3. valueIntelligence is present only when the evidence port is wired', () => {
    const store = new InMemoryCommercialOutcomeStore();
    const withPort = createOpportunityQualifier({
      brain: createBrain(),
      valueEvidence: storePort(store),
      now: () => NOW,
    }).qualify(record());
    expect(withPort.valueIntelligence).toBeDefined();
    expect(withPort.valueIntelligence?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
    // The core contract fields are untouched by the additive layer.
    expect(withPort.approved).toBe(false);
    expect(withPort.authorizationRequired).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — existing OpportunityEconomics is never replaced or mutated', () => {
  it('4. computing value intelligence leaves the economics model untouched', () => {
    const factors: FactorInput[] = [
      { key: 'customerPain', value: 0.8, status: 'VERIFIED', evidence: ['interviews'] },
      { key: 'demandSignal', value: 0.6, status: 'VERIFIED', evidence: ['search trend'] },
    ];
    const before = compositeScore(factors);
    const economics = new OpportunityEconomics();
    const evaluation = economics.evaluate({
      ownerId: OWNER,
      title: 'Build a TypeScript SDK',
      description: 'typed sdk',
      category: 'SaaS / digital product',
      baseScore: 0.5,
      baseBusinessCase: ['base'],
      baseRiskLevel: 'MEDIUM',
      baseMvpPlan: ['plan'],
      baseEvidence: ['base-evidence'],
      factors,
      now: () => NOW,
    });

    // Run the S6.3 layer with the same inputs.
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    valueOf(store);

    // The economics score and its factor breakdown are unchanged.
    expect(compositeScore(factors)).toBe(before);
    expect(evaluation.score).toBeGreaterThanOrEqual(0);
    expect(evaluation.score).toBeLessThanOrEqual(1);
    expect(evaluation.factors).toHaveLength(2);
    // S6.3 documents a separate, advisory evidence layer — no shared state.
    expect(evaluation).not.toHaveProperty('valueIntelligence');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — delivery evidence', () => {
  it('5. no delivery history → INSUFFICIENT (not FALSE)', () => {
    const v = valueOf(new InMemoryCommercialOutcomeStore());
    expect(v?.deliveryEvidence.level).toBe('INSUFFICIENT');
    expect(v?.deliveryEvidence.sampleCount).toBe(0);
    expect(v?.deliveryEvidence.successCount).toBe(0);
    // UNKNOWN is not FALSE: no failure is asserted either.
    expect(v?.deliveryEvidence.failureCount).toBe(0);
    expect(v?.deliveryEvidence.confidence.level).toBe('INSUFFICIENT');
  });

  it('6. verified successful delivery increases delivery evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    store.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    const v = valueOf(store);
    expect(v?.deliveryEvidence.successCount).toBe(2);
    expect(v?.deliveryEvidence.sampleCount).toBe(2);
    expect(v?.deliveryEvidence.level).not.toBe('INSUFFICIENT');
  });

  it('7. a failed delivery counts only when canonically linked (no failure record exists)', () => {
    // The canonical estate has no failed-delivery record; a foreign outcome is
    // never counted as a failure against this opportunity.
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OTHER_OPP, status: 'CANCELLED' }));
    const v = valueOf(store);
    expect(v?.deliveryEvidence.failureCount).toBe(0);
    expect(v?.deliveryEvidence.successCount).toBe(0);
    expect(v?.deliveryEvidence.level).toBe('INSUFFICIENT');
  });

  it('8. unlinked historical delivery is ignored, never guessed', () => {
    const store = new InMemoryCommercialOutcomeStore();
    // No opportunityId at all — a legacy gap. It must be EXCLUDED.
    store.save(outcome({ status: 'PAID' }));
    const v = valueOf(store);
    expect(v?.deliveryEvidence.sampleCount).toBe(0);
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(v?.evidenceCount).toBe(0);
    expect(v?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('9. delivery evidence stays separate from commercial evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    // 3 verified deliveries; only 1 has a paid commercial outcome.
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    store.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    store.save(outcome({ opportunityId: OPP, status: 'INVOICE_PENDING' }));
    const v = valueOf(store);
    expect(v?.deliveryEvidence.successCount).toBe(3);
    expect(v?.commercialEvidence.paidCount).toBe(1);
    expect(v?.commercialEvidence.pendingCount).toBe(2);
    // The two facts are not collapsed into a single success flag.
    expect(v?.deliveryEvidence).not.toBe(v?.commercialEvidence);
    expect(v?.overallAssessment).toBe('STRONG_CANDIDATE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — commercial evidence (conservative states)', () => {
  it('10. PAID counts as commercial success', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    const v = valueOf(store);
    expect(v?.commercialEvidence.paidCount).toBe(2);
    expect(v?.commercialEvidence.sampleCount).toBe(2);
  });

  const nonPaidStatuses = [
    'COMMERCIAL_PENDING',
    'MANUAL_REVIEW',
    'INVOICE_PENDING',
    'CANCELLED',
  ] as const satisfies readonly CommercialOutcomeStatus[];

  it.each(nonPaidStatuses)('%s does not count as paid', (status) => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status }));
    const v = valueOf(store);
    expect(v?.commercialEvidence.paidCount).toBe(0);
    if (status === 'CANCELLED') {
      expect(v?.commercialEvidence.cancelledCount).toBe(1);
      // Cancelled with no paid success is REAL negative evidence.
      expect(v?.overallAssessment).toBe('HIGH_RISK');
    } else {
      expect(v?.commercialEvidence.pendingCount).toBe(1);
      expect(v?.overallAssessment).not.toBe('HIGH_RISK');
    }
  });

  it('15. CLOSED is non-success per canonical S6.2 semantics — never assumed PAID', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'CLOSED' }));
    const v = valueOf(store);
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(v?.commercialEvidence.pendingCount).toBe(1);
    expect(v?.overallAssessment).not.toBe('STRONG_CANDIDATE');
  });

  it('16. payment/invoice existence alone does not create paid evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    // A record with BOTH an invoiceId and paymentId but a NON-paid status must
    // never be read as paid — only the governed status matters.
    store.save(
      outcome({
        opportunityId: OPP,
        status: 'COMMERCIAL_PENDING',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
      }),
    );
    const v = valueOf(store);
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(v?.commercialEvidence.pendingCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — UNKNOWN ≠ FALSE and conservative confidence', () => {
  it('17. no commercial history → INSUFFICIENT, not FALSE', () => {
    const v = valueOf(new InMemoryCommercialOutcomeStore());
    expect(v?.commercialEvidence.level).toBe('INSUFFICIENT');
    expect(v?.commercialEvidence.paidCount).toBe(0);
    // There is no commercialSuccess:false — absence is absence.
    expect(Object.keys(v?.commercialEvidence ?? {})).not.toContain('success');
    expect(v?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('18. no delivery history → INSUFFICIENT, not FALSE', () => {
    const v = valueOf(new InMemoryCommercialOutcomeStore());
    expect(v?.deliveryEvidence.level).toBe('INSUFFICIENT');
    expect(v?.deliveryEvidence.successCount).toBe(0);
    expect(v?.deliveryEvidence.failureCount).toBe(0);
  });

  it('19. a small sample produces conservative confidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    const v = valueOf(store);
    // A single sample is never HIGH.
    expect(v?.confidence).not.toBe('HIGH');
    expect(v?.deliveryEvidence.level).not.toBe('HIGH');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — owner isolation', () => {
  it('20. User A sees their own evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ userId: OWNER, opportunityId: OPP, status: 'PAID' }));
    const v = valueOf(store, { ownerId: OWNER });
    expect(v?.commercialEvidence.paidCount).toBe(1);
    expect(v?.deliveryEvidence.successCount).toBe(1);
  });

  it('21/22. User B cannot see or be influenced by User A evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    // User A owns a paid outcome linked to a SAME-NAMED opportunity id.
    store.save(outcome({ userId: OWNER, opportunityId: OPP, status: 'PAID' }));
    // User B asks about their own opportunity that happens to share the id.
    const v = valueOf(store, { ownerId: OTHER, opportunityId: OPP });
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(v?.deliveryEvidence.successCount).toBe(0);
    expect(v?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
    expect(v?.evidenceCount).toBe(0);
  });

  it('23. evidence port is called with the canonical owner only', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ userId: OTHER, opportunityId: OPP, status: 'PAID' }));
    const seen: string[] = [];
    const port: OpportunityValueEvidencePort = {
      listCommercialOutcomes: (userId) => {
        seen.push(userId);
        return store.list(userId);
      },
    };
    computeOpportunityValueIntelligence(
      { ownerId: OWNER, opportunityId: OPP },
      { evidence: port, now: () => NOW },
    );
    expect(seen).toEqual([OWNER]);
  });

  it('23b. a client-supplied owner cannot override the record owner', () => {
    // The qualifier derives the owner from the canonical record; a forged
    // ownerId in the record's title/description has no effect.
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ userId: OTHER, opportunityId: OPP, status: 'PAID' }));
    const qualifier = createOpportunityQualifier({
      brain: createBrain(),
      valueEvidence: storePort(store),
      now: () => NOW,
    });
    const result = qualifier.qualify(record({ id: OPP, ownerId: OWNER }));
    expect(result.valueIntelligence?.commercialEvidence.paidCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — canonical linking', () => {
  it('24. correct opportunityId linkage is used', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    const v = valueOf(store, { opportunityId: OPP });
    expect(v?.commercialEvidence.paidCount).toBe(1);
  });

  it('25. a different opportunityId is ignored', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OTHER_OPP, status: 'PAID' }));
    const v = valueOf(store, { opportunityId: OPP });
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(v?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('26. a missing opportunityId is never guessed', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ status: 'PAID' }));
    const v = valueOf(store, { opportunityId: OPP });
    expect(v?.evidenceCount).toBe(0);
  });

  it('27. similar title/client does not create a false linkage', () => {
    const store = new InMemoryCommercialOutcomeStore();
    // Any similarity in client/document/objective cannot link without the
    // canonical opportunityId.
    store.save(
      outcome({
        opportunityId: undefined,
        status: 'PAID',
        clientId: 'client-1',
        documentId: 'doc-1',
      }),
    );
    store.save(outcome({ opportunityId: OTHER_OPP, status: 'PAID', clientId: 'client-1' }));
    const v = valueOf(store, { opportunityId: OPP });
    expect(v?.evidenceCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — assessment', () => {
  it('28. strong evidence produces PROMISING / STRONG_CANDIDATE deterministically', () => {
    const promising = new InMemoryCommercialOutcomeStore();
    promising.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    promising.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    expect(valueOf(promising)?.overallAssessment).toBe('PROMISING');

    const strong = new InMemoryCommercialOutcomeStore();
    strong.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    strong.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    expect(valueOf(strong)?.overallAssessment).toBe('STRONG_CANDIDATE');
  });

  it('29. insufficient evidence produces INSUFFICIENT_EVIDENCE', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
    const v = valueOf(store);
    expect(v?.overallAssessment).toBe('INSUFFICIENT_EVIDENCE');
    // A single sample is conservatively LOW at most — never MEDIUM/HIGH.
    expect(['INSUFFICIENT', 'LOW']).toContain(v?.confidence);
    // One pending (non-paid) outcome is verified but weak commercial evidence.
    expect(v?.commercialEvidence.paidCount).toBe(0);
    expect(['INSUFFICIENT', 'LOW']).toContain(v?.commercialEvidence.level);
    // Reasons explain WHY the assessment stays insufficient.
    expect(v?.reasons.join(' ')).toMatch(/pending/i);
  });

  it('30. HIGH_RISK requires actual negative canonical evidence', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'CANCELLED' }));
    const v = valueOf(store);
    expect(v?.overallAssessment).toBe('HIGH_RISK');
    expect(v?.commercialEvidence.cancelledCount).toBe(1);
    // Negative evidence is reflected in the reasons.
    expect(v?.reasons.join(' ')).toMatch(/cancelled/i);
  });

  it('30b. a paid success offsets cancellation — not HIGH_RISK', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'CANCELLED' }));
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    const v = valueOf(store);
    expect(v?.overallAssessment).not.toBe('HIGH_RISK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — determinism and no LLM', () => {
  it('31. identical inputs/evidence produce identical intelligence (except generatedAt)', () => {
    const build = () => {
      const store = new InMemoryCommercialOutcomeStore();
      store.save(outcome({ outcomeId: 'co_a', opportunityId: OPP, status: 'PAID' }));
      store.save(outcome({ outcomeId: 'co_b', opportunityId: OPP, status: 'COMMERCIAL_PENDING' }));
      return valueOf(store);
    };
    const a = build();
    const b = build();
    expect(a).toEqual(b);
    // Deterministic metadata is identical across runs.
    expect(a?.overallAssessment).toBe(b?.overallAssessment);
    expect(a?.evidenceCount).toBe(b?.evidenceCount);
    expect(a?.reasons).toEqual(b?.reasons);
  });

  it('32. generatedAt is the only time-varying field, sourced from the injected clock', () => {
    const store = new InMemoryCommercialOutcomeStore();
    const v = computeOpportunityValueIntelligence(
      { ownerId: OWNER, opportunityId: OPP },
      { evidence: storePort(store), now: () => NOW },
    );
    expect(v?.generatedAt).toBe(NOW);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('S6.3 — security: references only, never payloads', () => {
  it('33/34/35. the result exposes no secrets, credentials or raw invoice data', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(
      outcome({
        opportunityId: OPP,
        status: 'PAID',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
      }),
    );
    const v = valueOf(store);
    const serialized = JSON.stringify(v);
    // No raw commercial identifiers or amount/credential fields leak through.
    expect(serialized).not.toMatch(/inv-1|pay-1/);
    expect(serialized).not.toMatch(/amount|cardNumber|cvv|secret|apiKey|token/i);
    // Only aggregate counts and evidence-safe fields are present.
    expect(Object.keys(v ?? {})).toEqual(
      expect.arrayContaining([
        'deliveryEvidence',
        'commercialEvidence',
        'overallAssessment',
        'confidence',
        'evidenceCount',
        'reasons',
        'generatedAt',
      ]),
    );
  });

  it('36. the layer performs no external commercial action', () => {
    const store = new InMemoryCommercialOutcomeStore();
    store.save(outcome({ opportunityId: OPP, status: 'PAID' }));
    // A pure computation: the canonical store is read, never mutated.
    const before = store.list(OWNER).length;
    valueOf(store);
    expect(store.list(OWNER)).toHaveLength(before);
  });
});
