// ──────────────────────────────────────────────────────────────────
// VedMoulya — Model Selection Intelligence tests
// EPIC-012A — AI Provider Intelligence (Phases 12–16)
// Verifies: precision/evidence hard gates (a free model that cannot
// satisfy the task is NOT eligible), budget policy (never spend / ask
// before paid), user preference (never silently replaced), smart
// upgrade/downgrade, and the user-facing why-summary.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ModelSelectionIntelligence } from '../ModelSelectionIntelligence.js';
import type { ProviderCandidateIntelligence } from '../ProviderRoutingAdvisor.js';
import type { ExecutionStrategyPort, ProviderIntelligencePort } from '../ProviderRoutingAdvisor.js';

function candidate(
  params: Partial<ProviderCandidateIntelligence> & {
    providerId: string;
  },
): ProviderCandidateIntelligence {
  return {
    family: 'mock',
    capabilities: ['reasoning'],
    healthy: true,
    models: [{ id: 'm1', contextWindow: 128000, maxOutputTokens: 4096, streaming: true }],
    benchmarkScore: 90,
    averageLatencyMs: 100,
    costPer1KInput: 0,
    costPer1KOutput: 0,
    ...params,
  };
}

function ports(candidates: ProviderCandidateIntelligence[]): {
  intelligence: ProviderIntelligencePort;
  strategy: ExecutionStrategyPort;
} {
  return {
    intelligence: {
      getCandidates: async () => candidates,
    },
    strategy: {
      getRoutingContext: async () => ({ strategy: 'balanced' as const }),
    },
  };
}

