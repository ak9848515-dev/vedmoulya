// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI Runtime Router
// Canonical AI execution procedures (ARC-005 / AI-RUNTIME-001)
// Every procedure routes through the shared AIOrchestrationService (Provider
// Manager + capability routing + retry/fallback + metrics). Business engines
// never import provider SDKs — they call this runtime contract.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AIOrchestrationService,
  OrchestrateResponseDTO,
  ProviderListDTO,
  CapabilityListDTO,
  ProviderHealthDTO,
  ProviderSelectionDTO,
  StreamRunDTO,
} from '@vedmoulya/services';
import type { TRPCContext } from '../router.js';
import { successResponse, type ApiResponse } from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry); the
// AI domain service re-validates capability/quality-tier business rules.

export interface AIHandlers {
  /** Execute one AI task through the runtime (capability → provider → model). */
  orchestrate: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<OrchestrateResponseDTO>>;
  /** Registered provider adapters on the runtime. */
  listProviders: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ProviderListDTO>>;
  /** Capabilities with their registered provider counts. */
  listCapabilities: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<CapabilityListDTO>>;
  /** Live health for one registered provider. */
  getProviderHealth: (
    input: { userId: string; providerId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ProviderHealthDTO>>;
  /** Live health for every registered provider. */
  getAllProviderHealth: (
    input: { userId: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ProviderHealthDTO[]>>;
  /** Streamed run (AI-RUNTIME-002): server-side SDK streaming as typed events. */
  stream: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<StreamRunDTO>>;
  /** Pure decision query: WHY the runtime would pick a provider/model. */
  explainSelection: (
    input: {
      userId: string;
      capability: string;
      estimatedInputTokens?: number;
      requestedOutputTokens?: number;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ProviderSelectionDTO>>;
}

export function createAIRouter(ai: AIOrchestrationService): AIHandlers {
  const svc = ai;
  return {
    orchestrate: async (input, _ctx) =>
      successResponse(
        await svc.orchestrate(input as unknown as Parameters<typeof svc.orchestrate>[0]),
      ),
    listProviders: (_input, _ctx) => Promise.resolve(successResponse(svc.listProviders())),
    listCapabilities: (_input, _ctx) => Promise.resolve(successResponse(svc.listCapabilities())),
    getProviderHealth: async (input, _ctx) =>
      successResponse(await svc.getProviderHealth(input.providerId)),
    getAllProviderHealth: async (_input, _ctx) => successResponse(await svc.getAllProviderHealth()),
    stream: async (input, _ctx) =>
      successResponse(await svc.stream(input as unknown as Parameters<typeof svc.stream>[0])),
    explainSelection: async (input, _ctx) =>
      successResponse(
        await svc.explainSelection({
          capability: input.capability as Parameters<typeof svc.explainSelection>[0]['capability'],
          estimatedInputTokens: input.estimatedInputTokens,
          requestedOutputTokens: input.requestedOutputTokens,
        }),
      ),
  };
}
