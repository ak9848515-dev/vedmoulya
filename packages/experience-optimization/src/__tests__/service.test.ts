// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Service Tests
//
// Proves the ADVISORY boundary end to end at the service level:
//   - evidence levels (Phase 4): INSUFFICIENT / EMERGING / RELIABLE /
//     HIGH_CONFIDENCE
//   - one advisory surface per optimization target (Phase 3/7-10)
//   - CURRENT RUNTIME TRUTH WINS (Phase 18): unavailable tools,
//     degraded providers, explicit instructions, authority constraints
//   - user preferences inform, never decide (Phase 19)
//   - conservative exploration (Phase 15) incl. high-risk block
//   - feedback loop (Phase 21) + observability (Phase 20)
//   - recency decay (Phase 14) + strategy degradation
//   - duplicate evidence aggregation + concurrent updates
//   - deterministic scoring + explainability (Phase 6/17)
//   - malformed / fabricated evidence rejected (Phase 24)
//   - secret sanitization + cross-user isolation
//   - no authority escalation, no self-modification (Phase 16/26)
// Hermetic: in-memory store, fake clock, no network, no AI keys.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { ExecutionMemoryService, InMemoryExecutionMemoryStore } from '@vedmoulya/execution-memory';
import {
  ExperienceOptimizationService,
  MAX_CANDIDATES_CONSIDERED,
  RECOMMENDABLE_RECOVERY_STRATEGIES,
} from '../application/ExperienceOptimizationService.js';
import { ExperienceMemoryPortAdapter } from '../infrastructure/ExperienceMemoryPortAdapter.js';
import { InMemoryRecommendationOutcomeStore } from '../infrastructure/InMemoryRecommendationOutcomeStore.js';
import {
  FakeClock,
  ingestRuns,
  makeCompletedRun,
  makeEntry,
  makeRig,
  type TestRig,
} from './fixtures.js';

/** N distinct verified runs for one tool (realistic distinct run ids). */
function verifiedRuns(
  toolName: string,
  count: number,
  options: Parameters<typeof makeCompletedRun>[0] = {},
) {
  return Array.from({ length: count }, (_, i) => ({
    ...makeCompletedRun({
      ...options,
      runId: options.runId ?? `run-${toolName}-${String(i)}`,
      toolName,
    }),
  }));
}

describe('evidence levels (Phase 4)', () => {
  it('never optimizes from a single execution (INSUFFICIENT)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }) }]);
    expect(await rig.optimization.recommend('TOOL_SELECTION')).toBeUndefined();
  });

  it('EMERGING: enough evidence to observe a pattern (2-4 samples)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 2 }]);
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec?.subject).toBe('alpha');
    expect(rec?.evidenceLevel).toBe('EMERGING');
    expect(rec?.explanation.join(' ')).toContain('2 verified executions');
  });
});

describe('RELIABLE / HIGH_CONFIDENCE (Phase 4 continued)', () => {
  it('repeated verified outcomes + recency + consistency reach HIGH_CONFIDENCE', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 6 }]);
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec?.evidenceLevel).toBe('HIGH_CONFIDENCE');
    expect(rec?.confidence.score).toBeGreaterThan(0);
  });
});

describe('one advisory surface per optimization target (Phase 3/7-10)', () => {
  it('PLAN_PATTERN: recommends the historically verified plan signature', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 6 }]);
    const rec = await rig.optimization.recommend('PLAN_PATTERN');
    expect(rec?.subject).toBe('coding:1steps');
    expect(rec?.evidenceLevel).toBe('HIGH_CONFIDENCE');
    expect(rec?.advisory).toBe(true);
  });

  it('TOOL_SELECTION: prefers the repeatedly verified tool over the failing one', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await ingestRuns(rig, verifiedRuns('beta', 3, { verdicts: ['FAILED'] }));
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec?.subject).toBe('alpha');
  });

  it('RECOVERY_STRATEGY: recommends the historically recovering strategy and NEVER a terminal one', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [
      {
        ...makeCompletedRun({
          runId: 'run-alt-ok',
          withRecovery: true,
          recoveryStrategy: 'alternate_tool',
        }),
        count: 6,
      },
      {
        ...makeCompletedRun({
          runId: 'run-alt-bad',
          withRecovery: true,
          recoveryStrategy: 'alternate_tool',
          verdicts: ['FAILED'],
        }),
        count: 2,
      },
    ]);
    // Fabricated PERFECT evidence for a terminal strategy — must never win:
    // approval/blocking/failing are loop + governance decisions, never
    // optimization targets.
    await rig.store.save(
      makeEntry({
        category: 'RECOVERY_PATTERN',
        subject: 'fail_step',
        sampleCount: 20,
        successCount: 20,
        failureCount: 0,
        verifiedCount: 20,
        value: 1,
        recency: 1,
      }),
    );
    const rec = await rig.optimization.recommend('RECOVERY_STRATEGY');
    expect(rec?.subject).toBe('alternate_tool');
    expect(RECOMMENDABLE_RECOVERY_STRATEGIES).not.toContain('fail_step');
    expect(RECOMMENDABLE_RECOVERY_STRATEGIES).not.toContain('request_approval');
    expect(RECOMMENDABLE_RECOVERY_STRATEGIES).not.toContain('block_step');
  });

  it('VERIFICATION_STRATEGY: recommends deterministic verification evidence', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const rec = await rig.optimization.recommend('VERIFICATION_STRATEGY');
    expect(rec?.subject).toBe('frozen_verification');
    expect(rec?.advisory).toBe(true);
  });

  it('EXECUTION_SEQUENCE: recommends the verified goal-type pattern', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6, { goal: 'Fix the failing tests' }));
    const rec = await rig.optimization.recommend('EXECUTION_SEQUENCE');
    expect(rec?.subject).toBe('fix');
  });
});

