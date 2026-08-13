// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain: LearningSignals tests
// SPRINT-025 — Continuous Learning (FACT/INFERENCE/UNKNOWN separation)
//
// The deriver must NEVER turn unverified evidence into a FACT, must keep
// UNKNOWN honest, and must keep provider claims out of the trusted-fact
// channel. Signals are advisory and evidence-gated.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  deriveLearningSignals,
  correctionSignal,
  MAX_SIGNALS_PER_OUTCOME,
} from '../domain/LearningSignals.js';
import type { DeriveSignalsInput } from '../domain/LearningSignals.js';
import type { BrainTask } from '../types/brain-types.js';

function baseTask(overrides: Partial<BrainTask>): BrainTask {
  return {
    id: 't1',
    userId: 'u1',
    objective: 'objective',
    originalInput: 'objective',
    intent: {
      objective: 'objective',
      domain: 'research',
      desiredOutcome: 'outcome',
      constraints: [],
      qualityTarget: 'MEDIUM',
      privacyRequirement: 'STANDARD',
      urgency: 'NORMAL',
      authorizedActions: [],
      ambiguities: [],
      assumptions: [],
    },
    mode: 'BALANCED',
    domain: 'research',
    qualityTarget: 'MEDIUM',
    privacyRequirement: 'STANDARD',
    budget: { maxTokens: 1000, maxCostUsd: 0.1, maxIterations: 3, maxLatencyMs: 10000 },
    requiredCapabilities: ['RESEARCH' as never],
    roleAssignments: [],
    graph: { nodes: [], edges: [], waves: [] },
    status: 'COMPLETED',
    stage: 'RESULT',
    stageStatuses: {
      UNDERSTANDING: 'completed',
      PLAN: 'completed',
      INTELLIGENCE: 'completed',
      EXECUTION: 'completed',
      VERIFICATION: 'completed',
      RESULT: 'completed',
      CANCELLED: 'pending',
      FAILED: 'pending',
    },
    providerOutputs: [
      {
        providerId: 'prov-a',
        role: 'RESEARCHER',
        capability: 'RESEARCH' as never,
        output: 'real output',
        evidence: [],
        quality: 0.8,
      },
    ],
    conflicts: [],
    failoverEvents: [],
    decisionRecords: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: 'trace-1',
    createdAt: '2026-08-13T09:00:00Z',
    updatedAt: '2026-08-13T09:00:00Z',
    ...overrides,
  };
}

function input(overrides: Partial<DeriveSignalsInput>): DeriveSignalsInput {
  return {
    task: baseTask({}),
    verdict: 'SUCCESS',
    verificationPassed: true,
    verificationFailed: false,
    accepted: true,
    capturedAt: '2026-08-13T09:00:00Z',
    ...overrides,
  };
}

