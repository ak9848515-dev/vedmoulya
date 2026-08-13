// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Observability Wiring tests
// EPIC-012 — Production Observability & Control Plane (Phases 2–7, 16)
//
// End-to-end through the REAL gateway wiring: a user journey
// (requirements.start → factory.create → approve → build) runs against the
// real ApiApplicationService (mock AI runtime, in-memory registries), and
// the correlated trace spine must reconstruct it:
//   - engine spans (requirements.start / factory.create / factory.build)
//   - AI spans (ai.run / ai.provider_execution) parented UNDER the engine
//     span via the ambient context (single correlated trace)
//   - the ops control plane reads the same journey back
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeAll } from 'vitest';
import { ApiApplicationService } from '../services/ApiApplicationService.js';
import { InMemoryApplicationRepository } from '@vedmoulya/app-factory';
import { InMemoryRequirementSessionStore } from '@vedmoulya/requirements';

// The developer shell may carry a real provider key; this test must run
// against the deterministic MockProvider only (same convention as the
// router-registry E2E) so builds complete fast and hermetic.
beforeAll(() => {
  process.env.OPENAI_API_KEY = '';
  process.env.AI_OPENAI_API_KEY = '';
  process.env.AI_ANTHROPIC_API_KEY = '';
  process.env.AI_GOOGLE_API_KEY = '';
});

describe('EPIC-012 observability wiring', () => {
  it('reconstructs a real application journey from the trace spine', async () => {
    const svc = new ApiApplicationService({
      factoryRegistry: new InMemoryApplicationRepository(),
      requirementSessionStore: new InMemoryRequirementSessionStore(),
    });

    expect(svc.traceProvider).toBeDefined();
    expect(svc.ops).toBeDefined();
    expect(svc.traceProvider.isEnabled()).toBe(true);

    const userId = 'wiring-user';

    // Requirements stage (deterministic engine — no AI needed to start).
    const req = await svc.requirements.start({ idea: 'A restaurant menu app', userId });
    expect(req.sessionId).toBeDefined();

    // Factory stage: create → approve → build (real engine + mock AI runtime).
    const created = await svc.factory.create({ goal: 'A restaurant menu app', userId });
    const appId = created.applicationId;
    await svc.factory.approve(appId, userId);
    const build = await svc.factory.build({ applicationId: appId, userId, approved: true });
    expect(build.status).toBeDefined();

    // The trace spine now holds the correlated journey.
    const traces = svc.traceProvider.listTraces({ userId, limit: 100 });
    const names = traces.map((t) => t.name);
    expect(names).toContain('factory.create');
    expect(names).toContain('factory.build');
    expect(names).toContain('requirements.start');

    // The factory.build trace carries authoritative economics + outcome.
    const buildTrace = traces.find((t) => t.name === 'factory.build');
    expect(buildTrace?.applicationId).toBe(appId);
    expect(buildTrace?.status).toBeDefined();
    const buildSpan = buildTrace?.spans.find((s) => s.name === 'factory.build');
    expect(buildSpan?.attributes.tokens_total).toBeGreaterThan(0);
    expect(buildSpan?.attributes.cost_usd).toBeGreaterThanOrEqual(0);
    expect(buildSpan?.attributes.status).toBe(build.status);

    // AI spans are parented UNDER the engine span (one correlated trace).
    const aiSpans = buildTrace?.spans.filter((s) => s.kind === 'ai') ?? [];
    expect(aiSpans.length).toBeGreaterThan(0);
    const aiRun = aiSpans.find((s) => s.name === 'ai.run');
    expect(aiRun).toBeDefined();
    expect(aiRun?.parentSpanId).toBe(buildSpan?.spanId);
    expect(aiSpans.every((s) => s.traceId === buildTrace?.traceId)).toBe(true);

    // The ops control plane reads the same journey back (owner-scoped).
    const opsTraces = svc.ops.listTraces({ userId, limit: 100 });
    expect(opsTraces.map((t) => t.name)).toEqual(
      expect.arrayContaining(['factory.create', 'factory.build']),
    );
    const ledger = svc.ops.costLedger({ userId });
    expect(ledger.executions.length).toBeGreaterThan(0);
    expect(ledger.totals.tokensTotal).toBeGreaterThan(0);
    const health = await svc.ops.applicationHealth({ userId });
    expect(health.find((h) => h.applicationId === appId)).toBeDefined();
  }, 90_000);

  it('exposes provider health through the control plane', async () => {
    const svc = new ApiApplicationService({
      factoryRegistry: new InMemoryApplicationRepository(),
      requirementSessionStore: new InMemoryRequirementSessionStore(),
    });
    const health = await svc.ops.providerHealth({ userId: 'wiring-user' });
    expect(Array.isArray(health)).toBe(true);
  });
});
