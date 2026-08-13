// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ops Control Plane tests
// EPIC-012 — Production Observability & Control Plane (Phases 9–14)
// Verifies: owner-scoped telemetry reads (IDOR), operator gate, audited
// control actions, cost ledger + anomaly detection, application health
// verdicts, incident diagnostics, and the TraceProviderOtelBridge
// redaction guarantee.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeEach } from 'vitest';
import { ExecutionTraceProvider, InMemoryTraceStore, NotFoundError } from '@vedmoulya/core';
import type { TelemetrySpanHandle } from '@vedmoulya/core';
import { OpsApplicationService } from '../services/OpsApplicationService.js';
import { CostLedger } from '../observability/CostLedger.js';
import { AlertEngine } from '../observability/AlertEngine.js';
import { OperatorGate, AuditTrail } from '../observability/OpsAudit.js';
import { assessApplicationHealth } from '../observability/ApplicationHealthService.js';
import { TraceProviderOtelBridge } from '../observability/TraceProviderOtelBridge.js';
import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type { LoopApplicationService } from '@vedmoulya/loop-engine';
import type { ExperienceApplicationService } from '@vedmoulya/experience';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import type { AIOrchestrationService } from '@vedmoulya/services';

// ── Fakes (the control plane is unit-tested; engine behavior has its own E2E) ─

