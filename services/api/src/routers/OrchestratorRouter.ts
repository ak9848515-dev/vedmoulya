// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Execution Orchestrator Router
// Enterprise Execution Orchestrator procedures (EPIC-004 / EI-005)
// ─────────────────────────────────────────────────────────────────────────────

import type { OrchestratorApplicationService } from '@vedmoulya/execution-orchestrator';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

export interface OrchestratorHandlers {
  // Graph
  buildExecutionGraph: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validateExecutionGraph: (
    input: { userId: string; graphId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  optimizeExecutionGraph: (
    input: { userId: string; graphId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getGraph: (input: { userId: string; graphId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  explainExecutionGraph: (
    input: { userId: string; graphId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Sessions
  createExecutionSession: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  pauseSession: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  resumeSession: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  cancelSession: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listSessions: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getSession: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Supporting views (monitor / recovery / queue / workers / summary)
  getMonitorSnapshot: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  planRecovery: (
    input: { userId: string; sessionId: string; failedNodeId?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getQueue: (
    input: { userId: string; sessionId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listWorkers: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getSummary: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createOrchestratorRouter(
  orchestrator: OrchestratorApplicationService,
): OrchestratorHandlers {
  const svc = orchestrator;
  return {
    // ── Graph ──────────────────────────────────────────────────────────────
    buildExecutionGraph: async (input, _ctx) =>
      fromServiceResult(
        await svc.buildExecutionGraph(
          input as unknown as Parameters<typeof svc.buildExecutionGraph>[0],
        ),
      ),
    validateExecutionGraph: async (input, _ctx) =>
      fromServiceResult(await svc.validateExecutionGraph(input.graphId)),
    optimizeExecutionGraph: async (input, _ctx) =>
      fromServiceResult(await svc.optimizeExecutionGraph(input.graphId)),
    getGraph: async (input, _ctx) => fromServiceResult(await svc.getGraph(input.graphId)),
    explainExecutionGraph: async (input, _ctx) =>
      fromServiceResult(await svc.explainExecutionGraph(input.graphId)),

    // ── Sessions ───────────────────────────────────────────────────────────
    createExecutionSession: async (input, _ctx) =>
      fromServiceResult(
        await svc.createExecutionSession(
          input as unknown as Parameters<typeof svc.createExecutionSession>[0],
        ),
      ),
    pauseSession: async (input, _ctx) => fromServiceResult(await svc.pauseSession(input.sessionId)),
    resumeSession: async (input, _ctx) =>
      fromServiceResult(await svc.resumeSession(input.sessionId)),
    cancelSession: async (input, _ctx) =>
      fromServiceResult(await svc.cancelSession(input.sessionId)),
    listSessions: async (_input, _ctx) => fromServiceResult(await svc.listSessions()),
    getSession: async (input, _ctx) => fromServiceResult(await svc.getSession(input.sessionId)),

    // ── Supporting views ───────────────────────────────────────────────────
    getMonitorSnapshot: async (input, _ctx) =>
      fromServiceResult(await svc.getMonitorSnapshot(input.sessionId)),
    planRecovery: async (input, _ctx) =>
      fromServiceResult(await svc.planRecovery(input.sessionId, input.failedNodeId)),
    getQueue: async (input, _ctx) => fromServiceResult(await svc.getQueue(input.sessionId)),
    listWorkers: async (_input, _ctx) => fromServiceResult(await svc.listWorkers()),
    getSummary: async (_input, _ctx) => fromServiceResult(await svc.getSummary()),
  };
}
