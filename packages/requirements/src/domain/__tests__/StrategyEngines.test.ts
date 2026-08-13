// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Strategy Engines
// Deterministic tests (Phase 31): architecture intelligence
// (choice/reason/alternative/tradeoff), AI strategy (required vs not),
// RAG strategy (only when needed), tool strategy (no unrestricted
// access), security planning (blocking unknowns), cost planning and
// build planning (safe parallel waves).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import { ArchitectureIntelligenceEngine } from '../ArchitectureIntelligenceEngine.js';
import { AIStrategyEngine } from '../AIStrategyEngine.js';
import { RAGStrategyEngine } from '../RAGStrategyEngine.js';
import { ToolStrategyEngine } from '../ToolStrategyEngine.js';
import { SecurityPlanner } from '../SecurityPlanner.js';
import { CostPlanner } from '../CostPlanner.js';
import { BuildPlanner } from '../BuildPlanner.js';
import type { AIStrategy, RAGStrategy, RequirementSet } from '../../types/requirement-types.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();
const ARCH = new ArchitectureIntelligenceEngine();
const AI = new AIStrategyEngine();
const RAG = new RAGStrategyEngine();
const TOOLS = new ToolStrategyEngine();
const SECURITY = new SecurityPlanner();
const COST = new CostPlanner();
const BUILD = new BuildPlanner();

function extract(idea: string, sessionId: string): RequirementSet {
  return EXTRACTION.extract({ sessionId, intent: INTENT.derive({ sessionId, idea }) });
}

describe('ArchitectureIntelligenceEngine (Phase 16)', () => {
  it('gives every major choice a Choice/Reason/Alternative/Tradeoff', () => {
    const architecture = ARCH.derive({ sessionId: 'r1', archetype: 'restaurant-app', answers: [] });
    expect(architecture.choices.length).toBeGreaterThanOrEqual(12);
    for (const c of architecture.choices) {
      expect(c.choice.length).toBeGreaterThan(0);
      expect(c.reason.length).toBeGreaterThan(0);
      expect(c.alternative.length).toBeGreaterThan(0);
      expect(c.tradeoff.length).toBeGreaterThan(0);
    }
  });

  it('adds payment architecture when the user answers online payment', () => {
    const architecture = ARCH.derive({
      sessionId: 'r2',
      archetype: 'restaurant-app',
      answers: [{ questionId: 'q-restaurant-payment', answer: 'online' }],
    });
    expect(architecture.choices.some((c) => c.layer === 'Payment')).toBe(true);
    const order = architecture.dataModel.find((e) => e.entity === 'Order');
    expect(order?.fields.some((f) => f.name === 'paymentStatus')).toBe(true);
    expect(architecture.apiContract.some((a) => a.endpoint.includes('/api/payments'))).toBe(true);
  });

  it('adds delivery model when delivery is chosen', () => {
    const architecture = ARCH.derive({
      sessionId: 'r3',
      archetype: 'restaurant-app',
      answers: [{ questionId: 'q-restaurant-service-modes', answer: 'delivery' }],
    });
    const order = architecture.dataModel.find((e) => e.entity === 'Order');
    expect(order?.fields.some((f) => f.name === 'deliveryAddress')).toBe(true);
  });

  it('declares complexity guards', () => {
    const architecture = ARCH.derive({ sessionId: 'r4', archetype: 'generic-web', answers: [] });
    expect(architecture.complexityGuard.length).toBeGreaterThan(0);
  });
});

