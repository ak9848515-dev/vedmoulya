// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Context Fabric Router
// Context & Personal Intelligence Fabric procedures (APP-001)
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextFabricApplicationService } from '@vedmoulya/context-fabric';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry); the
// application service re-validates business rules. The contextFabric
// namespace is user-scoped — every procedure resolves against the
// authenticated user (auth + IDOR middleware in RouterRegistry).

export interface ContextFabricHandlers {
  // Personal intelligence graph
  getPersonalGraph: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Business / enterprise context graph
  getBusinessGraph: (
    input: { userId: string; organizationId?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Unified hybrid search (permission-gated)
  search: (
    input: {
      userId: string;
      organizationId?: string;
      query: string;
      goalId?: string;
      projectId?: string;
      taskId?: string;
      sources?: string[];
      types?: string[];
      tags?: string[];
      minConfidence?: number;
      limit?: number;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Entity lookup with permission evaluation
  getEntity: (
    input: { userId: string; entityId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Relationships around an entity
  getRelationships: (
    input: { userId: string; entityId: string; maxDepth?: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Minimum-useful context package assembly
  buildContextPackage: (
    input: {
      userId: string;
      organizationId?: string;
      goalId?: string;
      taskId?: string;
      query: string;
      tokenBudget?: number;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // "Selected because …" explanation
  explainContextSelection: (
    input: {
      userId: string;
      entityId: string;
      goalId?: string;
      projectId?: string;
      taskId?: string;
      query?: string;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Provenance facts
  getProvenance: (
    input: { userId: string; entityId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Permission evaluation
  getPermissions: (
    input: { userId: string; entityId: string; organizationId?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Source registry
  getSources: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Fabric health / diagnostics
  getHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createContextFabricRouter(
  fabric: ContextFabricApplicationService,
): ContextFabricHandlers {
  const svc = fabric;
  return {
    getPersonalGraph: async (input, _ctx) =>
      fromServiceResult(await svc.getPersonalGraph(input.userId)),
    getBusinessGraph: async (input, _ctx) =>
      fromServiceResult(await svc.getBusinessGraph(input.organizationId ?? '')),
    search: async (input, _ctx) => fromServiceResult(await svc.search(input)),
    getEntity: async (input, _ctx) =>
      fromServiceResult(await svc.getEntity(input.userId, input.entityId)),
    getRelationships: async (input, _ctx) =>
      fromServiceResult(await svc.getRelationships(input.userId, input.entityId, input.maxDepth)),
    buildContextPackage: async (input, _ctx) =>
      fromServiceResult(await svc.buildContextPackage(input)),
    explainContextSelection: async (input, _ctx) =>
      fromServiceResult(await svc.explainContextSelection(input)),
    getProvenance: async (input, _ctx) =>
      fromServiceResult(await svc.getProvenance(input.userId, input.entityId)),
    getPermissions: async (input, _ctx) =>
      fromServiceResult(
        await svc.getPermissions(input.userId, input.entityId, input.organizationId),
      ),
    getSources: async (_input, _ctx) => fromServiceResult(await svc.getSources()),
    getHealth: async (_input, _ctx) => fromServiceResult(await svc.getHealth()),
  };
}