describe('ModelSelectionIntelligence — hard requirements override cost', () => {
  it('honors an explicit user preference when it satisfies the requirements', async () => {
    const p = ports([
      candidate({ providerId: 'paid', benchmarkScore: 95, costPer1KInput: 3, costPer1KOutput: 15 }),
      candidate({ providerId: 'free', benchmarkScore: 90 }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
      userPreference: { providerId: 'paid', modelId: 'm1' },
    });
    expect(result.selected.providerId).toBe('paid');
    expect(result.preferenceConflict).toBeUndefined();
  });

  it('refuses a high-precision task when no model is eligible (honest, no silent fallback)', async () => {
    const p = ports([candidate({ providerId: 'cheap', benchmarkScore: 40, costPer1KInput: 0 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    await expect(
      msi.decide({ capability: 'reasoning', estimatedInputTokens: 1000, precision: 'high' }),
    ).rejects.toThrow(/No provider model meets the required precision/);
  });

  it('blocks paid usage under the never_paid policy with an honest reason', async () => {
    const p = ports([
      candidate({ providerId: 'paid', benchmarkScore: 95, costPer1KInput: 3, costPer1KOutput: 15 }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
      budgetPolicy: 'never_paid',
    });
    expect(result.verdict).toBe('never_paid_blocked');
    expect(result.blockedReason).toContain('never spend');
    expect(result.requiresPaidApproval).toBe(false);
  });

  it('requires paid approval under ask_before_paid (the default) when the best model is paid', async () => {
    const p = ports([
      candidate({ providerId: 'paid', benchmarkScore: 95, costPer1KInput: 3, costPer1KOutput: 15 }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
      budgetPolicy: 'ask_before_paid',
    });
    expect(result.verdict).toBe('paid_approval_required');
    expect(result.requiresPaidApproval).toBe(true);
    expect(result.whySummary.some((s) => s.includes('paid provider'))).toBe(true);
  });

  it('approves free selections without any approval gate', async () => {
    const p = ports([candidate({ providerId: 'free', benchmarkScore: 90 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
    });
    expect(result.verdict).toBe('approved');
    expect(result.requiresPaidApproval).toBe(false);
    expect(result.selected.resourceType).toBe('FREE_HOSTED');
    expect(result.selected.freeToUse).toBe(true);
  });

  it('flags a conflicting user preference with options, never silent replacement', async () => {
    const p = ports([
      candidate({
        providerId: 'strong',
        benchmarkScore: 95,
        models: [{ id: 'strong-m', contextWindow: 128000, maxOutputTokens: 4096, streaming: true }],
      }),
      candidate({
        providerId: 'weak',
        benchmarkScore: 30,
        models: [{ id: 'weak-m', contextWindow: 8000, maxOutputTokens: 1024, streaming: false }],
      }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 100000, // exceeds weak-m's tiny context window
      userPreference: { providerId: 'weak', modelId: 'weak-m' },
      precision: 'high',
    });
    expect(result.preferenceConflict).toBeDefined();
    expect(result.preferenceConflict?.reason).toContain('cannot reliably satisfy');
    expect(result.preferenceConflict?.options.length).toBeGreaterThan(0);
  });

  it('recommends downgrade for a simple task on an over-powered model', async () => {
    const p = ports([candidate({ providerId: 'big', benchmarkScore: 95 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 500,
      taskComplexity: 'simple',
    });
    expect(result.upgradeDowngrade.action).toBe('downgrade');
    expect(result.upgradeDowngrade.reason).toContain('free/local model may be sufficient');
  });

  it('recommends upgrade for a complex task on a weak model', async () => {
    const p = ports([candidate({ providerId: 'weak', benchmarkScore: 55 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 2000,
      taskComplexity: 'complex',
    });
    expect(result.upgradeDowngrade.action).toBe('upgrade');
  });

  it('keeps an explicit user selection without a downgrade signal', async () => {
    const p = ports([candidate({ providerId: 'p', benchmarkScore: 95 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 500,
      taskComplexity: 'simple',
      userPreference: { modelId: 'm1' },
    });
    expect(result.upgradeDowngrade.action).toBe('keep');
    expect(result.upgradeDowngrade.reason).toContain('never downgraded silently');
  });

  it('produces a user-facing why-summary', async () => {
    const p = ports([candidate({ providerId: 'free', benchmarkScore: 90 })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
      evidenceRequired: true,
    });
    expect(result.whySummary).toContain('Meets the required standard accuracy.');
    expect(result.whySummary).toContain('Evidence requirements are satisfied.');
    expect(result.whySummary).toContain('Free to use (no per-token cost).');
  });
});

describe('ModelSelectionIntelligence — EPIC-012B intelligence-layer facts', () => {
  it('uses the intelligence-layer resourceType/freeToUse instead of cost heuristics', async () => {
    // FREE_API_QUOTA: free to use per the registry classification even
    // though the per-token price is non-zero (quota, not unlimited free).
    const p = ports([
      candidate({
        providerId: 'quota',
        benchmarkScore: 90,
        costPer1KInput: 0.5,
        costPer1KOutput: 2,
        resourceType: 'FREE_API_QUOTA',
        freeToUse: true,
      }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
    });
    // The intelligence layer's classification wins — no paid-approval gate.
    expect(result.selected.resourceType).toBe('FREE_API_QUOTA');
    expect(result.selected.freeToUse).toBe(true);
    expect(result.verdict).toBe('approved');
    // Quota copy, not "free" — quota is free-within-limits, never unlimited.
    expect(result.whySummary.some((s) => s.includes('Free within your available quota'))).toBe(
      true,
    );
  });

  it('never treats an intelligence-declared paid resource as free', async () => {
    // AGGREGATOR with zero per-token cost but declared paid (pass-through
    // aggregation is never free per the registry classification).
    const p = ports([
      candidate({
        providerId: 'agg',
        benchmarkScore: 90,
        costPer1KInput: 0,
        costPer1KOutput: 0,
        resourceType: 'AGGREGATOR',
        freeToUse: false,
      }),
    ]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
      budgetPolicy: 'never_paid',
    });
    expect(result.selected.resourceType).toBe('AGGREGATOR');
    expect(result.selected.freeToUse).toBe(false);
    expect(result.verdict).toBe('never_paid_blocked');
  });

  it('falls back to deterministic derivation when the intelligence fields are absent', async () => {
    const p = ports([candidate({ providerId: 'local', family: 'ollama' })]);
    const msi = new ModelSelectionIntelligence(p.intelligence, p.strategy);
    const result = await msi.decide({
      capability: 'reasoning',
      estimatedInputTokens: 1000,
    });
    expect(result.selected.resourceType).toBe('LOCAL');
    expect(result.selected.freeToUse).toBe(true);
  });
});