function createFakeFactory(): FactoryApplicationService {
  const fake = {
    list: async (userId: string) => [
      {
        applicationId: 'app-ok',
        owner: userId,
        name: 'Healthy App',
        archetype: 'generic-web',
        status: 'READY',
        health: 'healthy',
        lastBuildAt: '2026-08-10T00:00:00.000Z',
        lastValidation: {
          applicationId: 'app-ok',
          gates: [
            { gate: 'lint', passed: true, findings: [], score: 1 },
            { gate: 'typecheck', passed: true, findings: [], score: 1 },
          ],
          overall: 'PASS',
          automaticFixesApplied: 0,
          createdAt: '2026-08-10T00:00:00.000Z',
        },
        securityReport: {
          applicationId: 'app-ok',
          findings: [],
          blocked: false,
          summary: { critical: 0, high: 0, medium: 1, low: 2 },
        },
        uiQuality: { applicationId: 'app-ok', score: 0.9, checks: [], verdict: 'PASS' },
        economics: {
          applicationId: 'app-ok',
          aiCalls: 10,
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
          estimatedCostUsd: 0.02,
          cacheHits: 4,
          iterations: 3,
          retries: 0,
          providerUsage: {},
          generationTimeMs: 1200,
          estimatedBefore: { estimatedTokens: 0, estimatedCostUsd: 0 },
        },
        fileCount: 8,
        vcOperationCount: 2,
        repairLimitReached: false,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
      {
        applicationId: 'app-blocked',
        owner: userId,
        name: 'Blocked App',
        archetype: 'generic-web',
        status: 'BUILDING',
        health: 'unknown',
        securityReport: {
          applicationId: 'app-blocked',
          findings: [],
          blocked: true,
          summary: { critical: 1, high: 2, medium: 0, low: 0 },
        },
        fileCount: 0,
        vcOperationCount: 0,
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ],
    resume: async (applicationId: string) => ({ applicationId, status: 'DRAFT' }),
    build: async (input: { applicationId: string }) => ({
      applicationId: input.applicationId,
      status: 'READY',
      validation: {
        applicationId: input.applicationId,
        gates: [],
        overall: 'PASS',
        automaticFixesApplied: 0,
        createdAt: '2026-08-10T00:00:00.000Z',
      },
    }),
    getDetail: async (applicationId: string) => ({
      applicationId,
      archetype: 'generic-web',
      files: [{ path: 'src/App.tsx', kind: 'source', content: 'export const App = () => null;' }],
      status: 'READY',
      owner: 'u',
      name: 'App',
      version: '1.0.0',
      technologies: [],
      aiCapabilities: [],
      deploymentStatus: 'not_deployed',
      health: 'healthy',
      fileCount: 1,
      vcOperationCount: 0,
      createdAt: '',
      updatedAt: '',
    }),
  };
  return fake as unknown as FactoryApplicationService;
}

function createFakeLoop(): LoopApplicationService {
  const fake = {
    cancel: (runId: string) => ({ runId, cancelled: true, status: 'cancelled' }),
  };
  return fake as unknown as LoopApplicationService;
}

function createFakeExperience(): ExperienceApplicationService {
  const fake = {
    evaluate: () => ({
      applicationId: 'app-x',
      quality: { verdict: 'READY', overall: 92 },
      critic: { findings: [], score: 1, blocking: false },
    }),
  };
  return fake as unknown as ExperienceApplicationService;
}

function createFakeProviders(): ProviderApplicationService {
  const fake = {
    transitionLifecycle: async (id: string, to: string) => ({
      success: true,
      data: { id, lifecycleStatus: to },
    }),
  };
  return fake as unknown as ProviderApplicationService;
}

function createFakeAi(): AIOrchestrationService {
  const fake = {
    getAllProviderHealth: async () => [
      { providerId: 'mock', healthy: true, latencyMs: 12, errorRate: 0 },
    ],
  };
  return fake as unknown as AIOrchestrationService;
}

function createOps(options: { operators?: string[]; alertEngine?: AlertEngine } = {}): {
  ops: OpsApplicationService;
  provider: ExecutionTraceProvider;
  store: InMemoryTraceStore;
  audit: AuditTrail;
} {
  const store = new InMemoryTraceStore();
  const provider = new ExecutionTraceProvider({ store });
  const audit = new AuditTrail();
  const ops = new OpsApplicationService({
    traceProvider: provider,
    telemetry: provider,
    factory: createFakeFactory(),
    loop: createFakeLoop(),
    ai: createFakeAi(),
    experience: createFakeExperience(),
    providers: createFakeProviders(),
    costLedger: new CostLedger(),
    alertEngine: options.alertEngine ?? new AlertEngine(),
    operatorGate: new OperatorGate(options.operators ?? []),
    auditTrail: audit,
  });
  return { ops, provider, store, audit };
}

describe('OpsApplicationService — owner scoping (IDOR)', () => {
  let ctx: ReturnType<typeof createOps>;
  beforeEach(() => {
    ctx = createOps();
  });

  it('lists only the caller-owned traces for regular users', async () => {
    const { ops, provider } = ctx;
    await provider.withSpan(
      { name: 'factory.build', userId: 'alice', applicationId: 'app-a' },
      async () => {},
    );
    await provider.withSpan({ name: 'requirements.start', userId: 'bob' }, async () => {});

    const alice = ops.listTraces({ userId: 'alice' });
    const bob = ops.listTraces({ userId: 'bob' });
    expect(alice).toHaveLength(1);
    expect(alice[0]?.name).toBe('factory.build');
    expect(bob).toHaveLength(1);
    expect(bob[0]?.name).toBe('requirements.start');
  });

  it('refuses cross-user trace reads (IDOR)', async () => {
    const { ops, provider } = ctx;
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async () => {});
    const traceId = provider.listTraces({ userId: 'alice' })[0]?.traceId ?? '';
    expect(() => ops.getTrace({ userId: 'bob', traceId })).toThrow(NotFoundError);
    // Owner can read it.
    expect(ops.getTrace({ userId: 'alice', traceId }).trace).toBeDefined();
  });

  it('listFailures includes every non-OK outcome, not just FAILED', async () => {
    const { ops, provider } = ctx;
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async () => {});
    const timeout = provider.startSpan({ name: 'loop.run', userId: 'alice' });
    timeout.end('TIMEOUT');
    const security = provider.startSpan({ name: 'factory.deploy', userId: 'alice' });
    security.end('SECURITY_BLOCK');

    const failures = ops.listFailures({ userId: 'alice' });
    const statuses = failures.map((f) => f.status).sort();
    expect(statuses).toEqual(['SECURITY_BLOCK', 'TIMEOUT']);
    // The healthy trace never appears.
    expect(failures.some((f) => f.name === 'factory.build')).toBe(false);
  });

  it('operators may list and read every trace', async () => {
    const opCtx = createOps({ operators: ['op-1'] });
    await opCtx.provider.withSpan({ name: 'a', userId: 'alice' }, async () => {});
    await opCtx.provider.withSpan({ name: 'b', userId: 'bob' }, async () => {});
    const traces = opCtx.ops.listTraces({ userId: 'op-1' });
    expect(traces).toHaveLength(2);
    const traceId = traces[0]?.traceId ?? '';
    expect(opCtx.ops.getTrace({ userId: 'op-1', traceId }).trace).toBeDefined();
  });
});

