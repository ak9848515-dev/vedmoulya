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

/**
 * The honest readiness view model. `ready` is true only when at least one
 * REGISTERED adapter in this user's runtime can serve `capability` today.
 */
export interface AIReadiness {
  ready: boolean;
  capability: string;
  /** Ids of the registered adapters that could serve the capability. */
  providers: string[];
  /** Honest reason when not ready (never contains secrets). */
  reason?: string;
}

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
  /**
   * HONEST READINESS — can VedMoulya execute an AI request for THIS user right
   * now? Derived from the SAME user-scoped runtime `stream`/`orchestrate` use
   * (registered adapters + capability), never from a descriptor's theoretical
   * capability and never by making a provider call.
   */
  readiness: (
    input: { userId: string; capability?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<AIReadiness>>;
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
      requiredCapabilities?: string[];
      estimatedInputTokens?: number;
      requestedOutputTokens?: number;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse<ProviderSelectionDTO>>;
}

/**
 * Resolve the AI runtime for one authenticated user. The gateway supplies a
 * per-user orchestrator (platform providers + the owner's own credential-
 * backed adapters) through the SAME user-scoped composition Mission uses;
 * absent it, every call keeps using the deployment-wide runtime verbatim.
 */
export type AIUserOrchestratorResolver = (userId: string) => Promise<AIOrchestrationService>;

/**
 * Run one AI request inside an owner-scoped trace. The gateway supplies the
 * trace spine; absent it, execution is unchanged (no trace boundary).
 */
export type AIOwnerTraceRunner = <T>(userId: string, fn: () => Promise<T>) => Promise<T>;

export function createAIRouter(
  ai: AIOrchestrationService,
  resolveUserOrchestrator?: AIUserOrchestratorResolver,
  withOwnerTrace?: AIOwnerTraceRunner,
): AIHandlers {
  const svc = ai;
  // Execution routes through the OWNER's runtime when one is resolvable, so a
  // provider the user connected genuinely serves their request. Read-only
  // procedures keep the deployment orchestrator (identical behavior).
  const runtimeFor = async (userId: string): Promise<AIOrchestrationService> =>
    resolveUserOrchestrator !== undefined ? await resolveUserOrchestrator(userId) : svc;
  // The authenticated user owns the trace of every execution, so the AI
  // runtime's spans (provider/tokens/cost) are attributed to them and the
  // per-user CostLedger sees the real usage.
  const runOwned = <T>(userId: string, fn: () => Promise<T>): Promise<T> =>
    withOwnerTrace !== undefined ? withOwnerTrace(userId, fn) : fn();
  return {
    orchestrate: async (input, _ctx): Promise<ApiResponse<OrchestrateResponseDTO>> =>
      runOwned(input.userId, async () => {
        const runtime = await runtimeFor(input.userId);
        return successResponse(
          await runtime.orchestrate(input as unknown as Parameters<typeof svc.orchestrate>[0]),
        );
      }),
    listProviders: (_input, _ctx) => Promise.resolve(successResponse(svc.listProviders())),
    listCapabilities: (_input, _ctx) => Promise.resolve(successResponse(svc.listCapabilities())),
    getProviderHealth: async (input, _ctx) =>
      successResponse(await svc.getProviderHealth(input.providerId)),
    getAllProviderHealth: async (_input, _ctx) => successResponse(await svc.getAllProviderHealth()),
    readiness: async (input, _ctx): Promise<ApiResponse<AIReadiness>> => {
      // The OWNER's runtime — the identical resolution the execution path uses.
      const runtime = await runtimeFor(input.userId);
      const capability = (input.capability ?? 'reasoning') as Parameters<
        typeof svc.orchestrate
      >[0]['capability'];
      const availability = runtime.canServe(capability);
      return successResponse({
        ready: availability.ok,
        capability,
        providers: availability.providers,
        ...(availability.reason !== undefined ? { reason: availability.reason } : {}),
      });
    },
    stream: async (input, _ctx): Promise<ApiResponse<StreamRunDTO>> =>
      runOwned(input.userId, async () => {
        const runtime = await runtimeFor(input.userId);
        return successResponse(
          await runtime.stream(input as unknown as Parameters<typeof svc.stream>[0]),
        );
      }),
    explainSelection: async (input, _ctx) =>
      successResponse(
        await svc.explainSelection({
          capability: input.capability as Parameters<typeof svc.explainSelection>[0]['capability'],
          requiredCapabilities: input.requiredCapabilities as
            Parameters<typeof svc.explainSelection>[0]['requiredCapabilities'] | undefined,
          estimatedInputTokens: input.estimatedInputTokens,
          requestedOutputTokens: input.requestedOutputTokens,
        }),
      ),
  };
}