describe('AIStrategyEngine (Phase 17)', () => {
  it('returns required=false for a restaurant app without AI', () => {
    const requirements = extract('Build a restaurant app with delivery.', 'ai1');
    const strategy = AI.derive({
      sessionId: 'ai1',
      archetype: 'restaurant-app',
      requirements,
      answers: [],
    });
    expect(strategy.required).toBe(false);
    expect(strategy.capabilities).toEqual([]);
  });

  it('returns required=true for the ABAP debugger', () => {
    const requirements = extract('Build an ABAP debugger assistant.', 'ai2');
    const strategy = AI.derive({
      sessionId: 'ai2',
      archetype: 'abap-debugger',
      requirements,
      answers: [],
    });
    expect(strategy.required).toBe(true);
    expect(strategy.capabilities.some((c) => c.capability === 'coding')).toBe(true);
    expect(strategy.reusesRuntime).toBe(true);
  });

  it('always routes through the frozen AI runtime', () => {
    const requirements = extract('Build an AI app builder.', 'ai3');
    const strategy = AI.derive({
      sessionId: 'ai3',
      archetype: 'ai-app-builder',
      requirements,
      answers: [],
    });
    expect(strategy.reusesRuntime).toBe(true);
    expect(strategy.providerStrategy).toContain('frozen AI runtime');
  });
});

describe('RAGStrategyEngine (Phase 18)', () => {
  it('does not add unnecessary RAG', () => {
    const strategy = RAG.derive({
      sessionId: 'rag1',
      archetype: 'restaurant-app',
      aiRagRequired: false,
      answers: [],
    });
    expect(strategy.required).toBe(false);
    expect(strategy.sources).toEqual([]);
  });

  it('requires RAG + grounding for the ABAP debugger', () => {
    const strategy = RAG.derive({
      sessionId: 'rag2',
      archetype: 'abap-debugger',
      aiRagRequired: true,
      answers: [],
    });
    expect(strategy.required).toBe(true);
    expect(strategy.groundingRequired).toBe(true);
    expect(strategy.evidenceRequired).toBe(true);
    expect(strategy.sources[0]?.collection).toBe('sap-abap');
  });

  it('respects a code-only answer (no RAG)', () => {
    const strategy = RAG.derive({
      sessionId: 'rag3',
      archetype: 'abap-debugger',
      aiRagRequired: true,
      answers: [{ questionId: 'q-abap-knowledge', answer: 'code_only' }],
    });
    expect(strategy.required).toBe(false);
  });
});

describe('ToolStrategyEngine (Phase 19)', () => {
  it('marks high-risk tools as approval-required', () => {
    const strategy = TOOLS.derive({
      sessionId: 't1',
      archetype: 'restaurant-app',
      requestedIntegrations: [],
    });
    const payment = strategy.tools.find((t) => t.name === 'payment');
    expect(payment?.risk).toBe('high');
    expect(payment?.approvalRequired).toBe(true);
  });

  it('adds integration tools when requested', () => {
    const strategy = TOOLS.derive({
      sessionId: 't2',
      archetype: 'restaurant-app',
      requestedIntegrations: ['maps', 'email'],
    });
    expect(strategy.tools.some((t) => t.name === 'maps')).toBe(true);
    expect(strategy.tools.some((t) => t.name === 'email')).toBe(true);
  });

  it('never plans unrestricted access', () => {
    const strategy = TOOLS.derive({
      sessionId: 't3',
      archetype: 'restaurant-app',
      requestedIntegrations: [],
    });
    expect(strategy.deniedTools).toContain('unrestricted_shell');
    expect(strategy.deniedTools).toContain('unrestricted_filesystem');
  });
});

describe('SecurityPlanner (Phase 20)', () => {
  it('turns unanswered security questions into blocking security unknowns', () => {
    const plan = SECURITY.plan({
      sessionId: 's1',
      archetype: 'restaurant-app',
      unansweredSecurityQuestions: ['Should customers pay online?'],
      handlesPayments: false,
    });
    expect(plan.securityCriticalUnknowns.length).toBeGreaterThan(0);
    expect(plan.blockingQuestions.length).toBeGreaterThan(0);
  });

  it('flags payment security even when no question was skipped', () => {
    const plan = SECURITY.plan({
      sessionId: 's2',
      archetype: 'restaurant-app',
      unansweredSecurityQuestions: [],
      handlesPayments: true,
    });
    expect(plan.securityCriticalUnknowns.some((u) => u.includes('Payment'))).toBe(true);
  });
});