describe('routing advisory signal (Phase 11 — advisory ONLY)', () => {
  it('reports measured experience for provider/model combos', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [
      { ...makeCompletedRun({ provider: 'gemini', model: 'gemini-2.5' }), count: 6 },
    ]);
    const signal = await rig.optimization.routingSignal();
    expect(signal?.subject).toBe('provider:gemini/model:gemini-2.5');
    expect(signal?.advisory).toBe(true);
    expect(signal?.taskSuccessSignal).toBe(1);
    expect(signal?.verificationReliability).toBe(1);
  });

  it('current health overrides stale routing experience (degraded provider)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [
      { ...makeCompletedRun({ provider: 'gemini', model: 'gemini-2.5' }), count: 6 },
    ]);
    await ingestRuns(rig, verifiedRuns('unused', 6, { provider: 'openai', model: 'gpt-x' }));
    expect((await rig.optimization.routingSignal())?.provider).toBe('gemini');
    const degraded = await rig.optimization.routingSignal({
      runtimeTruth: { degradedProviders: ['gemini'] },
    });
    expect(degraded?.provider).toBe('openai');
    expect(
      await rig.optimization.routingSignal({
        runtimeTruth: { degradedProviders: ['gemini', 'openai'] },
      }),
    ).toBeUndefined();
  });
});

describe('current runtime truth wins (Phase 18, service level)', () => {
  it('unavailable tool overrides historical preference', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await ingestRuns(rig, verifiedRuns('beta', 2));
    expect((await rig.optimization.recommend('TOOL_SELECTION'))?.subject).toBe('alpha');
    const rec = await rig.optimization.recommend('TOOL_SELECTION', {
      runtimeTruth: { availableTools: ['beta'] },
    });
    expect(rec?.subject).toBe('beta');
    expect(rec?.subject).not.toBe('alpha');
  });

  it('explicit current user instruction outranks evidence', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await ingestRuns(rig, verifiedRuns('beta', 2));
    const rec = await rig.optimization.recommend('TOOL_SELECTION', {
      explicitInstruction: { subject: 'TOOL_SELECTION', value: 'beta' },
    });
    expect(rec?.subject).toBe('beta');
  });

  it('authority constraints narrow, never widen (governance wins)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await ingestRuns(rig, verifiedRuns('beta', 2));
    expect(
      (
        await rig.optimization.recommend('TOOL_SELECTION', {
          constraints: { allowedSubjects: ['beta'] },
        })
      )?.subject,
    ).toBe('beta');
    expect(
      await rig.optimization.recommend('TOOL_SELECTION', {
        constraints: { allowedSubjects: ['unheard-of'] },
      }),
    ).toBeUndefined();
  });

  it('capability mismatch cannot be optimized away', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('doc-tool', 6, { capability: 'content_generation' }));
    expect(
      (
        await rig.optimization.recommend('TOOL_SELECTION', {
          constraints: { capability: 'content_generation' },
        })
      )?.subject,
    ).toBe('doc-tool');
    expect(
      await rig.optimization.recommend('TOOL_SELECTION', { constraints: { capability: 'coding' } }),
    ).toBeUndefined();
  });
});

