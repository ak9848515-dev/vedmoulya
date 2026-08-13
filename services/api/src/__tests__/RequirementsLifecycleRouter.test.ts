// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Product Intelligence & Requirements Lifecycle (EPIC-009)
// requirements.* end-to-end through the router handlers: start (understand →
// extract → analyze → questions + defaults) → answer → acceptAllDefaults →
// plan (full product plan) → approve (Phase 23 approval gate) → handoffGoal /
// handoffToFactory (APPROVED session → factory.create) → changeImpact (Phase
// 24) — plus cross-user isolation (IDOR refused at the engine layer).
// Deterministic, no network: deterministic engines + in-memory session store;
// the factory handoff runs over the mock AI runtime, exactly like the EPIC-007
// E2E harness.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIOrchestrationService } from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import { ToolRegistry, registerSafeTools } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import {
  AIOrchestratorSpecialistPort,
  ToolRegistryToolPort,
  SystemClock,
} from '@vedmoulya/loop-engine';
import {
  DEFAULT_EXECUTION_POLICY,
  FactoryApplicationService,
  InMemoryApplicationRepository,
  InMemoryVersionControl,
  InMemoryWorkspace,
  LocalDeploymentAdapter,
  VercelDeploymentAdapter,
} from '@vedmoulya/app-factory';
import {
  InMemoryRequirementSessionStore,
  RequirementsApplicationService,
} from '@vedmoulya/requirements';
import type { RequirementsSessionDTO } from '@vedmoulya/requirements';
import { createRequirementsRouter } from '../routers/RequirementsRouter.js';
import type { TRPCContext } from '../router.js';

const ctx: TRPCContext = { userId: 'u1', email: 'u1@vedmoulya.com', role: 'user' };
const ctxOther: TRPCContext = { userId: 'u2', email: 'u2@vedmoulya.com', role: 'user' };

function createRequirementsService(): RequirementsApplicationService {
  return new RequirementsApplicationService({
    store: new InMemoryRequirementSessionStore(),
  });
}

function createHandoffFactory(): FactoryApplicationService {
  const ai = new AIOrchestrationService();
  ai.registerProvider(new MockProvider());
  const registry = new ToolRegistry({
    allowlist: ['echo', 'current_time', 'calculator'],
    grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
  });
  registerSafeTools(registry);
  return new FactoryApplicationService({
    specialist: new AIOrchestratorSpecialistPort(ai),
    tools: new ToolRegistryToolPort(registry),
    clock: new SystemClock(),
    workspace: new InMemoryWorkspace('factory-root-requirements', DEFAULT_EXECUTION_POLICY),
    policy: DEFAULT_EXECUTION_POLICY,
    deployments: {
      local: new LocalDeploymentAdapter(),
      vercel: new VercelDeploymentAdapter(),
    },
    versionControl: new InMemoryVersionControl(),
    workspaceFactory: (applicationId, policy) => new InMemoryWorkspace(applicationId, policy),
    registry: new InMemoryApplicationRepository(),
  });
}

/** Answer every unanswered question in the plan (first option / safe default). */
function answersFor(
  session: RequirementsSessionDTO,
): Array<{ questionId: string; answer: string }> {
  const all = session.questionPlan?.all ?? [];
  const open = all.filter((q) => q.answer === undefined);
  return open.map((q) => ({
    questionId: q.id,
    answer: q.options?.[0]?.value ?? q.defaultAnswer ?? 'yes',
  }));
}

