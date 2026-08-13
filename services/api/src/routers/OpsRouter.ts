// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Ops Control Plane Router
// EPIC-012 — Production Observability & Control Plane (Phases 9–13)
//
// The typed ops.* contract:
//   ops.traces / trace / failures / diagnostics  — reconstruct executions
//   ops.costLedger / costAnomalies               — economics
//   ops.applicationHealth / providerHealth       — health views
//   ops.alerts / evaluateAlerts / alertThresholds — alerting
//   ops.auditLog                                 — operator audit trail
//   ops.retry / cancel / revalidate / requality  — owner-scoped controls
//   ops.disableProvider / enableProvider         — operator-only controls
//
// Every procedure is authenticated + rate-limited by the RouterRegistry
// middleware and carries the session userId (the IDOR guard compares it).
// Authorization is enforced INSIDE OpsApplicationService (operator gate /
// owner scoping), never in the UI.
// ─────────────────────────────────────────────────────────────────────────────

import type { OpsApplicationService } from '../services/OpsApplicationService.js';
import type { TraceStatus } from '@vedmoulya/core';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';
import type { CostAnomaly, CostLedgerSnapshot } from '../observability/CostLedger.js';
import type { IncidentDiagnostics } from '../observability/IncidentDiagnostics.js';
import type { ApplicationHealth } from '../observability/ApplicationHealthService.js';
import type { Alert } from '../observability/AlertEngine.js';
import type { AuditRecord } from '../observability/OpsAudit.js';
import type { TraceSummary } from '../services/OpsApplicationService.js';

/** Result of an operator control action (audited). */
export interface OpsControlResult {
  ok: boolean;
  action: string;
  target: string;
  reason?: string;
  detail?: string;
}

export interface OpsHandlers {
  traces: (
    input: { userId: string; limit?: number; status?: TraceStatus },
    _ctx: TRPCContext,
  ) => ApiResponse<TraceSummary[]>;
  trace: (
    input: { userId: string; traceId: string },
    _ctx: TRPCContext,
  ) => ApiResponse<{ trace: unknown }>;
  failures: (
    input: { userId: string; limit?: number },
    _ctx: TRPCContext,
  ) => ApiResponse<TraceSummary[]>;
  diagnostics: (
    input: { userId: string; traceId: string },
    _ctx: TRPCContext,
  ) => ApiResponse<IncidentDiagnostics>;
  costLedger: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse<CostLedgerSnapshot>;
  costAnomalies: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse<CostAnomaly[]>;
  applicationHealth: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ApplicationHealth[]>>;
  providerHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  alerts: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse<Alert[]>;
  evaluateAlerts: (input: { userId: string }, _ctx: TRPCContext) => ApiResponse<Alert[]>;
  alertThresholds: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => ApiResponse<{ thresholds: unknown }>;
  auditLog: (
    input: { userId: string; limit?: number },
    _ctx: TRPCContext,
  ) => ApiResponse<AuditRecord[]>;
  retry: (
    input: { userId: string; kind: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
  cancel: (
    input: { userId: string; kind: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
  revalidate: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
  requality: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
  disableProvider: (
    input: { userId: string; providerId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
  enableProvider: (
    input: { userId: string; providerId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OpsControlResult>>;
}

export function createOpsRouter(ops: OpsApplicationService): OpsHandlers {
  return {
    traces: (input, _ctx) => successResponse(ops.listTraces(input)),
    trace: (input, _ctx) => successResponse(ops.getTrace(input)),
    failures: (input, _ctx) => successResponse(ops.listFailures(input)),
    diagnostics: (input, _ctx) => successResponse(ops.getDiagnostics(input)),
    costLedger: (input, _ctx) => successResponse(ops.costLedger(input)),
    costAnomalies: (input, _ctx) => successResponse(ops.costAnomalies(input)),
    applicationHealth: async (input, _ctx) => successResponse(await ops.applicationHealth(input)),
    providerHealth: async (input, _ctx) => successResponse(await ops.providerHealth(input)),
    alerts: (input, _ctx) => successResponse(ops.alerts(input)),
    evaluateAlerts: (input, _ctx) => successResponse(ops.evaluateAlerts(input)),
    alertThresholds: (input, _ctx) => successResponse(ops.configureAlertThresholds(input)),
    auditLog: (input, _ctx) => successResponse(ops.auditLog(input)),
    retry: async (input, _ctx) =>
      successResponse(
        await ops.retry({
          userId: input.userId,
          kind: input.kind as 'application' | 'loop' | 'rag',
          id: input.id,
        }),
      ),
    cancel: async (input, _ctx) =>
      successResponse(
        await ops.cancel({
          userId: input.userId,
          kind: input.kind as 'loop' | 'application',
          id: input.id,
        }),
      ),
    revalidate: async (input, _ctx) => successResponse(await ops.revalidate(input)),
    requality: async (input, _ctx) => successResponse(await ops.requality(input)),
    disableProvider: async (input, _ctx) => successResponse(await ops.disableProvider(input)),
    enableProvider: async (input, _ctx) => successResponse(await ops.enableProvider(input)),
  };
}