describe('user preferences inform, never decide (Phase 19)', () => {
  it('stored preference ranks below contrary evidence and below the current explicit request', async () => {
    const rig = makeRig();
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'pdf',
        sampleCount: 20,
        successCount: 20,
        failureCount: 0,
        verifiedCount: 20,
        value: 1,
        recency: 1,
      }),
    );
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'docx',
        sampleCount: 5,
        successCount: 4,
        failureCount: 1,
        verifiedCount: 4,
        value: 0.8,
        recency: 1,
      }),
    );
    await rig.service.recordUserPreference({
      userId: 'user-1',
      subject: 'outputFormat',
      value: 'pdf',
      source: 'user-request',
    });
    // No current instruction: the stronger evidence record leads.
    expect((await rig.optimization.recommend('TOOL_SELECTION'))?.subject).toBe('pdf');
    // Current explicit request wins over both the stored preference and evidence.
    const rec = await rig.optimization.recommend('TOOL_SELECTION', {
      explicitInstruction: { subject: 'TOOL_SELECTION', value: 'docx' },
    });
    expect(rec?.subject).toBe('docx');
    // USER_PREFERENCE memory never becomes a strategy target.
    const { decisions } = await rig.optimization.recommendAll({});
    expect(decisions.map((d) => d.target)).not.toContain('USER_PREFERENCE');
  });
});

describe('conservative exploration (Phase 15)', () => {
  it('explores the runner-up only when allowed and only within the bounded share', async () => {
    const explore = makeRig({ random: () => 0.05 });
    await ingestRuns(explore, verifiedRuns('alpha', 6));
    await ingestRuns(explore, verifiedRuns('beta', 2));
    expect((await explore.optimization.recommend('TOOL_SELECTION'))?.subject).toBe('alpha');
    expect(
      (
        await explore.optimization.recommend('TOOL_SELECTION', {
          constraints: { allowExploration: true },
        })
      )?.subject,
    ).toBe('beta');

    const exploit = makeRig({ random: () => 0.9 });
    await ingestRuns(exploit, verifiedRuns('alpha', 6));
    await ingestRuns(exploit, verifiedRuns('beta', 2));
    expect(
      (
        await exploit.optimization.recommend('TOOL_SELECTION', {
          constraints: { allowExploration: true },
        })
      )?.subject,
    ).toBe('alpha');
    // Exploration is opt-in: without the flag, never.
    expect((await exploit.optimization.recommend('TOOL_SELECTION'))?.subject).toBe('alpha');
  });

  it('never explores high-risk subjects', async () => {
    const rig = makeRig({ random: () => 0.0 });
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'delete-everything',
        sampleCount: 4,
        successCount: 4,
        failureCount: 0,
        verifiedCount: 4,
        value: 1,
        recency: 1,
      }),
    );
    const rec = await rig.optimization.recommend('TOOL_SELECTION', {
      constraints: { allowExploration: true },
    });
    expect(rec?.subject).toBe('alpha');
  });

  it('never explores alternatives without evidence', async () => {
    const rig = makeRig({ random: () => 0.0 });
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    await ingestRuns(rig, [{ ...makeCompletedRun({ runId: 'run-beta-once', toolName: 'beta' }) }]);
    const rec = await rig.optimization.recommend('TOOL_SELECTION', {
      constraints: { allowExploration: true },
    });
    expect(rec?.subject).toBe('alpha');
  });
});

describe('recommendation feedback loop + observability (Phase 20/21)', () => {
  it('tracks accepted → executed → verified outcomes and measures accuracy', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec).toBeDefined();
    for (const outcome of [
      'verified_success',
      'verified_success',
      'verified_success',
      'failure',
    ] as const) {
      await rig.optimization.recordOutcome({
        recommendationId: rec!.recommendationId,
        decision: 'accepted',
        outcome,
      });
    }
    await rig.optimization.recordOutcome({
      recommendationId: rec!.recommendationId,
      decision: 'rejected',
    });
    const eff = await rig.optimization.effectiveness(rec!.recommendationId);
    expect(eff.accepted).toBe(4);
    expect(eff.rejected).toBe(1);
    expect(eff.verifiedSuccess).toBe(3);
    expect(eff.failures).toBe(1);
    expect(eff.accuracy).toBe(0.75);
  });

  it('emits observability events for recommendations and outcomes', async () => {
    const onRecommendation = vi.fn();
    const onOutcome = vi.fn();
    const clock = new FakeClock();
    const store = new InMemoryExecutionMemoryStore();
    const service = new ExecutionMemoryService({ store, clock });
    const outcomes = new InMemoryRecommendationOutcomeStore();
    const optimization = new ExperienceOptimizationService({
      memory: new ExperienceMemoryPortAdapter(service, 45, () => clock.timestampMs()),
      outcomes,
      observer: { onRecommendation, onOutcome },
      clock: () => clock.now(),
      random: () => 0.5,
    });
    const rig: TestRig = { clock, service, optimization, store, outcomes };
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const rec = await optimization.recommend('TOOL_SELECTION');
    expect(onRecommendation).toHaveBeenCalledWith('TOOL_SELECTION', 'alpha', 'HIGH_CONFIDENCE');
    await optimization.recordOutcome({
      recommendationId: rec!.recommendationId,
      decision: 'accepted',
      outcome: 'verified_success',
    });
    expect(onOutcome).toHaveBeenCalledTimes(1);
  });

  it('records a decision audit for every optimization query (Phase 20)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const { recommendations, decisions } = await rig.optimization.recommendAll({});
    expect(recommendations.length).toBeGreaterThan(0);
    for (const decision of decisions) {
      expect(decision.advisory).toBe(true);
      expect(decision.candidatesConsidered).toBeLessThanOrEqual(MAX_CANDIDATES_CONSIDERED);
    }
    const tool = decisions.find((d) => d.target === 'TOOL_SELECTION');
    expect(tool?.decided).toBe('recommended');
    expect(tool?.recommendation?.subject).toBe('alpha');
  });
});