describe('OpsApplicationService — cost ledger + anomalies', () => {
  it('aggregates engine economics into one ledger', async () => {
    const { ops, provider } = ctx();
    await provider.withSpan(
      {
        name: 'factory.build',
        userId: 'alice',
        applicationId: 'app-a',
        executionId: 'exec-1',
      },
      async (root) => {
        root.setAttribute('tokens_total', 5000);
        root.setAttribute('cost_usd', 0.05);
        root.setAttribute('ai_calls', 6);
        root.setAttribute('cache_hits', 2);
        const ai = provider.startSpan({
          name: 'ai.provider_execution',
          kind: 'ai',
          attributes: { provider: 'mock', attempt: 0 },
        });
        ai.end('OK');
        root.addEvent('loop.step', { provider: 'mock', tokens_total: 5000, cost_usd: 0.05 });
        root.end('OK');
      },
    );

    const ledger = ops.costLedger({ userId: 'alice' });
    expect(ledger.totals.tokensTotal).toBe(10000); // engine span + loop.step event
    expect(ledger.totals.costUsd).toBe(0.1);
    expect(ledger.totals.aiCalls).toBe(1);
    expect(ledger.totals.cacheHits).toBe(2);
    expect(ledger.byProvider[0]?.provider).toBe('mock');
    expect(ledger.byProvider[0]?.tokensTotal).toBe(5000);
    expect(ledger.byProvider[0]?.costUsd).toBe(0.05);
    expect(ledger.byApplication[0]?.applicationId).toBe('app-a');
    expect(ledger.executions[0]?.executionId).toBe('exec-1');
  });

  it('detects cost spikes and repeated calls', async () => {
    const { ops, provider } = ctx();
    const now = Date.now();
    // Median execution ~$0.01; one spike at $0.10 (>3×).
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.setAttribute('cost_usd', 0.01);
      s.end('OK');
    });
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.setAttribute('cost_usd', 0.1);
      s.end('OK');
    });
    // 6 repeated identical AI calls within the window.
    await provider.withSpan({ name: 'loop.run', userId: 'alice' }, async (root) => {
      for (let i = 0; i < 6; i++) {
        const ai = provider.startSpan({
          name: 'ai.provider_execution',
          kind: 'ai',
          attributes: { provider: 'mock', attempt: i },
        });
        ai.end('OK');
      }
      root.end('OK');
    });

    const anomalies = ops.costAnomalies({ userId: 'alice' });
    const kinds = anomalies.map((a) => a.kind);
    expect(kinds).toContain('COST_SPIKE');
    expect(kinds).toContain('REPEATED_CALLS');
    void now;
  });

  it('owner-scopes the ledger', async () => {
    const { ops, provider } = ctx();
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.setAttribute('cost_usd', 0.05);
      s.end('OK');
    });
    expect(ops.costLedger({ userId: 'bob' }).totals.costUsd).toBe(0);
    expect(ops.costLedger({ userId: 'alice' }).totals.costUsd).toBe(0.05);
  });
});

describe('OpsApplicationService — incident diagnostics', () => {
  it('builds a structured diagnosis from failed spans', async () => {
    const { ops, provider } = ctx();
    await provider.withSpan(
      { name: 'factory.build', userId: 'alice', applicationId: 'app-a', executionId: 'exec-9' },
      async (root) => {
        const ai = provider.startSpan({
          name: 'ai.provider_execution',
          kind: 'ai',
          attributes: { provider: 'openai', attempt: 0 },
        });
        ai.end('TIMEOUT', { code: 'PROVIDER_TIMEOUT', message: 'provider timed out after 60s' });
        const retry = provider.startSpan({
          name: 'ai.retry',
          kind: 'ai',
          attributes: { provider: 'openai', attempt: 1, reason: 'TIMEOUT' },
        });
        retry.end('OK');
        const fallback = provider.startSpan({
          name: 'ai.fallback',
          kind: 'ai',
          attributes: { from: 'openai', remaining: 1 },
        });
        fallback.end('OK');
        root.end('FAILED');
      },
    );
    const traceId = provider.listTraces({ userId: 'alice' })[0]?.traceId ?? '';
    const diag = ops.getDiagnostics({ userId: 'alice', traceId });
    expect(diag.traceStatus).toBe('FAILED');
    expect(diag.whatFailed[0]?.name).toBe('ai.provider_execution');
    expect(diag.whatFailed[0]?.errorCode).toBe('PROVIDER_TIMEOUT');
    expect(diag.why).toContain('PROVIDER_TIMEOUT: provider timed out after 60s');
    expect(diag.providersUsed).toContain('openai');
    expect(diag.retries).toBe(1);
    expect(diag.fallbacks).toBe(1);
    expect(diag.userNextSteps.length).toBeGreaterThan(0);
    expect(diag.operatorActions.length).toBeGreaterThan(0);
    // Cross-user read is refused.
    expect(() => ops.getDiagnostics({ userId: 'bob', traceId })).toThrow(NotFoundError);
  });
});

