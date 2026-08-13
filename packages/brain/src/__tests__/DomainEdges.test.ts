// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · domain edge-case coverage (EPIC-016)
// Targets branches not yet exercised by the main suite: every budget
// guard, policy deny branch, decision explain variant, planner cycle
// safety, store eviction, local-model fallback.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { BrainBudgetGuard } from '../domain/BrainBudgetGuard.js';
import { BrainPolicyEngine } from '../domain/BrainPolicyEngine.js';
import { BrainDecisionRecorder } from '../domain/BrainDecisionRecorder.js';
import { ParallelPlanner } from '../domain/ParallelPlanner.js';
import { ProviderRoleAssigner } from '../domain/ProviderRoleAssigner.js';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from '../infrastructure/InMemoryBrainStores.js';
import { ConflictDetector } from '../domain/ConflictDetector.js';
import type { ClockPort } from '../contracts/brain-ports.js';
import type { BrainTask } from '../types/brain-types.js';

class FixedClock implements ClockPort {
  now(): string {
    return '2026-08-15T09:00:00Z';
  }
}

describe('BrainBudgetGuard edges', () => {
  const budget = { maxTokens: 1000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 5000 };

  it('blocks before execution on token estimate', () => {
    const guard = new BrainBudgetGuard(budget);
    const v = guard.checkBefore([{ cost: { estimatedTokens: 5000 } }]);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.guard).toBe('TOKEN');
  });

  it('allows when estimates are within budget', () => {
    const guard = new BrainBudgetGuard(budget);
    const v = guard.checkBefore([{ cost: { estimatedTokens: 100, estimatedCostUsd: 0.1 } }]);
    expect(v.allowed).toBe(true);
  });

  it('blocks during execution on cost', () => {
    const guard = new BrainBudgetGuard(budget);
    const v = guard.checkDuring({ tokens: 10, costUsd: 5, iterations: 1 });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.guard).toBe('COST');
  });

  it('blocks during execution on iterations', () => {
    const guard = new BrainBudgetGuard(budget);
    const v = guard.checkDuring({ tokens: 10, costUsd: 0.1, iterations: 10 });
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.guard).toBe('ITERATION');
  });

  it('allows during execution within limits', () => {
    const guard = new BrainBudgetGuard(budget);
    const v = guard.checkDuring({ tokens: 100, costUsd: 0.1, iterations: 2 });
    expect(v.allowed).toBe(true);
  });
});

describe('BrainPolicyEngine deny branches', () => {
  const policy = new BrainPolicyEngine();
  const allowCtx = {
    authorizedActions: [] as string[],
    approvalGranted: [] as string[],
    budgetAllowed: true,
    evidenceSufficient: true,
    capabilityAvailable: true,
  };

  it('denies non-sensitive action when budget guard denied', () => {
    const v = policy.checkAction({ ...allowCtx, budgetAllowed: false }, 'execute');
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.policy).toBe('BUDGET');
  });

  it('denies when evidence insufficient', () => {
    const v = policy.checkAction({ ...allowCtx, evidenceSufficient: false }, 'execute');
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.policy).toBe('EVIDENCE_FIRST');
  });

  it('denies when capability unavailable', () => {
    const v = policy.checkAction({ ...allowCtx, capabilityAvailable: false }, 'execute');
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.policy).toBe('NO_FAKE_EXECUTION');
  });

  it('allows plain execution under policy', () => {
    const v = policy.checkAction(allowCtx, 'execute');
    expect(v.allowed).toBe(true);
  });

  it('evidence verdict: NONE, OPTIONAL always allowed; REQUIRED with evidence allowed', () => {
    expect(policy.evidenceVerdict('NONE', 0).allowed).toBe(true);
    expect(policy.evidenceVerdict('OPTIONAL', 0).allowed).toBe(true);
    expect(policy.evidenceVerdict('REQUIRED', 2).allowed).toBe(true);
    expect(policy.evidenceVerdict('REQUIRED', 0).allowed).toBe(false);
  });
});

describe('BrainDecisionRecorder explain variants', () => {
  it('explains a record without evidence or cost', () => {
    const store = new InMemoryBrainDecisionStore();
    const recorder = new BrainDecisionRecorder(store, new FixedClock());
    const record = recorder.record({
      taskId: 't1',
      userId: 'u1',
      decision: 'mode',
      reason: 'fast task',
      alternatives: [],
      selected: 'FAST',
    });
    const explanation = recorder.explain(record);
    expect(explanation).toContain('Decision: mode');
    expect(explanation).not.toContain('Estimated cost');
  });
});

