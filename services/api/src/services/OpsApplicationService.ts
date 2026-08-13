// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ops Application Service (Control Plane)
// EPIC-012 — Production Observability & Control Plane (Phases 9–13)
//
// The operational control surface:
//   INSPECT  — traces, failures, incident diagnostics, cost ledger +
//              anomalies, application health, provider health, alerts,
//              audit log
//   CONTROL  — retry (application resume), cancel (loop), revalidate
//              (factory re-build validation), requality (experience
//              re-evaluate), disable/enable provider (EI-002 lifecycle)
//
// Every read is owner-scoped for non-operators (IDOR at the store/engine
// boundary); platform-wide reads and every provider control require the
// operator gate. Every control action is audited + emits a control-plane
// span so the action itself is reconstructable.
// ─────────────────────────────────────────────────────────────────────────────

import { ExecutionTraceProvider, metrics, NOOP_TELEMETRY, NotFoundError } from '@vedmoulya/core';
import type { TelemetryPort, TraceStatus } from '@vedmoulya/core';
import { AIMetrics } from '@vedmoulya/services';
import type { AIOrchestrationService } from '@vedmoulya/services';
import type { LoopApplicationService } from '@vedmoulya/loop-engine';
import type { FactoryApplicationService } from '@vedmoulya/app-factory';
import type { ExperienceApplicationService } from '@vedmoulya/experience';
import type { ProviderApplicationService } from '@vedmoulya/providers';
import { CostLedger } from '../observability/CostLedger.js';
import type { CostAnomaly, CostLedgerSnapshot } from '../observability/CostLedger.js';
import { assessApplicationHealth } from '../observability/ApplicationHealthService.js';
import type { ApplicationHealth } from '../observability/ApplicationHealthService.js';
import { buildIncidentDiagnostics } from '../observability/IncidentDiagnostics.js';
import type { IncidentDiagnostics } from '../observability/IncidentDiagnostics.js';
import { AlertEngine } from '../observability/AlertEngine.js';
import type { Alert, AlertMetricsSnapshot } from '../observability/AlertEngine.js';
import { AuditTrail, OperatorGate } from '../observability/OpsAudit.js';
import type { AuditRecord } from '../observability/OpsAudit.js';

export interface OpsApplicationServiceOptions {
  traceProvider: ExecutionTraceProvider;
  telemetry?: TelemetryPort;
  factory: FactoryApplicationService;
  loop: LoopApplicationService;
  ai: AIOrchestrationService;
  experience: ExperienceApplicationService;
  providers: ProviderApplicationService;
  costLedger?: CostLedger;
  alertEngine?: AlertEngine;
  operatorGate?: OperatorGate;
  auditTrail?: AuditTrail;
}

export interface TraceSummary {
  traceId: string;
  name: string;
  status: TraceStatus;
  executionId?: string;
  applicationId?: string;
  userId?: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  spanCount: number;
}

export interface ControlActionResult {
  ok: boolean;
  action: string;
  target: string;
  /** Why the action could not be performed (when ok=false). */
  reason?: string;
  detail?: string;
}

/**
 * Control plane service. `userId` is always the authenticated session user;
 * every read is owner-scoped unless the caller is an operator.
 */
export class OpsApplicationService {
  private readonly traceProvider: ExecutionTraceProvider;
  private readonly telemetry: TelemetryPort;
  private readonly factory: FactoryApplicationService;
  private readonly loop: LoopApplicationService;
  private readonly ai: AIOrchestrationService;
  private readonly experience: ExperienceApplicationService;
  private readonly providers: ProviderApplicationService;
  private readonly ledger: CostLedger;
  private readonly alertEngine: AlertEngine;
  private readonly operatorGate: OperatorGate;
  private readonly auditTrail: AuditTrail;

  constructor(options: OpsApplicationServiceOptions) {
    this.traceProvider = options.traceProvider;
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.factory = options.factory;
    this.loop = options.loop;
    this.ai = options.ai;
    this.experience = options.experience;
    this.providers = options.providers;
    this.ledger = options.costLedger ?? new CostLedger();
    this.alertEngine = options.alertEngine ?? new AlertEngine();
    this.operatorGate = options.operatorGate ?? new OperatorGate();
    this.auditTrail = options.auditTrail ?? new AuditTrail();
  }

  // ── Inspect ────────────────────────────────────────────────────────────────

