// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Providers Router
// Enterprise Provider Registry & Intelligence Platform procedures
// (EPIC-004 / EI-002)
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderApplicationService } from '@vedmoulya/providers';
import { readProviderRuntimeState, toRuntimeMode, validateDefaultProvider } from '@vedmoulya/core';
import type { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import type { TRPCContext } from '../router.js';
import {
  fromServiceResult,
  successResponse,
  type ApiResponse,
} from '../services/ResponseMapper.js';

// Inputs are validated at the tRPC boundary with zod (RouterRegistry) using
// JSON-safe shapes; the application service re-validates business rules.

export interface ProvidersHandlers {
  // Marketplace
  getMarketplace: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  search: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Benchmark Datasets (definitions only — EI-002)
  getBenchmarkDatasets: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Model Registry
  getModelRegistry: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // Registry
  getProvider: (input: { userId: string; id: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  registerProvider: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  updateProvider: (
    input: { userId: string; id: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  deleteProvider: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Lifecycle & Versioning
  transitionLifecycle: (
    input: { userId: string; id: string; to: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  createVersion: (
    input: { userId: string; id: string; type: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Health
  recordHealthSample: (
    input: { userId: string; id: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getFleetHealth: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getAvailabilityTier: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Capability matrix
  getCapabilityMatrix: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  setCapabilityMatrix: (
    input: { userId: string; id: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getProvidersForCapability: (
    input: { userId: string; capability: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Discovery
  listByFamily: (
    input: { userId: string; family: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  listByCapability: (
    input: { userId: string; capability: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Provider Intelligence (EPIC-012A — Phases 7–11)
  getIntelligenceProfile: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // Provider Intelligence (EPIC-012B — refresh, staleness, cache)
  getIntelligenceStatus: (
    input: { userId: string; id: string; maxAgeMs?: number },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  refreshIntelligence: (
    input: { userId: string; id: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  classifyModelResource: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  assessHardwareFit: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  discoverLocalModels: (
    input: { userId: string; runtime: string; endpoint?: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // EPIC-012A — Provider Experience (Phases 4–6 / 12–17)
  getExperience: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  getPreferences: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  setPreferences: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  setProviderEnabled: (
    input: { userId: string; providerId: string; enabled: boolean },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  getUsageDetail: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  explainModelSelection: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // EPIC-019 — runtime truth: the SAME registry the config/validator/registration use.
  // Reports per-family state (CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME /
  // MOCK / DISABLED / ERROR) with key NAMES only — never secret values.
  getRuntimeStatus: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
}

export function createProvidersRouter(
  providersService: ProviderApplicationService,
  experienceService?: ProviderExperienceService,
): ProvidersHandlers {
  const svc = providersService;
  const exp = experienceService;
  // The experience handlers are only reachable through the RouterRegistry
  // wiring (which always provides the service); the guard keeps the optional
  // constructor argument honest without non-null assertions.
  const experience = (): ProviderExperienceService => {
    if (!exp) throw new Error('Provider experience service is not configured');
    return exp;
  };

  // EPIC-019 — the runtime registry (packages/core/src/startup/provider-runtime.ts)
  // is the single source of truth. This handler reads it directly so the UI can
  // never claim a catalog-only family is executable. userId is validated by the
  // standardProcedure auth middleware like every other procedure; the payload is
  // user-independent by design (runtime state, not per-user data).
  const runtimeStatus = (): ApiResponse => {
    const mode = toRuntimeMode(process.env.NODE_ENV ?? 'development');
    const states = readProviderRuntimeState(process.env, mode);
    const defaultCheck = validateDefaultProvider(process.env, mode);
    return successResponse({
      mode,
      defaultProvider: (process.env.AI_DEFAULT_PROVIDER ?? 'openai').trim(),
      defaultProviderSupported: defaultCheck.ok,
      // envKeys are KEY NAMES only — never values.
      providers: states.map((s) => ({
        family: s.family,
        name: s.name,
        status: s.status,
        reason: s.reason,
        adapterImplemented: s.adapterImplemented,
        registered: s.registered,
        canExecute: s.canExecute,
        freeTier: s.freeTier,
        defaultEligible: s.defaultEligible,
        envKeys: s.envKeys,
      })),
    });
  };
  return {
    // ── EPIC-019 runtime truth ────────────────────────────────────────────
    getRuntimeStatus: (_input, _ctx) => Promise.resolve(runtimeStatus()),
    // ── Marketplace ────────────────────────────────────────────────────────
    getMarketplace: async (_input, _ctx) => fromServiceResult(await svc.getMarketplace()),
    search: async (input, _ctx) =>
      fromServiceResult(
        await svc.searchProviders(input as unknown as Parameters<typeof svc.searchProviders>[0]),
      ),

    // ── Benchmark Datasets (definitions only — EI-002) ────────────────────
    getBenchmarkDatasets: async (input, _ctx) =>
      fromServiceResult(
        await svc.getBenchmarkDatasets(
          input as unknown as Parameters<typeof svc.getBenchmarkDatasets>[0],
        ),
      ),

    // ── Model Registry (every model across the fleet) ─────────────────────
    getModelRegistry: async (_input, _ctx) => fromServiceResult(await svc.getModelRegistry()),

    // ── Registry ──────────────────────────────────────────────────────────
    getProvider: async (input, _ctx) => fromServiceResult(await svc.getProvider(input.id)),
    registerProvider: async (input, _ctx) =>
      fromServiceResult(
        await svc.registerProvider(input as unknown as Parameters<typeof svc.registerProvider>[0]),
      ),
    updateProvider: async (input, _ctx) =>
      fromServiceResult(
        await svc.updateProvider(
          input.id,
          input as unknown as Parameters<typeof svc.updateProvider>[1],
        ),
      ),
    deleteProvider: async (input, _ctx) => fromServiceResult(await svc.deleteProvider(input.id)),

    // ── Lifecycle & Versioning ────────────────────────────────────────────
    transitionLifecycle: async (input, _ctx) =>
      fromServiceResult(
        await svc.transitionLifecycle(
          input.id,
          input.to as Parameters<typeof svc.transitionLifecycle>[1],
        ),
      ),
    createVersion: async (input, _ctx) =>
      fromServiceResult(
        await svc.createVersion(input.id, input.type as Parameters<typeof svc.createVersion>[1]),
      ),

    // ── Health ────────────────────────────────────────────────────────────
    recordHealthSample: async (input, _ctx) =>
      fromServiceResult(
        await svc.recordHealthSample(
          input.id,
          input as unknown as Parameters<typeof svc.recordHealthSample>[1],
        ),
      ),
    getFleetHealth: async (_input, _ctx) => fromServiceResult(await svc.getFleetHealth()),
    getAvailabilityTier: async (input, _ctx) =>
      fromServiceResult(await svc.getAvailabilityTier(input.id)),

    // ── Capability matrix ─────────────────────────────────────────────────
    getCapabilityMatrix: async (_input, _ctx) => fromServiceResult(await svc.getCapabilityMatrix()),
    setCapabilityMatrix: async (input, _ctx) =>
      fromServiceResult(
        await svc.setCapabilityMatrix(
          input.id,
          input.matrix as Parameters<typeof svc.setCapabilityMatrix>[1],
        ),
      ),
    getProvidersForCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.getProvidersForCapability(
          input.capability as Parameters<typeof svc.getProvidersForCapability>[0],
        ),
      ),

    // ── Discovery ─────────────────────────────────────────────────────────
    listByFamily: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByFamily(input.family as Parameters<typeof svc.listByFamily>[0]),
      ),
    listByCapability: async (input, _ctx) =>
      fromServiceResult(
        await svc.listByCapability(input.capability as Parameters<typeof svc.listByCapability>[0]),
      ),

    // ── Provider Intelligence (EPIC-012A — Phases 7–11) ───────────────────
    getIntelligenceProfile: async (input, _ctx) =>
      fromServiceResult(await svc.getIntelligenceProfile(input.id)),
    getIntelligenceStatus: async (input, _ctx) =>
      fromServiceResult(await svc.getIntelligenceStatus(input.id, input.maxAgeMs)),
    refreshIntelligence: async (input, _ctx) =>
      fromServiceResult(await svc.refreshProviderIntelligence(input.id)),
    classifyModelResource: (input, _ctx) =>
      Promise.resolve(
        fromServiceResult(
          svc.classifyModelResource(
            input as unknown as Parameters<typeof svc.classifyModelResource>[0],
          ),
        ),
      ),
    assessHardwareFit: (input, _ctx) =>
      Promise.resolve(
        fromServiceResult(
          svc.assessHardwareFit(
            (input as { hardware?: unknown }).hardware as Parameters<
              typeof svc.assessHardwareFit
            >[0],
            (input as { models?: unknown }).models as Parameters<typeof svc.assessHardwareFit>[1],
          ),
        ),
      ),
    discoverLocalModels: async (input, _ctx) =>
      fromServiceResult(
        await svc.discoverLocalModels(
          input.runtime as 'ollama' | 'lm-studio' | 'openai-compatible',
          input.endpoint,
        ),
      ),

    // ── EPIC-012A — Provider Experience (Phases 4–6 / 12–17) ────────────
    getExperience: async (input, _ctx) =>
      fromServiceResult(await experience().getOverview(input.userId)),
    getPreferences: async (input, _ctx) =>
      fromServiceResult(await experience().getPreferences(input.userId)),
    setPreferences: async (input, _ctx) =>
      fromServiceResult(
        await experience().setPreferences(
          input.userId,
          input as unknown as Parameters<ProviderExperienceService['setPreferences']>[1],
        ),
      ),
    setProviderEnabled: async (input, _ctx) =>
      fromServiceResult(
        await experience().setProviderEnabled(input.userId, input.providerId, input.enabled),
      ),
    getUsageDetail: async (input, _ctx) =>
      fromServiceResult(await experience().getUsageDetail(input.userId)),
    explainModelSelection: async (input, _ctx) =>
      fromServiceResult(
        await experience().explainModelSelection(
          input.userId,
          input as unknown as Parameters<ProviderExperienceService['explainModelSelection']>[1],
        ),
      ),
  };
}