describe('bounds (Phase 23)', () => {
  it('honors maxRecommendations and bounds the candidate set considered', async () => {
    const rig = makeRig();
    for (let i = 0; i < 15; i++) {
      await rig.store.save(
        makeEntry({
          category: 'TOOL_RELIABILITY',
          subject: `tool-${String(i).padStart(2, '0')}`,
          sampleCount: 5,
          successCount: 5,
          failureCount: 0,
          verifiedCount: 5,
          value: 1,
          recency: 1,
        }),
      );
    }
    const capped = await rig.optimization.recommendAll({ constraints: { maxRecommendations: 1 } });
    expect(capped.recommendations).toHaveLength(1);
    expect(capped.recommendations[0]?.subject).toBe('tool-00');
    const { decisions } = await rig.optimization.recommendAll({});
    const tool = decisions.find((d) => d.target === 'TOOL_SELECTION');
    expect(tool?.candidatesConsidered).toBeLessThanOrEqual(MAX_CANDIDATES_CONSIDERED);
  });
});

describe('evidence aggregation (Phase 24: duplicates + concurrency)', () => {
  it('merges duplicate evidence into ONE aggregated entry', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 5 }]);
    const entries = await rig.service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sampleCount).toBe(5);
    expect(entries[0]?.verifiedCount).toBe(5);
  });

  it('aggregates concurrent ingests without duplication or corruption', async () => {
    const rig = makeRig();
    const { run, traces } = makeCompletedRun({ toolName: 'alpha' });
    await Promise.all(Array.from({ length: 5 }, () => rig.service.ingestRun(run, traces)));
    const entries = await rig.service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.sampleCount).toBe(5);
  });
});

describe('deterministic scoring + explainability (Phase 6/17)', () => {
  it('scores deterministically; a model is never consulted to rank', async () => {
    const random = vi.fn(() => 0.5);
    const rig = makeRig({ random });
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const a = await rig.optimization.recommend('TOOL_SELECTION');
    const b = await rig.optimization.recommend('TOOL_SELECTION');
    expect(a?.subject).toBe(b?.subject);
    expect(a?.score).toBe(b?.score);
    expect(random).not.toHaveBeenCalled(); // exploration disabled → no RNG
  });

  it('explains with counts and conservative language — never unsupported claims', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    const text = rec?.explanation.join(' ') ?? '';
    expect(text).toContain('6 verified executions');
    expect(text).toContain('100.0% verified success');
    expect(text).toMatch(/high-confidence/i);
    expect(text.toLowerCase()).not.toMatch(/\bbest\b/);
    expect(rec?.alternatives.length).toBeLessThanOrEqual(2);
  });
});

describe('recency decay + strategy degradation (Phase 14)', () => {
  it('stale evidence loses influence but is never deleted', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const fresh = await rig.optimization.recommend('TOOL_SELECTION');
    expect(fresh?.evidenceLevel).toBe('HIGH_CONFIDENCE');
    rig.clock.advanceDays(300);
    const stale = await rig.optimization.recommend('TOOL_SELECTION');
    expect(stale?.evidenceLevel).toBe('RELIABLE');
    expect(stale?.score).toBeLessThan(fresh!.score);
    const entries = await rig.service.listEntries({ category: 'TOOL_RELIABILITY' });
    expect(entries).toHaveLength(1); // historical record retained
  });

  it('detects degradation: fresh verified evidence outranks a previously dominant strategy', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    expect((await rig.optimization.recommend('TOOL_SELECTION'))?.subject).toBe('alpha');
    await ingestRuns(rig, verifiedRuns('alpha', 6, { verdicts: ['FAILED'] }));
    rig.clock.advanceDays(1);
    await ingestRuns(rig, verifiedRuns('gamma', 6));
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec?.subject).toBe('gamma');
    const ranked = await rig.optimization.rankCandidates('TOOL_SELECTION');
    expect(ranked.find((c) => c.subject === 'alpha')?.evidence.evidenceLevel).toBe('EMERGING');
    expect((await rig.optimization.compare('alpha', 'gamma', 'TOOL_SELECTION'))?.verdict).toBe(
      'B_CREDIBLY_BETTER',
    );
  });
});