  listTraces(input: { userId: string; limit?: number; status?: TraceStatus }): TraceSummary[] {
    const operator = this.operatorGate.isOperator(input.userId);
    const traces = this.traceProvider.listTraces({
      userId: operator ? undefined : input.userId,
      status: input.status,
      limit: input.limit ?? 50,
    });
    return traces.map((t) => ({
      traceId: t.traceId,
      name: t.name,
      status: t.status,
      executionId: t.executionId,
      applicationId: t.applicationId,
      userId: t.userId,
      startedAt: t.startedAt,
      endedAt: t.endedAt,
      durationMs: t.endedAt !== undefined ? t.endedAt - t.startedAt : undefined,
      spanCount: t.spans.length,
    }));
  }

  getTrace(input: { userId: string; traceId: string }): { trace: unknown } {
    const trace = this.traceProvider.getTrace(input.traceId);
    if (!trace) throw new NotFoundError('ExecutionTrace', input.traceId);
    if (!this.operatorGate.isOperator(input.userId) && trace.userId !== input.userId) {
      throw new NotFoundError('ExecutionTrace', input.traceId);
    }
    return { trace };
  }

  listFailures(input: { userId: string; limit?: number }): TraceSummary[] {
    // Every non-OK outcome is a real failure: PROVIDER_FAILURE, TIMEOUT,
    // BUDGET_EXCEEDED, VALIDATION_FAILURE, SECURITY_BLOCK, ERROR, …
    return this.listTraces({ userId: input.userId, limit: input.limit }).filter(
      (t) => t.status !== 'OK',
    );
  }

  getDiagnostics(input: { userId: string; traceId: string }): IncidentDiagnostics {
    const trace = this.traceProvider.getTrace(input.traceId);
    if (!trace) throw new NotFoundError('ExecutionTrace', input.traceId);
    if (!this.operatorGate.isOperator(input.userId) && trace.userId !== input.userId) {
      throw new NotFoundError('ExecutionTrace', input.traceId);
    }
    return buildIncidentDiagnostics(trace);
  }

  costLedger(input: { userId: string }): CostLedgerSnapshot {
    const operator = this.operatorGate.isOperator(input.userId);
    return this.ledger.compute(this.traceProvider.getStore(), {
      userId: operator ? undefined : input.userId,
    });
  }

  costAnomalies(input: { userId: string }): CostAnomaly[] {
    const operator = this.operatorGate.isOperator(input.userId);
    return this.ledger.detectAnomalies(this.traceProvider.getStore(), {
      userId: operator ? undefined : input.userId,
    });
  }

  async applicationHealth(input: { userId: string }): Promise<ApplicationHealth[]> {
    // factory.list is owner-scoped at the engine; operators may also run a
    // platform sweep through the trace store when needed.
    const apps = await this.factory.list(input.userId);
    return apps.map((app) => assessApplicationHealth(app));
  }

  async providerHealth(_input: { userId: string }): Promise<unknown> {
    return this.ai.getAllProviderHealth();
  }

  alerts(input: { userId: string }): Alert[] {
    const operator = this.operatorGate.isOperator(input.userId);
    const alerts = this.alertEngine.listRecent(50);
    // Non-operators only ever see alerts explicitly scoped to their own userId —
    // unscoped platform-level alerts (deployment/security) stay operator-only.
    return operator ? alerts : alerts.filter((a) => a.scope?.userId === input.userId);
  }

  auditLog(input: { userId: string; limit?: number }): AuditRecord[] {
    this.operatorGate.requireOperator(input.userId);
    return this.auditTrail.list(input.limit ?? 100);
  }

  /** Current alert-relevant metrics snapshot (feeds evaluateAlerts + tests). */
  metricsSnapshot(input: { userId?: string } = {}): AlertMetricsSnapshot {
    const aiMetrics = AIMetrics.getInstance();
    const operator = input.userId === undefined || this.operatorGate.isOperator(input.userId);
    const traces = this.traceProvider.listTraces({
      userId: operator ? undefined : input.userId,
      limit: 1000,
    });
    const applicationFailures = traces.filter(
      (t) => t.name.startsWith('factory.') && t.status === 'FAILED',
    ).length;
    const deploymentFailures = traces.filter(
      (t) => t.name === 'factory.deploy' && t.status === 'FAILED',
    ).length;
    const securityIncidents = traces.filter((t) => t.status === 'SECURITY_BLOCK').length;

    // Cost baseline: median execution cost + the most expensive execution.
    const costs = traces
      .map((t) => this.traceCostUsd(t))
      .filter((c): c is number => c !== undefined && c > 0)
      .sort((a, b) => a - b);
    // Lower-middle median (stable for even-length samples).
    const baselineCostUsd = costs.length > 0 ? costs[Math.floor((costs.length - 1) / 2)] : 0;
    const costUsd = costs.length > 0 ? costs[costs.length - 1] : 0;

    return {
      aiRequestsTotal: aiMetrics.getTotalRequests(),
      aiRequestsFailure: metrics.getCounter('ai.requests.failure'),
      aiRateLimit429: metrics.getCounter('ai.ratelimit.hit'),
      aiAbstentions: metrics.getCounter('ai.abstention.count'),
      ragFallbackCount: metrics.getCounter('ai.fallback.count'),
      promptCacheHitRatio: aiMetrics.getPromptCacheHitRatio(),
      costUsd,
      baselineCostUsd,
      applicationFailures,
      deploymentFailures,
      securityIncidents,
    };
  }

