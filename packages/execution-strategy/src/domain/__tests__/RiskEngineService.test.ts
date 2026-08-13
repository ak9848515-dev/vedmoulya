// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Strategy Tests: RiskEngineService
// EI-004 — Enterprise Execution Strategy Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RiskEngineService } from '../services/RiskEngineService.js';
import type {
  CostBudget,
  LatencyBudget,
  ProviderCandidate,
  TokenBudget,
} from '../../types/strategy-types.js';

function makeCandidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    providerId: 'anthropic_claude-3-opus',
    family: 'anthropic',
    name: 'Anthropic Claude',
    modelId: 'claude-3-opus',
    capabilityMatch: 0.9,
    qualityEstimate: 0.97,
    latencyEstimateMs: 1200,
    costEstimateUsd: 0,
    contextWindow: 200000,
    availability: 'healthy',
    confidence: 0.95,
    historicalSuccess: 0.96,
    healthScore: 0.98,
    rankScore: 0.9,
    ...overrides,
  };
}

function makeTokenBudget(overrides: Partial<TokenBudget> = {}): TokenBudget {
  return {
    inputTokens: 2000,
    outputTokens: 1500,
    contextTokens: 4000,
    reservedTokens: 1000,
    maximumTokens: 15000,
    expectedTokens: 8500,
    confidence: 0.85,
    ...overrides,
  };
}

function makeCostBudget(overrides: Partial<CostBudget> = {}): CostBudget {
  return {
    expectedCostUsd: 0.2,
    maximumCostUsd: 1,
    category: 'minimum',
    confidence: 0.8,
    ...overrides,
  };
}

function makeLatencyBudget(overrides: Partial<LatencyBudget> = {}): LatencyBudget {
  return {
    expectedTimeMs: 3000,
    maximumTimeMs: 10000,
    confidence: 0.8,
    ...overrides,
  };
}

describe('RiskEngineService', () => {
  const service = new RiskEngineService();

  it('assesses a healthy strategy as low risk', () => {
    const risk = service.assess(
      [makeCandidate()],
      makeTokenBudget({ maximumTokens: 100000 }),
      makeCostBudget({ maximumCostUsd: 10 }),
      makeLatencyBudget({ maximumTimeMs: 60000 }),
    );
    expect(risk.overallRisk).toBeGreaterThanOrEqual(0);
    expect(risk.overallRisk).toBeLessThan(0.2);
    expect(risk.level).toBe('very_low');
    expect(risk.factors.length).toBeGreaterThan(0);
    expect(risk.confidence).toBeGreaterThan(0);
  });

  it('returns full provider risk when no candidates exist', () => {
    const risk = service.assess(
      [],
      makeTokenBudget(),
      makeCostBudget({ expectedCostUsd: 5, maximumCostUsd: 1 }),
      makeLatencyBudget({ expectedTimeMs: 20000, maximumTimeMs: 10000 }),
    );
    expect(risk.providerRisk).toBe(1);
    expect(risk.level).toBe('critical');
    expect(risk.factors).toContain('Provider fleet health or availability is low');
  });

  it('elevates provider risk for degraded availability', () => {
    const degraded = service.assess(
      [makeCandidate({ availability: 'degraded' })],
      makeTokenBudget(),
      makeCostBudget(),
      makeLatencyBudget(),
    );
    const healthy = service.assess(
      [makeCandidate()],
      makeTokenBudget(),
      makeCostBudget(),
      makeLatencyBudget(),
    );
    expect(degraded.providerRisk).toBeGreaterThan(healthy.providerRisk);
  });

  it('flags budget risk when cost exceeds the cap', () => {
    const risk = service.assess(
      [makeCandidate()],
      makeTokenBudget(),
      makeCostBudget({ expectedCostUsd: 5, maximumCostUsd: 1 }),
      makeLatencyBudget(),
    );
    expect(risk.budgetRisk).toBe(1);
    expect(risk.factors.some((f) => f.includes('budget'))).toBe(true);
  });

  it('flags latency risk when expected time exceeds the cap', () => {
    const risk = service.assess(
      [makeCandidate()],
      makeTokenBudget(),
      makeCostBudget(),
      makeLatencyBudget({ expectedTimeMs: 20000, maximumTimeMs: 10000 }),
    );
    expect(risk.latencyRisk).toBe(1);
    expect(risk.factors.some((f) => f.includes('latency'))).toBe(true);
  });

  it('flags execution risk when the token budget exceeds the context window', () => {
    const risk = service.assess(
      [makeCandidate({ contextWindow: 10000 })],
      makeTokenBudget({ maximumTokens: 90000 }),
      makeCostBudget(),
      makeLatencyBudget(),
    );
    expect(risk.executionRisk).toBeGreaterThan(0.5);
    expect(risk.factors.some((f) => f.includes('context'))).toBe(true);
  });

  it('maps overall risk to the correct level bands', () => {
    const low = service.assess(
      [makeCandidate()],
      makeTokenBudget(),
      makeCostBudget(),
      makeLatencyBudget(),
    );
    const high = service.assess(
      [],
      makeTokenBudget(),
      makeCostBudget({ expectedCostUsd: 100, maximumCostUsd: 1 }),
      makeLatencyBudget({ expectedTimeMs: 100000, maximumTimeMs: 100 }),
    );
    expect(['very_low', 'low']).toContain(low.level);
    expect(['high', 'critical']).toContain(high.level);
  });

  it('keeps all risk dimensions in the 0-1 range', () => {
    const risk = service.assess(
      [makeCandidate(), makeCandidate({ availability: 'degraded', healthScore: 0.5 })],
      makeTokenBudget({ maximumTokens: 999999 }),
      makeCostBudget({ expectedCostUsd: 999, maximumCostUsd: 0 }),
      makeLatencyBudget({ expectedTimeMs: 999999, maximumTimeMs: 0 }),
    );
    for (const value of [
      risk.providerRisk,
      risk.executionRisk,
      risk.budgetRisk,
      risk.latencyRisk,
      risk.overallRisk,
    ]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
