// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Adaptive Application Experience Lifecycle (EPIC-010)
// experience.* end-to-end through the router handlers: evaluate (design system
// + UI blueprint + design decisions + visual critic + multi-dimensional
// quality + traceability for a persisted generated application), findings
// (Phase 10 evidence-classified critic findings), refine (Phase 12/13 targeted
// refinement with change impact) — plus cross-user isolation (IDOR refused at
// the factory engine, exactly like the EPIC-007/009 harnesses).
// Deterministic, no network: the mock AI runtime powers the factory; the
// experience engines are fully deterministic.
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
import { ExperienceApplicationService } from '@vedmoulya/experience';
import type { AICritiquePort, AICritiqueResult } from '@vedmoulya/experience';
import { createExperienceRouter } from '../routers/ExperienceRouter.js';
import type { TRPCContext } from '../router.js';

const ctx: TRPCContext = { userId: 'u1', email: 'u1@vedmoulya.com', role: 'user' };
const ctxOther: TRPCContext = { userId: 'u2', email: 'u2@vedmoulya.com', role: 'user' };

function createFactory(): FactoryApplicationService {
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
    workspace: new InMemoryWorkspace('factory-root-experience', DEFAULT_EXECUTION_POLICY),
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

/** Create + approve + build a restaurant application (real persisted files). */
async function buildRestaurantApp(factory: FactoryApplicationService): Promise<string> {
  const created = await factory.create({
    goal: 'Build a modern restaurant application with menu, cart, checkout and order tracking.',
    userId: 'u1',
  });
  const applicationId = created.applicationId;
  await factory.approve(applicationId, 'u1');
  const built = await factory.build({
    applicationId,
    userId: 'u1',
    approved: true,
    generate: true,
  });
  expect(built.status).toBe('READY');
  return applicationId;
}

describe('experience.* lifecycle routes (EPIC-010)', () => {
  it('evaluate derives the design system, blueprint, critic, quality and traceability', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    const evaluated = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    expect(evaluated.data?.applicationId).toBe(applicationId);
    expect(evaluated.data?.archetype).toBe('restaurant-app');

    // Design system: domain-aware, tokenized (never scattered styling).
    const tokens = evaluated.data?.designSystem.tokens ?? [];
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => t.group === 'color')).toBe(true);
    expect(tokens.every((t) => t.rationale)).toBe(true);
    expect(evaluated.data?.designSystem.components.length).toBeGreaterThan(0);

    // UI blueprint: screens + routes + states.
    expect(evaluated.data?.blueprint.screens.length).toBeGreaterThan(0);
    expect(evaluated.data?.blueprint.navigation.length).toBeGreaterThan(0);

    // Design decisions carry rationale + source + alternatives.
    const decisions = evaluated.data?.designDecisions ?? [];
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) {
      expect(d.decision).toBeDefined();
      expect(d.rationale).toBeDefined();
      expect(d.source).toBeDefined();
    }

    // Critic: structured findings with severity + evidence.
    const critic = evaluated.data?.critic;
    expect(critic.findings.length).toBeGreaterThan(0);
    for (const f of critic.findings) {
      expect(f.id).toMatch(/^VC-/);
      expect(f.evidence).toBeDefined();
      expect(f.recommendation).toBeDefined();
    }

    // Multi-dimensional quality: no aggregate can hide a critical failure.
    const quality = evaluated.data?.quality;
    expect(quality.dimensions.length).toBeGreaterThan(0);
    expect(quality.verdict).toBeDefined();

    // Traceability: requirement → design → component → file.
    expect((evaluated.data?.traceability ?? []).length).toBeGreaterThan(0);
  });

  it('evaluate tolerates an application without security/validation evidence yet', async () => {
    // A DRAFT application (created, not yet built) has no security report or
    // validation gates — the router must not fail on the undefined evidence.
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const created = await factory.create({
      goal: 'Build a simple internal utility tool.',
      userId: 'u1',
    });
    const applicationId = created.applicationId;

    const evaluated = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    expect(evaluated.data?.applicationId).toBe(applicationId);
    expect(evaluated.data?.quality.verdict).toBeDefined();

    const findings = await router.findings({ userId: 'u1', applicationId }, ctx);
    expect(findings.data?.findings).toBeDefined();
  });

  it('findings returns evidence-classified critic findings (Phase 10)', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    const result = await router.findings({ userId: 'u1', applicationId }, ctx);
    const findings = result.data?.findings ?? [];
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND']).toContain(f.evidenceClass);
      expect(f.summary).toBeDefined();
    }
  });

  it('refine plans a targeted change for a real finding — never regenerate-all', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    const evaluated = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    const findingId = evaluated.data?.critic.findings[0]?.id ?? '';
    expect(findingId).toBeTruthy();

    const refined = await router.refine({ userId: 'u1', applicationId, findingId }, ctx);
    expect(refined.data?.applicationId).toBe(applicationId);
    expect(refined.data?.plan.findingId).toBe(findingId);
    expect(refined.data?.plan.fileOperations.length).toBeGreaterThan(0);
    expect(refined.data?.plan.impact.targeted).toBe(true);
    // Refinement touches only the affected layer; other files stay untouched.
    expect(refined.data?.plan.untouched.length).toBeGreaterThan(0);
  });

  it('refine refuses an unknown finding id (no silent regeneration)', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    await expect(
      router.refine({ userId: 'u1', applicationId, findingId: 'VC-9999' }, ctx),
    ).rejects.toThrow();
  });

  it('evaluateWithAI merges a live AI critique through the same evidence-first format', async () => {
    const factory = createFactory();
    const aiPort: AICritiquePort = {
      critique: async (): Promise<AICritiqueResult> => ({
        provider: 'fake',
        model: 'fake-v1',
        tokens: { input: 50, output: 30, total: 80 },
        costUsd: 0.001,
        latencyMs: 5,
        abstained: false,
        findings: [
          {
            severity: 'HIGH',
            area: 'hierarchy',
            location: 'app',
            issue: 'Primary action competes visually with secondary actions',
            evidence:
              'The generated button class `btn` (present in the persisted source) shares emphasis across all actions.',
            recommendation: 'Increase primary CTA prominence and reduce secondary emphasis',
            confidence: 'HIGH',
          },
        ],
      }),
    };
    const experience = new ExperienceApplicationService({ aiCritique: aiPort });
    const router = createExperienceRouter(experience, factory);
    const applicationId = await buildRestaurantApp(factory);

    const plain = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    const withAI = await router.evaluateWithAI({ userId: 'u1', applicationId }, ctx);

    expect(withAI.data?.critic.findings.length).toBeGreaterThan(
      plain.data?.critic.findings.length ?? 0,
    );
    const aiFinding = withAI.data?.critic.findings.find((f) => f.issue.includes('Primary action'));
    expect(aiFinding).toBeDefined();
    expect(['CONFIRMED', 'LIKELY', 'UNCERTAIN', 'NOT_FOUND']).toContain(aiFinding?.evidenceClass);
    expect(aiFinding?.autoFixable).toBe(false);
    expect(withAI.data?.quality.verdict).toBeDefined();
  });

  it('evaluateWithAI without a seam is deterministic and identical to evaluate', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    const plain = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    const withAI = await router.evaluateWithAI({ userId: 'u1', applicationId }, ctx);
    expect(withAI.data?.critic.findings).toEqual(plain.data?.critic.findings);
    expect(withAI.data?.quality.overall).toBe(plain.data?.quality.overall);
  });

  it('ownership: cross-user experience access is refused at the factory engine', async () => {
    const factory = createFactory();
    const router = createExperienceRouter(new ExperienceApplicationService(), factory);
    const applicationId = await buildRestaurantApp(factory);

    await expect(router.evaluate({ userId: 'u2', applicationId }, ctxOther)).rejects.toThrow();
    await expect(
      router.evaluateWithAI({ userId: 'u2', applicationId }, ctxOther),
    ).rejects.toThrow();
    await expect(router.findings({ userId: 'u2', applicationId }, ctxOther)).rejects.toThrow();
    await expect(
      router.refine({ userId: 'u2', applicationId, findingId: 'VC-001' }, ctxOther),
    ).rejects.toThrow();

    // Owner can still evaluate their own application (isolation did not corrupt it).
    const own = await router.evaluate({ userId: 'u1', applicationId }, ctx);
    expect(own.data?.applicationId).toBe(applicationId);
  });
});
