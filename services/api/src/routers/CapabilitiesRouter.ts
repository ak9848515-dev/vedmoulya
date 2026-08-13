// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Capabilities Router
// Enterprise Capability Registry & Marketplace procedures (EPIC-004 / EI-001)
// ─────────────────────────────────────────────────────────────────────────────

import type { CapabilityApplicationService } from '@vedmoulya/capabilities';
import type { TRPCContext } from '../router.js';
import { fromServiceResult, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface CapabilitiesHandlers {
  // Marketplace
  getMarketplace: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  search: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Registry
  getCapability: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  createCapability: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateCapability: (
    input: { userId: string; id: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteCapability: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Discovery
  listByBusinessModule: (
    input: { userId: string; module: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getDependencies: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getTransitiveDependencies: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getCompositionTree: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Graph
  getGraph: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Lifecycle & Versioning
  transitionStatus: (
    input: { userId: string; id: string; to: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createVersion: (
    input: { userId: string; id: string; type: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createCapabilitiesRouter(
  capabilitiesService: CapabilityApplicationService,
): CapabilitiesHandlers {
  const svc = capabilitiesService;
  return {
    // ── Marketplace ────────────────────────────────────────────────────────
    getMarketplace: async (_input, _ctx) => fromServiceResult(await svc.getMarketplace()),
    search: async (input, _ctx) =>
      fromServiceResult(
        await svc.searchCapabilities(
          input as unknown as Parameters<typeof svc.searchCapabilities>[0],
        ),
      ),

    // ── Registry ──────────────────────────────────────────────────────────
    getCapability: async (input, _ctx) => fromServiceResult(await svc.getCapability(input.id)),
    createCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.createCapability(input as unknown as Parameters<typeof svc.createCapability>[0]),
      ),
    updateCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateCapability(
          input.id,
          input as unknown as Parameters<typeof svc.updateCapability>[1],
        ),
      ),
    deleteCapability: async (input, _ctx) =>
      fromServiceResult(await svc.deleteCapability(input.id)),

    // ── Discovery ─────────────────────────────────────────────────────────
    listByBusinessModule: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByBusinessModule(
          input.module as Parameters<typeof svc.listByBusinessModule>[0],
        ),
      ),
    getDependencies: async (input, _ctx) => fromServiceResult(await svc.getDependencies(input.id)),
    getTransitiveDependencies: async (input, _ctx) =>
      fromServiceResult(await svc.getTransitiveDependencies(input.id)),
    getCompositionTree: async (input, _ctx) =>
      fromServiceResult(await svc.getCompositionTree(input.id)),

    // ── Graph ─────────────────────────────────────────────────────────────
    getGraph: async (_input, _ctx) => fromServiceResult(await svc.getGraph()),

    // ── Lifecycle & Versioning ────────────────────────────────────────────
    transitionStatus: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionStatus(
          input.id,
          input.to as Parameters<typeof svc.transitionStatus>[1],
        ),
      ),
    createVersion: async (input, _ctx) =>
      fromServiceResult(
        await svc.createVersion(input.id, input.type as Parameters<typeof svc.createVersion>[1]),
      ),
  };
}
