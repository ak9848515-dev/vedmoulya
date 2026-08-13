// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Enterprise Memory Intelligence Router
// Enterprise Memory Intelligence Platform procedures (EPIC-004 / EI-010)
// ─────────────────────────────────────────────────────────────────────────────

import type { MemoryApplicationService } from '@vedmoulya/memory-intelligence';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules and
// enforces the lifecycle / consolidation / relationship-integrity rules.

export interface MemoryIntelligenceHandlers {
  // Capture + Pipeline
  capture: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Registry
  update: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  delete: (input: { userId: string; memoryId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getItem: (input: { userId: string; memoryId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  listItems: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Retrieval + Summarize + Validate
  retrieve: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  summarize: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  validate: (
    input: { userId: string; memoryId: string; actor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Pipeline stages
  consolidate: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  compress: (input: { userId: string; target?: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  expire: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  reinforce: (
    input: { userId: string; memoryId: string; actor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Lifecycle
  transitionLifecycle: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Relate + Graph
  relate: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  detectRelationships: (
    input: { userId: string; memoryId: string; actor: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listRelationships: (
    input: { userId: string; type?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  graph: (
    input: { userId: string; memoryId: string; maxDepth?: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  shortestPath: (
    input: { userId: string; fromId: string; toId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Consumers
  listConsumers: (
    input: { userId: string; memoryId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  recordConsumerUsage: (
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

export function createMemoryIntelligenceRouter(
  memory: MemoryApplicationService,
): MemoryIntelligenceHandlers {
  const svc = memory;
  return {
    // ── Capture + Pipeline ────────────────────────────────────────────────
    capture: async (input, _ctx) =>
      fromServiceResult(await svc.capture(input as unknown as Parameters<typeof svc.capture>[0])),

    // ── Registry ──────────────────────────────────────────────────────────
    update: async (input, _ctx) =>
      fromServiceResult(await svc.update(input as unknown as Parameters<typeof svc.update>[0])),
    delete: async (input, _ctx) => fromServiceResult(await svc.delete(input.memoryId)),
    getItem: async (input, _ctx) => fromServiceResult(await svc.getItem(input.memoryId)),
    listItems: async (input, _ctx) =>
      fromServiceResult(
        await svc.listItems(input as unknown as Parameters<typeof svc.listItems>[0]),
      ),

    // ── Retrieval + Summarize + Validate ──────────────────────────────────
    retrieve: async (input, _ctx) =>
      fromServiceResult(await svc.retrieve(input as unknown as Parameters<typeof svc.retrieve>[0])),
    summarize: async (input, _ctx) =>
      fromServiceResult(
        await svc.summarize(input as unknown as Parameters<typeof svc.summarize>[0]),
      ),
    validate: async (input, _ctx) =>
      fromServiceResult(await svc.validate({ memoryId: input.memoryId, actor: input.actor })),

    // ── Pipeline stages ────────────────────────────────────────────────────
    consolidate: async (input, _ctx) =>
      fromServiceResult(
        await svc.consolidate(input as unknown as Parameters<typeof svc.consolidate>[0]),
      ),
    compress: async (input, _ctx) =>
      fromServiceResult(
        await svc.compressAll(input.target as Parameters<typeof svc.compressAll>[0]),
      ),
    expire: async (input, _ctx) =>
      fromServiceResult(await svc.expire(input as unknown as Parameters<typeof svc.expire>[0])),
    reinforce: async (input, _ctx) =>
      fromServiceResult(await svc.reinforce(input.memoryId, input.actor)),

    // ── Lifecycle ─────────────────────────────────────────────────────────
    transitionLifecycle: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionLifecycle(
          input as unknown as Parameters<typeof svc.transitionLifecycle>[0],
        ),
      ),

    // ── Relate + Graph ────────────────────────────────────────────────────
    relate: async (input, _ctx) =>
      fromServiceResult(await svc.relate(input as unknown as Parameters<typeof svc.relate>[0])),
    detectRelationships: async (input, _ctx) =>
      fromServiceResult(await svc.detectRelationships(input.memoryId, input.actor)),
    listRelationships: async (input, _ctx) =>
      fromServiceResult(
        await svc.listRelationships(input.type as Parameters<typeof svc.listRelationships>[0]),
      ),
    graph: async (input, _ctx) =>
      fromServiceResult(await svc.graph({ memoryId: input.memoryId, maxDepth: input.maxDepth })),
    shortestPath: async (input, _ctx) =>
      fromServiceResult(await svc.shortestPath({ fromId: input.fromId, toId: input.toId })),

    // ── Consumers ─────────────────────────────────────────────────────────
    listConsumers: async (input, _ctx) =>
      fromServiceResult(await svc.listConsumers(input.memoryId)),
    recordConsumerUsage: async (input, _ctx) =>
      fromServiceResult(
        await svc.recordConsumerUsage(
          input as unknown as Parameters<typeof svc.recordConsumerUsage>[0],
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
