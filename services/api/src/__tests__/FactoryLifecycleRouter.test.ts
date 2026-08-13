// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Application Factory Lifecycle (EPIC-008)
// Phase 1 (rename / archive / delete-per-policy / resume) + Phase 14
// (version history) through the factory.* router handlers. Deterministic,
// no network: the factory runs over the mock AI runtime + in-memory
// persistence, exactly like the EPIC-007 E2E harness in router-registry.
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
import { createFactoryRouter } from '../routers/FactoryRouter.js';
import type { TRPCContext } from '../router.js';

const ctx: TRPCContext = { userId: 'u1', email: 'u1@vedmoulya.com', role: 'user' };
const ctxOther: TRPCContext = { userId: 'u2', email: 'u2@vedmoulya.com', role: 'user' };

function createLifecycleFactory(): FactoryApplicationService {
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
    workspace: new InMemoryWorkspace('factory-root-lifecycle', DEFAULT_EXECUTION_POLICY),
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

describe('factory.* lifecycle routes (EPIC-008)', () => {
  it('create → rename → archive → resume → history → delete (per policy)', async () => {
    const router = createFactoryRouter(createLifecycleFactory());

    const created = await router.create({ userId: 'u1', goal: 'Build a restaurant app.' }, ctx);
    const applicationId = created.data?.applicationId ?? '';
    expect(applicationId).toMatch(/^app-/);

    // Rename (recorded in history).
    const renamed = await router.rename(
      { userId: 'u1', applicationId, name: 'Orderly Bites' },
      ctx,
    );
    expect(renamed.data?.name).toBe('Orderly Bites');
    const statusAfterRename = await router.status({ userId: 'u1', applicationId }, ctx);
    expect(statusAfterRename.data?.name).toBe('Orderly Bites');

    // History contains created + renamed.
    const history = await router.history({ userId: 'u1', applicationId }, ctx);
    expect((history.data ?? []).map((v) => v.change)).toEqual([
      'created',
      'renamed to "Orderly Bites"',
    ]);

    // Archive.
    const archived = await router.archive({ userId: 'u1', applicationId }, ctx);
    expect(archived.data?.status).toBe('ARCHIVED');

    // Resume → DRAFT (plan kept).
    const resumed = await router.resume({ userId: 'u1', applicationId }, ctx);
    expect(resumed.data?.status).toBe('DRAFT');

    // Delete requires explicit confirmation.
    const refused = await router.delete({ userId: 'u1', applicationId, confirm: false }, ctx);
    expect(refused.data?.deleted).toBe(false);
    const deleted = await router.delete({ userId: 'u1', applicationId, confirm: true }, ctx);
    expect(deleted.data?.deleted).toBe(true);
    const list = await router.list({ userId: 'u1' }, ctx);
    expect(list.data ?? []).toHaveLength(0);
  });

  it('ownership: lifecycle operations on a foreign application are refused', async () => {
    const router = createFactoryRouter(createLifecycleFactory());
    const created = await router.create({ userId: 'u1', goal: 'Build an ABAP debugger.' }, ctx);
    const applicationId = created.data?.applicationId ?? '';

    await expect(
      router.rename({ userId: 'u2', applicationId, name: 'hijacked' }, ctxOther),
    ).rejects.toThrow();
    await expect(router.archive({ userId: 'u2', applicationId }, ctxOther)).rejects.toThrow();
    await expect(
      router.delete({ userId: 'u2', applicationId, confirm: true }, ctxOther),
    ).rejects.toThrow();
    await expect(router.resume({ userId: 'u2', applicationId }, ctxOther)).rejects.toThrow();
    await expect(router.history({ userId: 'u2', applicationId }, ctxOther)).rejects.toThrow();
  });
});