describe('malformed + fabricated evidence rejected (Phase 24)', () => {
  it('rejects zero-sample entries and clamps fabricated rates', async () => {
    const rig = makeRig();
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'zero-sample',
        sampleCount: 0,
        successCount: 0,
        failureCount: 0,
        verifiedCount: 0,
        value: 0.5,
        recency: 1,
      }),
    );
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'fabricated',
        sampleCount: 10,
        successCount: 15,
        failureCount: -5,
        verifiedCount: 15,
        value: 1.5,
        recency: 1,
      }),
    );
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    // The fabricated entry is still surfaced (memory is never silently
    // deleted) — but its rates are CLAMPED, never inflated.
    expect(rec?.subject).toBe('fabricated');
    expect(rec?.explanation.join(' ')).toContain('100.0% verified success');
    expect(rec?.explanation.join(' ')).not.toContain('150');
    expect(rec?.score ?? 2).toBeLessThanOrEqual(1);
  });

  it('tolerates NaN aggregates (clamped to neutral, score stays finite)', async () => {
    const rig = makeRig();
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'nan-value',
        sampleCount: 6,
        successCount: 6,
        failureCount: 0,
        verifiedCount: 6,
        value: Number.NaN,
        recency: 1,
      }),
    );
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(Number.isFinite(rec?.score)).toBe(true);
    const ranked = await rig.optimization.rankCandidates('TOOL_SELECTION');
    expect(ranked[0]?.evidence.goalCompletionRate).toBe(0);
  });
});

describe('secret sanitization (defense in depth)', () => {
  it('never leaks secrets through recommendations', async () => {
    const rig = makeRig();
    const secret = 'sk-abcdefghijklmnopqrstuvwxyz012345';
    await ingestRuns(
      rig,
      verifiedRuns('alpha', 6, { goal: `Fix the failing tests using key ${secret}` }),
    );
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    const all = await rig.optimization.recommendAll({});
    expect(JSON.stringify({ rec, ...all })).not.toContain(secret);
    expect(rec?.explanation.join(' ')).not.toContain('sk-');
  });
});

describe('cross-user isolation', () => {
  it('USER-scoped evidence is visible only to its owner', async () => {
    const rig = makeRig();
    await rig.store.save(
      makeEntry({
        category: 'TOOL_RELIABILITY',
        subject: 'user-tool',
        scope: 'USER',
        userId: 'user-1',
        sampleCount: 6,
        successCount: 6,
        failureCount: 0,
        verifiedCount: 6,
        value: 1,
        recency: 1,
      }),
    );
    expect(
      (await rig.optimization.recommend('TOOL_SELECTION', { userId: 'user-1' }))?.subject,
    ).toBe('user-tool');
    expect(
      await rig.optimization.recommend('TOOL_SELECTION', { userId: 'user-2' }),
    ).toBeUndefined();
  });
});

describe('no authority escalation, no self-modification (Phase 16/26)', () => {
  it('recommendations are advisory and carry no budget/authority surface', async () => {
    const rig = makeRig();
    await ingestRuns(rig, verifiedRuns('alpha', 6));
    const rec = await rig.optimization.recommend('TOOL_SELECTION');
    expect(rec?.advisory).toBe(true);
    const serialized = JSON.parse(JSON.stringify(rec)) as Record<string, unknown>;
    for (const forbidden of ['budget', 'permission', 'authority', 'approval', 'code', 'config']) {
      expect(serialized).not.toHaveProperty(forbidden);
    }
    const { decisions } = await rig.optimization.recommendAll({});
    for (const decision of decisions) expect(decision.advisory).toBe(true);
  });

  it('exposes no execution/authorization surface on the service prototype', () => {
    const names = Object.getOwnPropertyNames(ExperienceOptimizationService.prototype);
    expect(names).toContain('recommend');
    for (const name of names) {
      expect(name).not.toMatch(/execute|authorize|grant|bypass|approve|writefile|mutateconfig/i);
    }
  });
});
