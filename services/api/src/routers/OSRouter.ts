// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise Operating System Router
// Enterprise Operating System Integration procedures (EPIC-005 / OS-001)
// ─────────────────────────────────────────────────────────────────────────────

import type { OSApplicationService } from '@vedmoulya/os-intelligence';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry); the
// application service re-validates business rules. The OS namespace is
// platform-wide (not user-scoped) — it observes the whole operating system.

export interface OSHandlers {
  // System health (full OS pass: engines + dependencies + pipeline +
  // cross-engine + diagnostics + performance + overall score)
  systemHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Pipeline validation (the 15-stage event flow)
  pipelineHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Diagnostics battery
  runDiagnostics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Platform validation (the certification gate)
  validatePlatform: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Engine status only
  engineStatus: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Dependency graph (package gate + consultation matrix)
  dependencyGraph: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Performance metrics
  performanceMetrics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // OS dashboard (health + snapshot history)
  dashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Snapshot history
  snapshots: (input: { userId: string; limit?: number }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createOSRouter(os: OSApplicationService): OSHandlers {
  const svc = os;
  return {
    systemHealth: async (_input, _ctx) => fromServiceResult(await svc.systemHealth()),
    pipelineHealth: async (_input, _ctx) => fromServiceResult(await svc.pipelineHealth()),
    runDiagnostics: async (_input, _ctx) => fromServiceResult(await svc.runDiagnostics()),
    validatePlatform: async (_input, _ctx) => fromServiceResult(await svc.validatePlatform()),
    engineStatus: async (_input, _ctx) => fromServiceResult(await svc.engineStatus()),
    dependencyGraph: (_input, _ctx) => Promise.resolve(fromServiceResult(svc.dependencyGraph())),
    performanceMetrics: async (_input, _ctx) => fromServiceResult(await svc.performanceMetrics()),
    dashboard: async (_input, _ctx) => fromServiceResult(await svc.dashboard()),
    snapshots: async (input, _ctx) => fromServiceResult(await svc.listSnapshots(input.limit)),
  };
}