describe('deriveLearningSignals — FACT / INFERENCE / UNKNOWN separation', () => {
  it('verified SUCCESS produces a FACT for the succeeded provider', () => {
    const signals = deriveLearningSignals(input({}));
    const fact = signals.find((s) => s.kind === 'FACT');
    expect(fact).toBeDefined();
    expect(fact?.fact).toContain('prov-a');
    expect(fact?.fact).toContain('succeeded');
    expect(fact?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(signals.every((s) => s.source === 'INFERRED')).toBe(true);
  });

  it('UNKNOWN verdict NEVER produces a FACT (nothing fabricated)', () => {
    const signals = deriveLearningSignals(input({ verdict: 'UNKNOWN' }));
    expect(signals.some((s) => s.kind === 'FACT')).toBe(false);
    expect(signals.some((s) => s.kind === 'UNKNOWN')).toBe(true);
    expect(signals[0]?.kind).toBe('UNKNOWN');
  });

  it('COMPLETED but NOT verified (verification absent) stays UNKNOWN', () => {
    const signals = deriveLearningSignals(
      input({ verdict: 'UNKNOWN', verificationPassed: undefined, verificationFailed: undefined }),
    );
    expect(signals.some((s) => s.kind === 'FACT')).toBe(false);
  });

  it('definitive verification FAIL produces FAILED FACTs, never SUCCESS claims', () => {
    const task = baseTask({
      providerOutputs: [
        {
          providerId: 'prov-b',
          role: 'RESEARCHER',
          capability: 'RESEARCH' as never,
          output: '',
          evidence: [],
          quality: 0.6,
        },
      ],
    });
    const signals = deriveLearningSignals(
      input({ task, verdict: 'FAILED', verificationPassed: false, verificationFailed: true }),
    );
    const fact = signals.find((s) => s.kind === 'FACT');
    expect(fact?.fact).toContain('failed');
    expect(fact?.fact).toContain('verification');
    expect(signals.some((s) => s.fact.includes('succeeded'))).toBe(false);
  });

  it('one observation is a weak INFERENCE, not a belief (low confidence)', () => {
    const signals = deriveLearningSignals(input({}));
    const inference = signals.find((s) => s.kind === 'INFERENCE');
    expect(inference).toBeDefined();
    expect(inference?.confidence).toBeLessThanOrEqual(0.4);
    expect(inference?.fact).toContain('may');
  });

  it('AWAITING_APPROVAL and CANCELLED produce no outcome FACTs', () => {
    for (const verdict of ['AWAITING_APPROVAL' as const, 'CANCELLED' as const]) {
      const signals = deriveLearningSignals(input({ verdict }));
      expect(signals.some((s) => s.kind === 'FACT')).toBe(false);
    }
  });

  it('BUDGET_EXHAUSTED records an honest bounded-stop signal', () => {
    const signals = deriveLearningSignals(input({ verdict: 'BUDGET_EXHAUSTED' }));
    expect(signals.some((s) => s.kind === 'UNKNOWN')).toBe(true);
    expect(signals[0]?.fact.toLowerCase()).toContain('budget');
    expect(signals.some((s) => s.kind === 'FACT')).toBe(false);
  });

  it('failover events are recorded as FACTs with the failure class', () => {
    const task = baseTask({
      failoverEvents: [
        {
          capability: 'RESEARCH' as never,
          failedProviderId: 'prov-a',
          failureClass: 'PROVIDER_UNAVAILABLE',
          fallbackProviderId: 'prov-b',
          reason: 'benchmark simulated 503',
          attempts: 1,
          timestamp: '2026-08-13T09:00:00Z',
        },
      ],
    });
    const signals = deriveLearningSignals(input({ task }));
    const failoverSignal = signals.find((s) => s.fact.includes('failed over'));
    expect(failoverSignal).toBeDefined();
    expect(failoverSignal?.evidence.join(' ')).toContain('PROVIDER_UNAVAILABLE');
  });

  it('is bounded (never unbounded signal growth)', () => {
    const task = baseTask({
      failoverEvents: Array.from({ length: 30 }, (_, i) => ({
        capability: 'RESEARCH' as never,
        failedProviderId: `prov-${i}`,
        failureClass: 'PROVIDER_UNAVAILABLE' as const,
        fallbackProviderId: 'prov-b',
        reason: 'benchmark simulated',
        attempts: 1,
        timestamp: '2026-08-13T09:00:00Z',
      })),
    });
    const signals = deriveLearningSignals(input({ task }));
    expect(signals.length).toBeLessThanOrEqual(MAX_SIGNALS_PER_OUTCOME);
  });

  it('no executable outputs → honest UNKNOWN, never fabricated success', () => {
    const task = baseTask({
      providerOutputs: [
        {
          providerId: 'prov-a',
          role: 'RESEARCHER',
          capability: 'RESEARCH' as never,
          output: 'ABSTAINED',
          evidence: [],
          quality: undefined,
        },
      ],
    });
    const signals = deriveLearningSignals(input({ task, verdict: 'UNKNOWN' }));
    expect(signals.some((s) => s.kind === 'FACT')).toBe(false);
  });

  it('Brain verify() gate failures are DEFINITIVE: abstention with FAILED verdict yields a failure FACT (pinned semantic)', () => {
    // The Brain's verify() marks 'no abstention without reason' as a definitive
    // gate failure (verification.passed === false). BrainApplicationService
    // maps that to verificationFailed=true, so the deriver MUST classify it as
    // a verified failure — never a success, and never silently UNKNOWN.
    const task = baseTask({
      providerOutputs: [
        {
          providerId: 'prov-a',
          role: 'RESEARCHER',
          capability: 'RESEARCH' as never,
          output: 'ABSTAINED',
          evidence: [],
          quality: undefined,
        },
      ],
    });
    const signals = deriveLearningSignals(
      input({ task, verdict: 'FAILED', verificationPassed: false, verificationFailed: true }),
    );
    const failureFact = signals.find(
      (s) => s.kind === 'FACT' && s.fact.includes('failed') && s.fact.includes('verification'),
    );
    expect(failureFact).toBeDefined();
    expect(signals.some((s) => s.kind === 'FACT' && s.fact.includes('succeeded'))).toBe(false);
  });
});

describe('correctionSignal — EXPLICIT user authority', () => {
  it('is always EXPLICIT with the correction statement and scope', () => {
    const signal = correctionSignal({
      statement: 'Do not use this approach again',
      target: 'approach',
      confidence: 0.98,
      capturedAt: '2026-08-13T09:00:00Z',
      provenance: 'correction:corr-1',
    });
    expect(signal.source).toBe('EXPLICIT');
    expect(signal.kind).toBe('FACT');
    expect(signal.fact).toContain('approach correction');
    expect(signal.fact).toContain('Do not use this approach again');
  });

  it('includes the provider scope when provided', () => {
    const signal = correctionSignal({
      statement: 'That provider is unreliable for this',
      target: 'provider',
      providerId: 'prov-x',
      confidence: 0.98,
      capturedAt: '2026-08-13T09:00:00Z',
      provenance: 'correction:corr-2',
    });
    expect(signal.fact).toContain('prov-x');
  });
});