describe('OpsApplicationService — application health', () => {
  it('maps persisted DTO evidence onto the health verdict model', async () => {
    const { ops } = ctx();
    const health = await ops.applicationHealth({ userId: 'alice' });
    const byId = new Map(health.map((h) => [h.applicationId, h]));
    expect(byId.get('app-ok')?.verdict).toBe('HEALTHY');
    expect(byId.get('app-ok')?.reasons.length).toBeGreaterThan(0);
    expect(byId.get('app-blocked')?.verdict).toBe('BLOCKED');
    expect(byId.get('app-blocked')?.security?.blocked).toBe(true);
  });
});

describe('OpsApplicationService — alerts + operator gate', () => {
  it('requires the operator gate for platform alert evaluation', () => {
    const { ops } = ctx();
    expect(() => ops.evaluateAlerts({ userId: 'alice' })).toThrow(/Operator privileges/);
  });

  it('configured thresholds round-trip for operators', () => {
    const { ops } = ctx();
    const gate = new OperatorGate(['op-1']);
    const audited = new AuditTrail();
    const opOps = new OpsApplicationService({
      traceProvider: new ExecutionTraceProvider({ store: new InMemoryTraceStore() }),
      factory: createFakeFactory(),
      loop: createFakeLoop(),
      ai: createFakeAi(),
      experience: createFakeExperience(),
      providers: createFakeProviders(),
      operatorGate: gate,
      auditTrail: audited,
    });
    const result = opOps.configureAlertThresholds({ userId: 'op-1', providerErrorRate: 0.25 });
    expect(result.thresholds.providerErrorRate).toBe(0.25);
  });

  it('scopes the alert list to the caller for non-operators', async () => {
    const { ops, provider } = ctx();
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async () => {});
    // Unscoped platform alerts are operator-only; a user-scoped alert is visible.
    const seeded = new AlertEngine();
    seeded.evaluate({
      aiRequestsTotal: 50,
      aiRequestsFailure: 30,
      securityIncidents: 1,
    });
    const opCtx = createOps({ operators: ['op-1'], alertEngine: seeded });
    // Non-operators see an empty scoped list (no alert carries their userId).
    expect(ops.alerts({ userId: 'alice' })).toEqual([]);
    // Operators see the platform alerts.
    expect(opCtx.ops.alerts({ userId: 'op-1' }).length).toBeGreaterThan(0);
  });
});

describe('OpsApplicationService — control actions', () => {
  it('retries an application (owner) and records the audit trail', async () => {
    const { ops, audit } = ctx();
    const result = await ops.retry({ userId: 'alice', kind: 'application', id: 'app-a' });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('app-a');
    const log = audit.list();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('retry');
    expect(log[0]?.actor).toBe('alice');
    expect(log[0]?.ok).toBe(true);
  });

  it('rejects unsupported retry targets honestly', async () => {
    const { ops } = ctx();
    const loop = await ops.retry({ userId: 'alice', kind: 'loop', id: 'run-1' });
    expect(loop.ok).toBe(false);
    expect(loop.reason).toContain('clarification');
    const rag = await ops.retry({ userId: 'alice', kind: 'rag', id: 'x' });
    expect(rag.ok).toBe(false);
  });

  it('cancels active loop executions and audits', async () => {
    const { ops, audit } = ctx();
    const result = await ops.cancel({ userId: 'alice', kind: 'loop', id: 'run-1' });
    expect(result.ok).toBe(true);
    expect(audit.list()[0]?.action).toBe('cancel');
    const bad = await ops.cancel({ userId: 'alice', kind: 'application', id: 'app-a' });
    expect(bad.ok).toBe(false);
  });

  it('revalidates and re-runs quality for an application', async () => {
    const { ops, audit } = ctx();
    const reval = await ops.revalidate({ userId: 'alice', id: 'app-a' });
    expect(reval.ok).toBe(true);
    expect(reval.detail).toContain('READY');
    const quality = await ops.requality({ userId: 'alice', id: 'app-a' });
    expect(quality.ok).toBe(true);
    expect(quality.detail).toContain('READY');
    // Audit list is newest-first.
    expect(audit.list().map((a) => a.action)).toEqual(['requality', 'revalidate']);
  });

  it('provider controls are operator-only and audited', async () => {
    const { ops, audit } = ctx();
    await expect(ops.disableProvider({ userId: 'alice', providerId: 'mock' })).rejects.toThrow(
      /Operator privileges/,
    );
    const opCtx = createOps({ operators: ['op-1'] });
    const result = await opCtx.ops.disableProvider({ userId: 'op-1', providerId: 'mock' });
    expect(result.ok).toBe(true);
    expect(opCtx.audit.list()[0]?.action).toBe('disable');
  });

  it('control actions emit correlated control-plane spans', async () => {
    const { ops, provider } = ctx();
    await ops.retry({ userId: 'alice', kind: 'application', id: 'app-a' });
    const traces = provider.listTraces({ userId: 'alice' });
    expect(traces.some((t) => t.name === 'ops.retry')).toBe(true);
  });
});