  /** Evaluate alert rules against the current metrics snapshot. */
  evaluateAlerts(input: { userId: string }): Alert[] {
    this.operatorGate.requireOperator(input.userId);
    return this.alertEngine.evaluate(this.metricsSnapshot({ userId: input.userId }));
  }

  configureAlertThresholds(input: { userId: string } & Parameters<AlertEngine['configure']>[0]): {
    thresholds: AlertEngine['configuredThresholds'];
  } {
    this.operatorGate.requireOperator(input.userId);
    this.alertEngine.configure(input);
    return { thresholds: this.alertEngine.configuredThresholds };
  }

  // ── Control actions (owner-scoped + audited) ───────────────────────────────

  async retry(input: {
    userId: string;
    kind: 'application' | 'loop' | 'rag';
    id: string;
  }): Promise<ControlActionResult> {
    if (input.kind === 'application') {
      return this.telemetry.withSpan(
        {
          name: 'ops.retry',
          kind: 'control',
          executionId: input.id,
          userId: input.userId,
          attributes: { target: 'application' },
        },
        async (span) => {
          try {
            const result = await this.factory.resume(input.id, input.userId);
            const detail = `application ${input.id} → ${result.status ?? 'RESUMED'}`;
            span.setAttribute('status', result.status ?? 'RESUMED');
            this.auditTrail.record({
              actor: input.userId,
              action: 'retry',
              target: input.id,
              detail,
              ok: true,
            });
            return { ok: true, action: 'retry', target: input.id, detail };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.auditTrail.record({
              actor: input.userId,
              action: 'retry',
              target: input.id,
              detail: message,
              ok: false,
            });
            span.end('FAILED', { code: 'CONTROL_ACTION_FAILED', message: message.slice(0, 300) });
            return { ok: false, action: 'retry', target: input.id, reason: message };
          }
        },
      );
    }
    if (input.kind === 'loop') {
      return {
        ok: false,
        action: 'retry',
        target: input.id,
        reason: 'loop retry requires a clarification — use loop.resume with the run id',
      };
    }
    return {
      ok: false,
      action: 'retry',
      target: input.id,
      reason: `retry is not supported for kind "${input.kind}"`,
    };
  }

  async cancel(input: {
    userId: string;
    kind: 'loop' | 'application';
    id: string;
  }): Promise<ControlActionResult> {
    if (input.kind === 'loop') {
      return this.telemetry.withSpan(
        {
          name: 'ops.cancel',
          kind: 'control',
          executionId: input.id,
          userId: input.userId,
          attributes: { target: 'loop' },
        },
        (span) => {
          const result = this.loop.cancel(input.id, input.userId);
          const detail = `loop ${input.id} cancelled=${result.cancelled} status=${result.status}`;
          span.setAttribute('cancelled', result.cancelled);
          this.auditTrail.record({
            actor: input.userId,
            action: 'cancel',
            target: input.id,
            detail,
            ok: true,
          });
          return { ok: result.cancelled, action: 'cancel', target: input.id, detail };
        },
      );
    }
    return {
      ok: false,
      action: 'cancel',
      target: input.id,
      reason: 'cancel is only supported for active loop executions (kind "loop")',
    };
  }

  async revalidate(input: { userId: string; id: string }): Promise<ControlActionResult> {
    return this.telemetry.withSpan(
      {
        name: 'ops.revalidate',
        kind: 'control',
        executionId: input.id,
        userId: input.userId,
        attributes: { target: 'application' },
      },
      async (span) => {
        try {
          const result = await this.factory.build({
            applicationId: input.id,
            userId: input.userId,
            approved: true,
            generate: false,
          });
          const detail = `revalidated ${input.id} → ${result.status} (validation ${result.validation?.overall ?? 'none'})`;
          span.setAttribute('status', result.status);
          this.auditTrail.record({
            actor: input.userId,
            action: 'revalidate',
            target: input.id,
            detail,
            ok: true,
          });
          return { ok: true, action: 'revalidate', target: input.id, detail };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.auditTrail.record({
            actor: input.userId,
            action: 'revalidate',
            target: input.id,
            detail: message,
            ok: false,
          });
          span.end('FAILED', { code: 'CONTROL_ACTION_FAILED', message: message.slice(0, 300) });
          return { ok: false, action: 'revalidate', target: input.id, reason: message };
        }
      },
    );
  }

