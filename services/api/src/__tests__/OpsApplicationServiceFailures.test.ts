// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ops control plane failure-path tests (EPIC-012)
//
// The happy paths live in OpsControlPlane.test.ts. These tests cover the
// honest failure branches: control actions that fail (audited with ok:false),
// provider lifecycle transitions that are refused or throw, the operator-only
// audit log gate, and the metrics snapshot derivation (application/deployment/
// security failures + cost baseline from the trace spine).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionTraceProvider, InMemoryTraceStore, NotFoundError } from '@vedmoulya/core';
import { OpsApplicationService } from '../services/OpsApplicationService.js';
import { OperatorGate, AuditTrail } from '../observability/OpsAudit.js';
import { CostLedger } from '../observability/CostLedger.js';
import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type { LoopApplicationService } from '@vedmoulya/loop-engine';
import type { ExperienceApplicationService } from '@vedmoulya/experience';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import type { AIOrchestrationService } from '@vedmoulya/services';

function createOps(
  overrides: {
    operators?: string[];
    factory?: Partial<FactoryApplicationService>;
    providers?: Partial<ProviderApplicationService>;
    ai?: Partial<AIOrchestrationService>;
    loop?: Partial<LoopApplicationService>;
    experience?: Partial<ExperienceApplicationService>;
  } = {},
): {
  ops: OpsApplicationService;
  provider: ExecutionTraceProvider;
  audit: AuditTrail;
} {
  const provider = new ExecutionTraceProvider({ store: new InMemoryTraceStore() });
  const audit = new AuditTrail();
  const ops = new OpsApplicationService({
    traceProvider: provider,
    telemetry: provider,
    factory: {
      list: async () => [],
      resume: async () => ({ applicationId: 'a', status: 'DRAFT' }),
      build: async () => ({
        applicationId: 'a',
        status: 'READY',
        validation: {
          applicationId: 'a',
          gates: [],
          overall: 'PASS',
          automaticFixesApplied: 0,
          createdAt: '',
        },
      }),
      getDetail: async () => ({
        applicationId: 'a',
        archetype: 'generic-web',
        files: [],
        status: 'READY',
        owner: 'u',
        name: 'A',
        version: '1',
        technologies: [],
        aiCapabilities: [],
        deploymentStatus: 'not_deployed',
        health: 'healthy',
        fileCount: 0,
        vcOperationCount: 0,
        createdAt: '',
        updatedAt: '',
      }),
      ...overrides.factory,
    } as FactoryApplicationService,
    loop: {
      cancel: () => ({ cancelled: true, status: 'cancelled' }),
      ...overrides.loop,
    } as LoopApplicationService,
    ai: {
      getAllProviderHealth: async () => [
        { providerId: 'mock', healthy: true, latencyMs: 1, errorRate: 0 },
      ],
      ...overrides.ai,
    } as AIOrchestrationService,
    experience: {
      evaluate: () => ({
        applicationId: 'a',
        quality: { verdict: 'READY', overall: 90 },
        critic: { findings: [], score: 1, blocking: false },
      }),
      ...overrides.experience,
    } as ExperienceApplicationService,
    providers: {
      transitionLifecycle: async () => ({ success: true, data: {} }),
      ...overrides.providers,
    } as ProviderApplicationService,
    costLedger: new CostLedger(),
    operatorGate: new OperatorGate(overrides.operators ?? []),
    auditTrail: audit,
  });
  return { ops, provider, audit };
}

describe('OpsApplicationService — audit log gate', () => {
  it('requires the operator gate and lists records for operators', async () => {
    const { ops, provider } = createOps();
    expect(() => ops.auditLog({ userId: 'alice' })).toThrow(/Operator privileges/);

    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async () => {});
    const opCtx = createOps({ operators: ['op-1'] });
    expect(opCtx.ops.auditLog({ userId: 'op-1' })).toEqual([]); // audit list, not traces
  });
});