describe('TraceProviderOtelBridge — redaction', () => {
  it('redacts secrets from AI span attributes', () => {
    const provider = new ExecutionTraceProvider({ store: new InMemoryTraceStore() });
    const bridge = new TraceProviderOtelBridge(provider);
    const span = bridge.startSpan('ai.run', {
      provider: 'openai',
      api_key: 'sk-test-secret-abcdef1234567890',
      tokens: 10,
    });
    span.end('ok');
    const trace = provider.listTraces()[0];
    const aiSpan = trace?.spans.find((s) => s.name === 'ai.run');
    expect(aiSpan?.attributes.api_key).toBe('[REDACTED]');
    expect(aiSpan?.attributes.provider).toBe('openai');
    expect(aiSpan?.attributes.tokens).toBe(10);
  });
});

describe('assessApplicationHealth — rule-first verdicts', () => {
  it('FAILED wins over everything', () => {
    const health = assessApplicationHealth({
      applicationId: 'a',
      name: 'A',
      archetype: 'generic-web',
      status: 'FAILED',
      error: 'boom',
      terminationReason: 'PROVIDER_FAILURE',
      lastBuildAt: '2026-08-10T00:00:00.000Z',
      lastValidation: {
        applicationId: 'a',
        gates: [],
        overall: 'PASS',
        automaticFixesApplied: 0,
        createdAt: '',
      },
    });
    expect(health.verdict).toBe('FAILED');
    expect(health.reasons.join(' ')).toContain('boom');
  });

  it('BLOCKED when critical security findings exist even with a PASS validation', () => {
    const health = assessApplicationHealth({
      applicationId: 'a',
      name: 'A',
      archetype: 'generic-web',
      status: 'READY',
      lastValidation: {
        applicationId: 'a',
        gates: [],
        overall: 'PASS',
        automaticFixesApplied: 0,
        createdAt: '',
      },
      securityReport: {
        applicationId: 'a',
        findings: [],
        blocked: true,
        summary: { critical: 1, high: 0, medium: 0, low: 0 },
      },
    });
    expect(health.verdict).toBe('BLOCKED');
  });

  it('DEGRADED on validation failure, HEALTHY on clean evidence, UNKNOWN before build', () => {
    const degraded = assessApplicationHealth({
      applicationId: 'a',
      name: 'A',
      archetype: 'generic-web',
      status: 'VALIDATING',
      lastValidation: {
        applicationId: 'a',
        gates: [
          { gate: 'lint', passed: true, findings: [], score: 1 },
          { gate: 'typecheck', passed: false, findings: ['x'], score: 0.4 },
        ],
        overall: 'PARTIAL',
        automaticFixesApplied: 1,
        createdAt: '',
      },
    });
    expect(degraded.verdict).toBe('DEGRADED');

    const healthy = assessApplicationHealth({
      applicationId: 'b',
      name: 'B',
      archetype: 'generic-web',
      status: 'READY',
      lastBuildAt: '2026-08-10T00:00:00.000Z',
      lastValidation: {
        applicationId: 'b',
        gates: [{ gate: 'lint', passed: true, findings: [], score: 1 }],
        overall: 'PASS',
        automaticFixesApplied: 0,
        createdAt: '',
      },
    });
    expect(healthy.verdict).toBe('HEALTHY');

    const unknown = assessApplicationHealth({
      applicationId: 'c',
      name: 'C',
      archetype: 'generic-web',
      status: 'DRAFT',
    });
    expect(unknown.verdict).toBe('UNKNOWN');
  });
});

// Helper used above (module-level ctx for cost/health describes).
function ctx(): ReturnType<typeof createOps> {
  return createOps();
}
