import { describe, expect, it } from 'vitest';
import { VerificationChainPolicy } from '../domain/VerificationChainPolicy.js';
import type { ChainEvaluation } from '../domain/VerificationChainPolicy.js';

const config = { maxDepth: 3, maxProviders: 3, timeoutMs: 60_000, maxCostUsd: 5 };
const policy = new VerificationChainPolicy(config);

describe('VerificationChainPolicy', () => {
  it('validates a chain plan within bounds', () => {
    const ok = policy.validatePlan({ depth: 2, providers: 2, timeoutMs: 30_000, costUsd: 0.5 });
    expect(ok.allowed).toBe(true);
  });

  it('rejects plans that exceed depth, providers, timeout or cost', () => {
    expect(
      policy.validatePlan({ depth: 4, providers: 1, timeoutMs: 1000, costUsd: 0.1 }).allowed,
    ).toBe(false);
    expect(
      policy.validatePlan({ depth: 1, providers: 9, timeoutMs: 1000, costUsd: 0.1 }).allowed,
    ).toBe(false);
    expect(
      policy.validatePlan({ depth: 1, providers: 1, timeoutMs: 120_000, costUsd: 0.1 }).allowed,
    ).toBe(false);
    expect(
      policy.validatePlan({ depth: 1, providers: 1, timeoutMs: 1000, costUsd: 6 }).allowed,
    ).toBe(false);
  });

  it('VERIFIED only when an independent verifier agrees with the answer', () => {
    const decision = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      verify: { providerId: 'c', verdict: 'AGREE', note: 'verified' },
    });
    expect(decision.verdict).toBe('VERIFIED');
    expect(decision.depthUsed).toBe(2);
    expect(decision.providersUsed).toBe(2);
  });

  it('CONTRADICTED when the verifier contradicts the answer', () => {
    const decision = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      verify: { providerId: 'c', verdict: 'CONTRADICT', note: 'disagrees' },
    });
    expect(decision.verdict).toBe('CONTRADICTED');
  });

  it('NEEDS_REVIEW on disagreement or an unclear verifier', () => {
    const unclear = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      verify: { providerId: 'c', verdict: 'UNKNOWN', note: 'cannot tell' },
    });
    expect(unclear.verdict).toBe('NEEDS_REVIEW');

    const critiqueOnly = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      critique: { providerId: 'b', verdict: 'CONTRADICT', note: 'disagrees' },
    });
    expect(critiqueOnly.verdict).toBe('NEEDS_REVIEW');
  });

  it('INCONCLUSIVE without a verifier or with an UNKNOWN critique — never claimed success', () => {
    const noVerifier = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
    });
    expect(noVerifier.verdict).toBe('INCONCLUSIVE');

    const unknownCritique = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      critique: { providerId: 'b', verdict: 'UNKNOWN', note: 'cannot tell' },
    });
    expect(unknownCritique.verdict).toBe('INCONCLUSIVE');
  });

  it('reports withinBounds from actual depth/providers/time/cost', () => {
    const decision = policy.evaluate({
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      critique: { providerId: 'b', verdict: 'AGREE', note: 'ok' },
      verify: { providerId: 'c', verdict: 'AGREE', note: 'ok' },
      timeMs: 55_000,
      costUsd: 4.9,
    });
    expect(decision.withinBounds).toBe(true);
    expect(decision.depthUsed).toBe(3);
    expect(decision.providersUsed).toBe(3);
  });
});