describe('CostPlanner (Phase 21)', () => {
  it('estimates zero cost when AI is not required', () => {
    const aiStrategy = AI.derive({
      sessionId: 'c1',
      archetype: 'restaurant-app',
      requirements: extract('Build a restaurant app.', 'c1'),
      answers: [],
    });
    const plan = COST.plan({
      sessionId: 'c1',
      archetype: 'restaurant-app',
      ai: aiStrategy,
      rag: RAG.derive({
        sessionId: 'c1',
        archetype: 'restaurant-app',
        aiRagRequired: false,
        answers: [],
      }),
      confirmedFeatures: 6,
    });
    expect(plan.aiCalls).toBe(0);
    expect(plan.estimatedCostUsd).toBe(0);
  });

  it('estimates bounded AI cost for AI-required apps', () => {
    const requirements = extract('Build an ABAP debugger.', 'c2');
    const aiStrategy = AI.derive({
      sessionId: 'c2',
      archetype: 'abap-debugger',
      requirements,
      answers: [],
    });
    const plan = COST.plan({
      sessionId: 'c2',
      archetype: 'abap-debugger',
      ai: aiStrategy,
      rag: RAG.derive({
        sessionId: 'c2',
        archetype: 'abap-debugger',
        aiRagRequired: true,
        answers: [],
      }),
      confirmedFeatures: 8,
    });
    expect(plan.aiCalls).toBeGreaterThan(0);
    expect(plan.totalTokens).toBeGreaterThan(0);
    expect(plan.estimatedCostUsd).toBeGreaterThan(0);
    expect(plan.ragCalls).toBeGreaterThan(0);
    expect(plan.strategy.length).toBeGreaterThan(0);
  });

  it('plans zero RAG/embedding calls when AI is required but RAG is not', () => {
    const aiStrategy: AIStrategy = {
      required: true,
      capabilities: [],
      modelClass: 'm',
      providerStrategy: 'p',
      contextRequirements: [],
      ragRequired: false,
      structuredOutput: true,
      toolCalling: false,
      latencyRequirement: 'l',
      qualityRequirement: 'q',
      tokenBudget: { maxInputTokens: 4000, maxOutputTokens: 1000 },
      fallback: 'f',
      reusesRuntime: true,
      reasons: [],
    };
    const noRag: RAGStrategy = {
      required: false,
      sources: [],
      retrievalStrategy: 'r',
      groundingRequired: false,
      evidenceRequired: false,
      reasons: [],
    };
    const plan = COST.plan({
      sessionId: 'c3',
      archetype: 'generic-web',
      ai: aiStrategy,
      rag: noRag,
      confirmedFeatures: 6,
    });
    expect(plan.aiCalls).toBeGreaterThan(0);
    expect(plan.ragCalls).toBe(0);
    expect(plan.embeddingCalls).toBe(0);
  });
});

describe('BuildPlanner (Phase 22)', () => {
  it('produces dependency-aware parallel waves', () => {
    const plan = BUILD.plan({ sessionId: 'p1', archetype: 'restaurant-app' });
    expect(plan.steps.length).toBeGreaterThan(5);
    expect(plan.parallelWaves.length).toBeGreaterThan(1);
    expect(plan.usesLoopEngine).toBe(true);
    // A step appears in exactly one wave.
    const allWaves = plan.parallelWaves.flat();
    expect(new Set(allWaves).size).toBe(plan.steps.length);
  });

  it('respects dependencies across waves', () => {
    const plan = BUILD.plan({ sessionId: 'p2', archetype: 'restaurant-app' });
    for (const wave of plan.parallelWaves) {
      for (const stepId of wave) {
        const step = plan.steps.find((s) => s.id === stepId);
        if (step) {
          const waveIndex = plan.parallelWaves.indexOf(wave);
          for (const dep of step.dependencies) {
            const depWave = plan.parallelWaves.findIndex((w) => w.includes(dep));
            expect(depWave, `dependency ${dep} must be earlier than ${stepId}`).toBeLessThan(
              waveIndex,
            );
          }
        }
      }
    }
  });

  it('identifies entry and terminal steps', () => {
    const plan = BUILD.plan({ sessionId: 'p3', archetype: 'generic-web' });
    expect(plan.entrySteps.length).toBeGreaterThan(0);
    expect(plan.terminalSteps.length).toBeGreaterThan(0);
  });
});
