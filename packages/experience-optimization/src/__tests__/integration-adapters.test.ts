// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Integration Adapter Tests
//
// Proves the ADVISORY integration seams (Phase 7/11/12):
//   - PlanningExperienceAdapter: bounded plan/tool/sequence evidence for
//     the planner — the planner still validates everything itself.
//   - AdaptiveExperienceAdapter: recovery + alternate-tool suggestions
//     after a failure — the loop still validates/authorizes every action.
//   - RoutingExperienceAdapter: advisory provider/model signal — the
//     existing router stays authoritative; current health wins.
// Hermetic: in-memory store, fake clock, no network.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  AdaptiveExperienceAdapter,
  PlanningExperienceAdapter,
  RoutingExperienceAdapter,
} from '../infrastructure/integration-adapters.js';
import { ingestRuns, makeCompletedRun, makeRig } from './fixtures.js';

describe('planner advisory (Phase 7 — advisory only)', () => {
  it('surfaces plan-pattern, tool and sequence evidence for planning', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 6 }]);
    const adapter = new PlanningExperienceAdapter(rig.optimization);
    const advisory = await adapter.advisoryForPlanning({ capabilities: ['coding'] });
    expect(advisory.advisory).toBe(true);
    expect(advisory.planPattern?.subject).toBe('coding:1steps');
    expect(advisory.toolSelection?.subject).toBe('alpha');
    expect(advisory.summary).toContain('PLAN_PATTERN');
    expect(advisory.summary).toContain('TOOL_SELECTION');
  });

  it('reports honestly when no sufficient evidence exists', async () => {
    const rig = makeRig();
    const adapter = new PlanningExperienceAdapter(rig.optimization);
    const advisory = await adapter.advisoryForPlanning();
    expect(advisory.planPattern).toBeUndefined();
    expect(advisory.toolSelection).toBeUndefined();
    expect(advisory.summary).toBe('no sufficient strategy evidence available');
  });
});

describe('adaptive-loop advisory (Phase 12 — advisory only)', () => {
  it('proposes an alternate authorized tool when the current one fails', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 6 }]);
    await ingestRuns(rig, [
      { ...makeCompletedRun({ runId: 'run-beta', toolName: 'beta' }), count: 2 },
    ]);
    const adapter = new AdaptiveExperienceAdapter(rig.optimization);
    const advisory = await adapter.advisoryForFailure({
      failureClass: 'TOOL_UNAVAILABLE',
      capability: 'coding',
      failedTool: 'alpha',
      allowedTools: ['alpha', 'beta'],
      runtimeTruth: { availableTools: ['beta'] },
    });
    expect(advisory.advisory).toBe(true);
    expect(advisory.alternateTools[0]?.subject).toBe('beta');
    expect(advisory.summary).toContain('alternate tool');
  });

  it('proposes the historically recovering strategy after a failure', async () => {
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
          recoveryStrategy: 'revise_step',
          verdicts: ['FAILED'],
        }),
        count: 2,
      },
    ]);
    const adapter = new AdaptiveExperienceAdapter(rig.optimization);
    const advisory = await adapter.advisoryForFailure({ failureClass: 'TIMEOUT' });
    expect(advisory.recovery?.subject).toBe('alternate_tool');
    expect(advisory.summary).toContain('recovery');
  });

  it('never proposes a tool outside the allowed set (authority unchanged)', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [{ ...makeCompletedRun({ toolName: 'alpha' }), count: 6 }]);
    await ingestRuns(rig, [
      { ...makeCompletedRun({ runId: 'run-beta', toolName: 'beta' }), count: 2 },
    ]);
    const adapter = new AdaptiveExperienceAdapter(rig.optimization);
    const advisory = await adapter.advisoryForFailure({
      failedTool: 'beta',
      allowedTools: ['beta'],
    });
    expect(advisory.alternateTools).toHaveLength(0);
  });
});

describe('routing advisory (Phase 11 — the router stays authoritative)', () => {
  it('provides an advisory signal, never a binding selection', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [
      { ...makeCompletedRun({ provider: 'gemini', model: 'gemini-2.5' }), count: 6 },
    ]);
    const adapter = new RoutingExperienceAdapter(rig.optimization);
    const signal = await adapter.routingAdvisory();
    expect(signal?.advisory).toBe(true);
    expect(signal?.subject).toBe('provider:gemini/model:gemini-2.5');
    expect(signal?.verificationReliability).toBe(1);
  });

  it('drops stale experience when current health disagrees', async () => {
    const rig = makeRig();
    await ingestRuns(rig, [
      { ...makeCompletedRun({ provider: 'gemini', model: 'gemini-2.5' }), count: 6 },
    ]);
    const adapter = new RoutingExperienceAdapter(rig.optimization);
    expect(
      await adapter.routingAdvisory({ runtimeTruth: { degradedProviders: ['gemini'] } }),
    ).toBeUndefined();
  });
});