  async requality(input: { userId: string; id: string }): Promise<ControlActionResult> {
    return this.telemetry.withSpan(
      {
        name: 'ops.requality',
        kind: 'control',
        executionId: input.id,
        userId: input.userId,
        attributes: { target: 'application' },
      },
      async (span) => {
        try {
          const detail = await this.factory.getDetail(input.id, input.userId);
          const result = this.experience.evaluate({
            applicationId: input.id,
            archetype: detail.archetype,
            files: detail.files.map((f) => ({ path: f.path, content: f.content })),
            securityFindings: detail.securityReport?.findings.map((f) => ({
              severity: f.severity,
              description: f.description,
              filePath: f.filePath,
            })),
            validationEvidence: detail.lastValidation?.gates.map((g) => ({
              gate: g.gate,
              passed: g.passed,
              detail: g.findings.join('; '),
            })),
          });
          const message = `quality re-evaluated ${input.id}: verdict ${result.quality.verdict} (${result.quality.overall}/100)`;
          span.setAttribute('verdict', result.quality.verdict);
          this.auditTrail.record({
            actor: input.userId,
            action: 'requality',
            target: input.id,
            detail: message,
            ok: true,
          });
          return { ok: true, action: 'requality', target: input.id, detail: message };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.auditTrail.record({
            actor: input.userId,
            action: 'requality',
            target: input.id,
            detail: message,
            ok: false,
          });
          span.end('FAILED', { code: 'CONTROL_ACTION_FAILED', message: message.slice(0, 300) });
          return { ok: false, action: 'requality', target: input.id, reason: message };
        }
      },
    );
  }

  // ── Provider controls (operator-only, audited) ─────────────────────────────

  async disableProvider(input: {
    userId: string;
    providerId: string;
  }): Promise<ControlActionResult> {
    return this.providerLifecycleControl(input.userId, input.providerId, 'maintenance', 'disable');
  }

  async enableProvider(input: {
    userId: string;
    providerId: string;
  }): Promise<ControlActionResult> {
    return this.providerLifecycleControl(input.userId, input.providerId, 'active', 'enable');
  }

  private async providerLifecycleControl(
    userId: string,
    providerId: string,
    to: 'active' | 'maintenance',
    action: string,
  ): Promise<ControlActionResult> {
    this.operatorGate.requireOperator(userId);
    return this.telemetry.withSpan(
      {
        name: `ops.${action}Provider`,
        kind: 'control',
        userId,
        attributes: { provider: providerId, to },
      },
      async (span) => {
        try {
          const result = await this.providers.transitionLifecycle(providerId, to);
          if (!result.success) {
            const detail = result.error ?? 'transition refused';
            this.auditTrail.record({
              actor: userId,
              action,
              target: providerId,
              detail,
              ok: false,
            });
            span.end('FAILED', { code: 'CONTROL_ACTION_FAILED', message: detail.slice(0, 300) });
            return { ok: false, action, target: providerId, reason: detail };
          }
          const detail = `provider ${providerId} → ${to}`;
          this.auditTrail.record({ actor: userId, action, target: providerId, detail, ok: true });
          return { ok: true, action, target: providerId, detail };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.auditTrail.record({
            actor: userId,
            action,
            target: providerId,
            detail: message,
            ok: false,
          });
          span.end('FAILED', { code: 'CONTROL_ACTION_FAILED', message: message.slice(0, 300) });
          return { ok: false, action, target: providerId, reason: message };
        }
      },
    );
  }

  private traceCostUsd(trace: {
    spans: Array<{
      attributes: Record<string, string | number | boolean>;
      events: Array<{ name: string; attributes?: Record<string, string | number | boolean> }>;
    }>;
  }): number | undefined {
    let cost = 0;
    let found = false;
    for (const span of trace.spans) {
      const c = span.attributes.cost_usd;
      if (typeof c === 'number' && c > 0) {
        cost += c;
        found = true;
      }
      for (const event of span.events) {
        if (event.name === 'loop.step' && typeof event.attributes?.cost_usd === 'number') {
          cost += event.attributes.cost_usd;
          found = true;
        }
      }
    }
    return found ? cost : undefined;
  }
}