describe('OpsApplicationService — control-action failure paths', () => {
  it('retry records an audited failure when resume throws', async () => {
    const { ops, audit, provider } = createOps({
      factory: {
        resume: async () => {
          throw new Error('resume exploded');
        },
      },
    });
    const result = await ops.retry({ userId: 'alice', kind: 'application', id: 'app-a' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('resume exploded');
    const log = audit.list();
    expect(log[0]).toMatchObject({ action: 'retry', target: 'app-a', ok: false });
    const traces = provider.listTraces();
    expect(traces.some((t) => t.name === 'ops.retry' && t.status === 'FAILED')).toBe(true);
  });

  it('revalidate records an audited failure when build throws', async () => {
    const { ops, audit } = createOps({
      factory: {
        build: async () => {
          throw new Error('build failed');
        },
      },
    });
    const result = await ops.revalidate({ userId: 'alice', id: 'app-a' });
    expect(result.ok).toBe(false);
    expect(audit.list()[0]).toMatchObject({ action: 'revalidate', ok: false });
  });

  it('requality records an audited failure when detail/evaluate throws', async () => {
    const { ops, audit } = createOps({
      factory: {
        getDetail: async () => {
          throw new Error('detail gone');
        },
      },
      experience: {
        evaluate: () => {
          throw new Error('critic down');
        },
      },
    });
    const result = await ops.requality({ userId: 'alice', id: 'app-a' });
    expect(result.ok).toBe(false);
    expect(audit.list()[0]).toMatchObject({ action: 'requality', ok: false });
  });
});

describe('OpsApplicationService — provider lifecycle controls', () => {
  it('reports a refused transition honestly with an audited failure', async () => {
    const opCtx = createOps({
      operators: ['op-1'],
      providers: {
        transitionLifecycle: async () => ({ success: false, error: 'transition refused' }),
      },
    });
    const result = await opCtx.ops.disableProvider({ userId: 'op-1', providerId: 'p1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('transition refused');
    expect(opCtx.audit.list()[0]).toMatchObject({ action: 'disable', ok: false });
  });

  it('records an audited failure when the transition throws', async () => {
    const opCtx = createOps({
      operators: ['op-1'],
      providers: {
        transitionLifecycle: async () => {
          throw new Error('registry down');
        },
      },
    });
    const result = await opCtx.ops.enableProvider({ userId: 'op-1', providerId: 'p1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('registry down');
    expect(opCtx.audit.list()[0]).toMatchObject({ action: 'enable', ok: false });
  });

  it('surfaces provider fleet health', async () => {
    const opCtx = createOps({ operators: ['op-1'] });
    const health = await opCtx.ops.providerHealth({ userId: 'op-1' });
    expect(health).toEqual([{ providerId: 'mock', healthy: true, latencyMs: 1, errorRate: 0 }]);
  });
});

describe('OpsApplicationService — metrics snapshot derivation', () => {
  it('derives application/deployment/security failure counts and a cost baseline', async () => {
    const { ops, provider } = createOps();
    // Cost baseline: 3 executions at $0.01, $0.03, $0.10 → lower-middle median = 0.03.
    for (const cost of [0.01, 0.03, 0.1]) {
      await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
        s.setAttribute('cost_usd', cost);
        s.end('OK');
      });
    }
    // Application failure + deployment failure + security block.
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.end('FAILED');
    });
    await provider.withSpan({ name: 'factory.deploy', userId: 'alice' }, async (s) => {
      s.end('FAILED');
    });
    await provider.withSpan({ name: 'factory.deploy', userId: 'alice' }, async (s) => {
      s.end('SECURITY_BLOCK');
    });
    // A loop.step event contributes cost to its trace.
    await provider.withSpan({ name: 'loop.run', userId: 'alice' }, async (root) => {
      root.addEvent('loop.step', { cost_usd: 0.07 });
      root.end('OK');
    });

    const snapshot = ops.metricsSnapshot({ userId: 'alice' });
    // factory.deploy FAILED counts in both application failures (startsWith
    // factory.) and deployment failures (exact name match).
    expect(snapshot.applicationFailures).toBe(2);
    expect(snapshot.deploymentFailures).toBe(1);
    expect(snapshot.securityIncidents).toBe(1);
    expect(snapshot.baselineCostUsd).toBe(0.03);
    expect(snapshot.costUsd).toBe(0.1);
  });

  it('uses honest zero cost when no costs are recorded', () => {
    const { ops } = createOps();
    const snapshot = ops.metricsSnapshot({ userId: 'alice' });
    expect(snapshot.baselineCostUsd).toBe(0);
    expect(snapshot.costUsd).toBe(0);
  });

  it('evaluates alerts for operators against the current snapshot', async () => {
    const { ops, provider } = createOps({ operators: ['op-1'] });
    await provider.withSpan({ name: 'factory.deploy', userId: 'alice' }, async (s) => {
      s.end('FAILED');
    });
    const opCtx = createOps({ operators: ['op-1'] });
    await opCtx.provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.end('FAILED');
    });
    // Non-operator evaluation is refused.
    expect(() => ops.evaluateAlerts({ userId: 'alice' })).toThrow(/Operator privileges/);
    const alerts = opCtx.ops.evaluateAlerts({ userId: 'op-1' });
    expect(Array.isArray(alerts)).toBe(true);
  });
});

describe('OpsApplicationService — trace reads', () => {
  it('filters listTraces by status and throws NotFoundError for unknown trace ids', async () => {
    const { ops, provider } = createOps();
    await provider.withSpan({ name: 'factory.build', userId: 'alice' }, async (s) => {
      s.end('OK');
    });
    const filtered = ops.listTraces({ userId: 'alice', status: 'FAILED' });
    expect(filtered).toHaveLength(0);
    expect(() => ops.getTrace({ userId: 'alice', traceId: 'nope' })).toThrow(NotFoundError);
  });
});
