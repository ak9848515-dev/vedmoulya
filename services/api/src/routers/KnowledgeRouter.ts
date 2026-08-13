// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise Knowledge Intelligence Router
// Enterprise Knowledge Intelligence Platform procedures (EPIC-004 / EI-009)
// ─────────────────────────────────────────────────────────────────────────────

import type { KnowledgeApplicationService } from '@vedmoulya/knowledge-intelligence';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules and
// enforces the lifecycle / validation / relationship-integrity rules.

export interface KnowledgeHandlers {
  // Registry
  create: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  update: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  delete: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getItem: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listItems: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Search + Explain + Validate
  search: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  explain: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validate: (
    input: { userId: string; knowledgeId: string; actor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Version + Diff
  createVersion: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listVersions: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getVersion: (
    input: { userId: string; knowledgeId: string; versionNumber: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  diff: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Relate + Graph
  relate: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  detectRelationships: (
    input: { userId: string; knowledgeId: string; actor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listRelationships: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  graph: (
    input: { userId: string; knowledgeId: string; maxDepth?: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  shortestPath: (
    input: { userId: string; fromId: string; toId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Consumers + Dependencies
  listConsumers: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  recordConsumerUsage: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listDependencies: (
    input: { userId: string; knowledgeId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Lifecycle
  transitionLifecycle: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Analytics + Timeline + Dashboard
  getAnalytics: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getTimeline: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getDashboard: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createKnowledgeRouter(knowledge: KnowledgeApplicationService): KnowledgeHandlers {
  const svc = knowledge;
  return {
    // ── Registry ──────────────────────────────────────────────────────────
    create: async (input, _ctx) =>
      fromServiceResult(await svc.create(input as unknown as Parameters<typeof svc.create>[0])),
    update: async (input, _ctx) =>
      fromServiceResult(await svc.update(input as unknown as Parameters<typeof svc.update>[0])),
    delete: async (input, _ctx) => fromServiceResult(await svc.delete(input.knowledgeId)),
    getItem: async (input, _ctx) => fromServiceResult(await svc.getItem(input.knowledgeId)),
    listItems: async (input, _ctx) =>
      fromServiceResult(
        await svc.listItems(input as unknown as Parameters<typeof svc.listItems>[0]),
      ),

    // ── Search + Explain + Validate ───────────────────────────────────────
    search: async (input, _ctx) =>
      fromServiceResult(await svc.search(input as unknown as Parameters<typeof svc.search>[0])),
    explain: async (input, _ctx) => fromServiceResult(await svc.explain(input.knowledgeId)),
    validate: async (input, _ctx) =>
      fromServiceResult(await svc.validate({ knowledgeId: input.knowledgeId, actor: input.actor })),

    // ── Version + Diff ────────────────────────────────────────────────────
    createVersion: async (input, _ctx) =>
      fromServiceResult(
        await svc.createVersion(input as unknown as Parameters<typeof svc.createVersion>[0]),
      ),
    listVersions: async (input, _ctx) =>
      fromServiceResult(await svc.listVersions(input.knowledgeId)),
    getVersion: async (input, _ctx) =>
      fromServiceResult(await svc.getVersion(input.knowledgeId, input.versionNumber)),
    diff: async (input, _ctx) =>
      fromServiceResult(await svc.diff(input as unknown as Parameters<typeof svc.diff>[0])),

    // ── Relate + Graph ────────────────────────────────────────────────────
    relate: async (input, _ctx) =>
      fromServiceResult(await svc.relate(input as unknown as Parameters<typeof svc.relate>[0])),
    detectRelationships: async (input, _ctx) =>
      fromServiceResult(await svc.detectRelationships(input.knowledgeId, input.actor)),
    listRelationships: async (input, _ctx) =>
      fromServiceResult(
        await svc.listRelationships(input.type as Parameters<typeof svc.listRelationships>[0]),
      ),
    graph: async (input, _ctx) =>
      fromServiceResult(
        await svc.graph({ knowledgeId: input.knowledgeId, maxDepth: input.maxDepth }),
      ),
    shortestPath: async (input, _ctx) =>
      fromServiceResult(await svc.shortestPath({ fromId: input.fromId, toId: input.toId })),

    // ── Consumers + Dependencies ──────────────────────────────────────────
    listConsumers: async (input, _ctx) =>
      fromServiceResult(await svc.listConsumers(input.knowledgeId)),
    recordConsumerUsage: async (input, _ctx) =>
      fromServiceResult(
        await svc.recordConsumerUsage(
          input as unknown as Parameters<typeof svc.recordConsumerUsage>[0],
        ),
      ),
    listDependencies: async (input, _ctx) =>
      fromServiceResult(await svc.listDependencies(input.knowledgeId)),

    // ── Lifecycle ─────────────────────────────────────────────────────────
    transitionLifecycle: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionLifecycle(
          input as unknown as Parameters<typeof svc.transitionLifecycle>[0],
        ),
      ),

    // ── Analytics + Timeline + Dashboard ──────────────────────────────────
    getAnalytics: async (_input, _ctx) => fromServiceResult(await svc.getAnalytics()),
    getTimeline: async (input, _ctx) =>
      fromServiceResult(
        await svc.getTimeline(input as unknown as Parameters<typeof svc.getTimeline>[0]),
      ),
    getDashboard: async (_input, _ctx) => fromServiceResult(await svc.getDashboard()),
  };
}