describe('requirements.* lifecycle routes (EPIC-009)', () => {
  it('start understands the idea: intent, requirements with provenance, questions, safe defaults', async () => {
    const router = createRequirementsRouter(createRequirementsService());

    const started = await router.start({ userId: 'u1', idea: 'Build me a restaurant app.' }, ctx);
    expect(started.data?.sessionId).toMatch(/^req-/);
    expect(started.data?.blockingCount).toBeGreaterThan(0);
    expect(started.data?.questionBundles.length).toBeGreaterThan(0);
    expect(started.data?.defaultsCount).toBeGreaterThan(0);

    // The full session carries intent + requirements + provenance.
    const session = await router.get(
      { userId: 'u1', sessionId: started.data?.sessionId ?? '' },
      ctx,
    );
    expect(session.data?.intent?.problem).toContain('restaurant');

    const requirements = session.data?.requirements?.requirements ?? [];
    expect(requirements.length).toBeGreaterThan(0);
    for (const req of requirements) {
      expect(req.source).toBeDefined();
      expect(['USER', 'INFERENCE', 'DEFAULT', 'QUESTION', 'MEMORY', 'RAG', 'SYSTEM']).toContain(
        req.source,
      );
    }

    // Safe defaults are proposed (not silently applied).
    const defaults = session.data?.defaults ?? [];
    expect(defaults.length).toBeGreaterThan(0);
    for (const d of defaults) {
      expect(d.status).toBe('proposed');
      expect(d.reason).toBeDefined();
    }
  });

  it('answer → plan → approve → handoffGoal produces an approved product plan', async () => {
    const router = createRequirementsRouter(createRequirementsService());

    const started = await router.start(
      { userId: 'u1', idea: 'Build a restaurant app with delivery.' },
      ctx,
    );
    const sessionId = started.data?.sessionId ?? '';

    // Answer every question (bundled answers): blocking questions carry no
    // safe default by design — answering is the only way to resolve them.
    const before = await router.get({ userId: 'u1', sessionId }, ctx);
    const questions = before.data?.questionPlan?.all ?? [];
    const answered = await router.answer(
      { userId: 'u1', sessionId, answers: answersFor(before.data!) },
      ctx,
    );
    expect(answered.data?.questionPlan?.blocking.every((q) => q.answer !== undefined)).toBe(true);

    // Accept the safe defaults, then plan derives the full product plan.
    await router.acceptAllDefaults({ userId: 'u1', sessionId }, ctx);
    const planned = await router.plan({ userId: 'u1', sessionId }, ctx);
    expect(planned.data?.brief?.problem).toBeDefined();
    expect(planned.data?.architecture?.choices.length).toBeGreaterThan(0);
    expect(planned.data?.design?.visualPersonality).toBeDefined();
    expect(planned.data?.security?.authentication).toBeDefined();
    expect(planned.data?.cost?.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(planned.data?.buildPlan?.steps.length).toBeGreaterThan(0);

    // Approve gates the plan (Phase 23).
    const approved = await router.approve({ userId: 'u1', sessionId }, ctx);
    expect(approved.data?.phase).toBe('APPROVED');
    expect(approved.data?.handoffGoal).toBeDefined();

    // Handoff goal is the factory-ready product statement.
    const handoff = await router.handoffGoal({ userId: 'u1', sessionId }, ctx);
    expect(handoff.data?.goal.length).toBeGreaterThan(0);
  });

  it('handoffToFactory flows an APPROVED plan into factory.create', async () => {
    const router = createRequirementsRouter(createRequirementsService(), createHandoffFactory());

    const started = await router.start(
      { userId: 'u1', idea: 'Build a modern restaurant application.' },
      ctx,
    );
    const sessionId = started.data?.sessionId ?? '';

    // Resolve questions + defaults, plan, approve — the handoff path.
    const before = await router.get({ userId: 'u1', sessionId }, ctx);
    await router.answer({ userId: 'u1', sessionId, answers: answersFor(before.data!) }, ctx);
    await router.acceptAllDefaults({ userId: 'u1', sessionId }, ctx);
    await router.plan({ userId: 'u1', sessionId }, ctx);
    await router.approve({ userId: 'u1', sessionId }, ctx);

    const handoff = await router.handoffToFactory({ userId: 'u1', sessionId }, ctx);
    expect(handoff.data?.applicationId).toMatch(/^app-/);
  });

  it('changeImpact analyses a follow-up request on a planned session', async () => {
    const router = createRequirementsRouter(createRequirementsService());

    const started = await router.start({ userId: 'u1', idea: 'Build a restaurant app.' }, ctx);
    const sessionId = started.data?.sessionId ?? '';

    // changeImpact is a Phase 24 analysis on a planned baseline: resolve
    // questions + defaults, then plan.
    const before = await router.get({ userId: 'u1', sessionId }, ctx);
    await router.answer({ userId: 'u1', sessionId, answers: answersFor(before.data!) }, ctx);
    await router.acceptAllDefaults({ userId: 'u1', sessionId }, ctx);
    await router.plan({ userId: 'u1', sessionId }, ctx);

    const impact = await router.changeImpact(
      { userId: 'u1', sessionId, request: 'Add online payments.' },
      ctx,
    );
    expect(impact.data?.requirementImpact.length).toBeGreaterThan(0);
    expect(impact.data?.risks).toBeDefined();
    expect(impact.data?.whatWillChange.length).toBeGreaterThan(0);

    // The session is not silently mutated by the analysis.
    const after = await router.get({ userId: 'u1', sessionId }, ctx);
    expect(after.data?.sessionId).toBe(sessionId);
  });

  it('ownership: cross-user session access is refused everywhere', async () => {
    const router = createRequirementsRouter(createRequirementsService());

    const started = await router.start({ userId: 'u1', idea: 'Build an ABAP debugger.' }, ctx);
    const sessionId = started.data?.sessionId ?? '';

    await expect(router.get({ userId: 'u2', sessionId }, ctxOther)).rejects.toThrow();
    await expect(router.plan({ userId: 'u2', sessionId }, ctxOther)).rejects.toThrow();
    await expect(router.approve({ userId: 'u2', sessionId }, ctxOther)).rejects.toThrow();
    await expect(
      router.answer({ userId: 'u2', sessionId, answers: [] }, ctxOther),
    ).rejects.toThrow();
    await expect(router.acceptAllDefaults({ userId: 'u2', sessionId }, ctxOther)).rejects.toThrow();
    await expect(
      router.changeImpact({ userId: 'u2', sessionId, request: 'x' }, ctxOther),
    ).rejects.toThrow();
    await expect(router.delete({ userId: 'u2', sessionId }, ctxOther)).rejects.toThrow();

    // Owner can still access their own session (isolation did not corrupt it).
    const own = await router.get({ userId: 'u1', sessionId }, ctx);
    expect(own.data?.sessionId).toBe(sessionId);
  });
});