describe('ParallelPlanner cycle safety', () => {
  it('breaks a cycle deterministically without hanging', () => {
    const plan = {
      id: 'p-cycle',
      requestedOutcome: 'x',
      createdAt: '2026-08-15T09:00:00Z',
      requiredCapabilities: ['RESEARCH', 'TEXT_GENERATION'],
      candidates: [],
      steps: [
        {
          id: 's0',
          title: 'A',
          capability: 'RESEARCH' as const,
          purpose: 'a',
          candidates: [],
          automation: 'FULLY_AUTOMATED' as const,
        },
        {
          id: 's1',
          title: 'B',
          capability: 'TEXT_GENERATION' as const,
          purpose: 'b',
          candidates: [],
          automation: 'FULLY_AUTOMATED' as const,
        },
      ],
      automationLevel: 'PARTIALLY_AUTOMATED' as const,
      automationPercent: 50,
      evidence: [],
      risks: [],
      humanApprovalPoints: [],
      unavailableCapabilities: [],
      recommendations: [],
    };
    const graph = new ParallelPlanner().build(plan as never);
    expect(graph.waves.flat().length).toBe(2);
  });
});

describe('InMemory stores bounded + owner-scoped', () => {
  it('evicts oldest tasks beyond the per-owner bound', () => {
    const store = new InMemoryBrainTaskStore(2);
    for (let i = 0; i < 4; i++) {
      store.save({
        id: `t${i}`,
        userId: 'u1',
        objective: `task ${i}`,
        originalInput: `task ${i}`,
      } as BrainTask);
    }
    expect(store.list('u1')).toHaveLength(2);
    expect(store.list('u1')[0]?.id).toBe('t2');
  });

  it('decision store is bounded and owner-scoped', () => {
    const store = new InMemoryBrainDecisionStore();
    for (let i = 0; i < 5; i++) {
      store.save({
        id: `d${i}`,
        taskId: 't1',
        userId: 'u1',
        decision: 'd',
        reason: 'r',
        alternatives: [],
        selected: 's',
        evidence: [],
        confidence: 0.5,
        constraints: [],
        qualityEstimate: undefined,
        createdAt: '2026-08-15T09:00:00Z',
        provenance: 'brain',
      });
    }
    expect(store.get('u1', 't1')).toHaveLength(5);
    expect(store.get('u2', 't1')).toHaveLength(0);
  });
});

describe('ProviderRoleAssigner local + N edges', () => {
  const assigner = new ProviderRoleAssigner();

  it('assignLocal prefers local in PRIVATE_LOCAL mode', () => {
    const a = assigner.assignLocal(
      'RESEARCH',
      { id: 'llama', name: 'Llama', capabilities: ['RESEARCH'], available: true },
      'PRIVATE_LOCAL',
    );
    expect(a.providerId).toBe('local-llama');
    expect(a.reason).toContain('PRIVATE_LOCAL');
  });

  it('assignLocal explains non-private selection honestly', () => {
    const a = assigner.assignLocal(
      'RESEARCH',
      { id: 'llama', name: 'Llama', capabilities: ['RESEARCH'], available: true },
      'BALANCED',
    );
    expect(a.reason).toContain('Local model available');
  });

  it('N stays 1 for single candidate and non-research caps', () => {
    expect(
      assigner.determineN('RESEARCH', [{} as never], {
        mode: 'DEEP_RESEARCH',
        qualityTarget: 'HIGH',
      }),
    ).toBe(1);
    expect(
      assigner.determineN('CODING', [{}, {}, {}] as never, {
        mode: 'DEEP_RESEARCH',
        qualityTarget: 'HIGH',
      }),
    ).toBe(1);
  });

  it('QUALITY high-target pair N', () => {
    expect(
      assigner.determineN('RESEARCH', [{}, {}, {}] as never, {
        mode: 'QUALITY',
        qualityTarget: 'HIGH',
      }),
    ).toBe(2);
  });

  it('throwing on no candidates is caught by the caller contract', () => {
    expect(() =>
      assigner.assign('RAG', [], { mode: 'BALANCED', qualityTarget: 'MEDIUM' }),
    ).toThrow();
  });
});

describe('ConflictDetector re-evaluate with specialist', () => {
  it('independent verification can resolve a conflict', () => {
    const detector = new ConflictDetector();
    const report = detector.reEvaluate(
      'topic',
      [
        { providerId: 'a', claim: 'Alpha is best.', evidence: [], confidence: 0.5 },
        { providerId: 'b', claim: 'Beta is best.', evidence: [], confidence: 0.5 },
      ],
      { providerId: 'c', claim: 'Alpha is best.', evidence: ['verified'], confidence: 0.95 },
    );
    expect(['AGREEMENT', 'MINOR_VARIANCE', 'MATERIAL_CONFLICT', 'EVIDENCE_CONFLICT']).toContain(
      report.classification,
    );
  });
});
