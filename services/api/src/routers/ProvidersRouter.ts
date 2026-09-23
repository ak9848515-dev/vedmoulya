// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Providers Router
// Enterprise Provider Registry & Intelligence Platform procedures
// (EPIC-004 / EI-002)
// ─────────────────────────────────────────────────────────────────────────────

import type { ProviderApplicationService, ProviderCredentialService } from '@vedmoulya/providers';
import { resolvePlatformCredential } from '@vedmoulya/providers';
import { readProviderRuntimeState, toRuntimeMode, validateDefaultProvider } from '@vedmoulya/core';
import type { ProviderExperienceService } from '../services/ProviderExperienceService.js';
import {
  testProviderConnection,
  type TestableProviderFamily,
} from '../services/ProviderConnectionTester.js';
import type { OpenAIOrgPeriod } from '../services/ProviderUsageIngestor.js';
import {
  ProviderSetupOrchestrator,
  type ProviderStatus,
} from '../services/ProviderSetupOrchestrator.js';
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
  getOpenAIOrgUsage: (
    input: { userId: string; period: OpenAIOrgPeriod },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  explainModelSelection: (
    input: { userId: string } & Record<string, unknown>,
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // EPIC-019 — runtime truth: the SAME registry the config/validator/registration use.
  // Reports per-family state (CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME /
  // MOCK / DISABLED / ERROR) with key NAMES only — never secret values.
  getRuntimeStatus: (input: { userId: string }, _ctx: TRPCContext) => Promise<ApiResponse>;
  // FINAL-02 — family-aware connection test + real model discovery for the
  // friendly provider UX (Simple mode / first-login Gemini). The API key is
  // used for the probe only: never persisted, never logged, never echoed.
  connectProvider: (
    input: {
      userId: string;
      family: string;
      endpointUrl?: string;
      apiKey?: string;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  /**
   * PROVIDER-01 — forget the owner's stored credential for one provider
   * family (the "user credential removed" path). Idempotent: removing a
   * credential that does not exist is not an error.
   */
  disconnectProvider: (
    input: { userId: string; family: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  // SPRINT-049 — test connection for custom providers.
  testConnection: (
    input: { userId: string; endpointUrl: string; apiKey: string; protocol: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  /**
   * G9 — ONE-CLICK PROVIDER SETUP. The whole pipeline (probe → authenticate →
   * discover → choose default model → real validation → encrypted persistence →
   * enable → preferred → refresh) runs behind this single call, so the UI never
   * has to orchestrate Scan/Test/Save/Enable itself and can never report a
   * half-finished setup as "not configured".
   */
  setupProvider: (
    input: {
      userId: string;
      family: string;
      apiKey?: string;
      endpointUrl?: string;
      oauthCompleted?: boolean;
    },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  /**
   * G9 — the ONE authoritative provider status (DISCONNECTED / CONNECTING /
   * CONNECTED / ERROR) resolved from the credential service + runtime registry +
   * preferences. Every surface renders this instead of deriving its own.
   */
  getSetupStatus: (
    input: { userId: string; family: string },
    _ctx: TRPCContext,
  ) => Promise<ApiResponse>;
}

export function createProvidersRouter(
  providersService: ProviderApplicationService,
  experienceService?: ProviderExperienceService,
  credentialService?: ProviderCredentialService,
  setupOrchestrator?: ProviderSetupOrchestrator,
): ProvidersHandlers {
  const svc = providersService;
  const exp = experienceService;
  // PROVIDER-01 — server-side encrypted credential lifecycle. Undefined when
  // the deployment has no credential encryption key: user credentials are then
  // never stored and only the platform credential can answer.
  const credentials = credentialService;
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
    getOpenAIOrgUsage: async (input, _ctx) =>
      fromServiceResult(await experience().getOpenAIOrgUsage(input.period)),
    explainModelSelection: async (input, _ctx) =>
      fromServiceResult(
        await experience().explainModelSelection(
          input.userId,
          input as unknown as Parameters<ProviderExperienceService['explainModelSelection']>[1],
        ),
      ),

    // FINAL-02 — family-aware connection test + real model discovery for the
    // friendly provider UX (Simple mode / first-login Gemini connect).
    // PROVIDER-01 extends it into the full credential lifecycle:
    //   CONNECT → VERIFY → DISCOVER → SELECT → TEST → persist → READY.
    // A user-supplied key is verified against the REAL provider before it is
    // stored (encrypted at rest, owner-scoped) and is NEVER echoed back. With
    // no key in the request the credential service resolves the owner's stored
    // credential first and this deployment's own credential second — and the
    // result always says WHICH source answered, without any secret material.
    connectProvider: async (input, _ctx): Promise<ApiResponse> => {
      const family = input.family as TestableProviderFamily;
      const userSuppliedKey = input.apiKey?.trim() || undefined;

      // Resolve user → platform → none. A freshly typed key is the user's
      // intent, so it is what gets probed AND (on success) what gets stored.
      let resolved: { source: 'USER' | 'PLATFORM'; secret: string } | undefined;
      if (credentials) {
        if (userSuppliedKey) {
          resolved = { source: 'USER', secret: userSuppliedKey };
        } else {
          const outcome = await credentials.resolve(
            input.userId,
            family,
            resolvePlatformCredential(family, process.env),
          );
          if (outcome.secret !== undefined && outcome.source !== 'NONE') {
            resolved = { source: outcome.source, secret: outcome.secret };
          }
        }
      }

      const result = await testProviderConnection({
        family,
        ...(resolved ? { credential: resolved } : { apiKey: userSuppliedKey }),
        endpointUrl: input.endpointUrl || undefined,
      });

      // Persist ONLY after the provider really authenticated the credential.
      // A storage failure never turns a working connection into an error.
      if (credentials && userSuppliedKey && result.connected) {
        try {
          await credentials.store(input.userId, family, userSuppliedKey);
        } catch {
          // Verification is the truth; persistence is best-effort here.
        }
      }
      return successResponse(result);
    },

    // PROVIDER-01 — the owner forgets a stored credential. Idempotent, and
    // honest when this deployment cannot store credentials at all.
    disconnectProvider: async (input, _ctx): Promise<ApiResponse> => {
      if (!credentials) {
        return successResponse({ family: input.family, removed: false, supported: false });
      }
      await credentials.delete(input.userId, input.family);
      return successResponse({ family: input.family, removed: true, supported: true });
    },

    // ── G9 — ONE-CLICK PROVIDER SETUP (the consolidation) ──────────────────
    // Steps 1–10 of the mission's flow run behind this single handler. The
    // result is ALWAYS the typed ProviderSetupResult: a failure names the stage,
    // so the UI can never fall back to a vague "not configured".
    setupProvider: async (input, _ctx): Promise<ApiResponse> => {
      const orchestrator =
        setupOrchestrator ??
        new ProviderSetupOrchestrator(credentials !== undefined ? { credentials } : {});
      const result = await orchestrator.setup({
        userId: input.userId,
        family: input.family,
        ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
        ...(input.endpointUrl !== undefined ? { endpointUrl: input.endpointUrl } : {}),
        ...(input.oauthCompleted !== undefined ? { oauthCompleted: input.oauthCompleted } : {}),
      });
      return successResponse(result);
    },

    // ── G9 — the ONE resolved provider status ─────────────────────────────
    // Credential source, runtime truth and preferences are combined HERE, once.
    // The browser renders this and nothing else, so two screens can no longer
    // disagree about whether an AI is connected.
    getSetupStatus: async (input, _ctx): Promise<ApiResponse> => {
      const orchestrator =
        setupOrchestrator ??
        new ProviderSetupOrchestrator(credentials !== undefined ? { credentials } : {});
      const runtime = runtimeStatus();
      const rows = (runtime.data as { providers?: Array<Record<string, unknown>> }).providers ?? [];
      const row = rows.find((candidate) => candidate.family === input.family) ?? {};
      const preferences = exp ? await exp.getPreferences(input.userId) : undefined;
      const prefs = preferences?.success ? preferences.data : undefined;
      const status: ProviderStatus = await orchestrator.getStatus(input.userId, input.family, {
        ...(typeof row.status === 'string' ? { runtimeStatus: row.status } : {}),
        ...(prefs !== undefined
          ? { enabled: !prefs.disabledProviderIds.includes(input.family) }
          : {}),
        ...(prefs?.preferredModelId !== undefined
          ? { selectedModel: { id: prefs.preferredModelId, name: prefs.preferredModelId } }
          : {}),
        capabilities: Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [],
      });
      return successResponse(status);
    },

    // SPRINT-049 — test connection for custom providers.
    // Attempts a lightweight request to the endpoint to verify reachability
    // and authentication. SECURITY: API key is server-side only.
    // FINAL-02 — the `google-gemini` protocol is delegated to the family-aware
    // tester (Gemini authenticates with an x-goog-api-key header, NOT a
    // Bearer token, and exposes real model discovery via v1beta/models).
    testConnection: async (input, _ctx): Promise<ApiResponse> => {
      const { endpointUrl, apiKey, protocol } = input;
      if (protocol === 'google-gemini') {
        const result = await testProviderConnection({
          family: 'google',
          apiKey: apiKey || undefined,
        });
        return successResponse(result);
      }
      if (!endpointUrl || !apiKey) {
        return successResponse({
          connected: false,
          status: 'failed' as const,
          message: 'Endpoint URL and API key are required',
          testedAt: new Date().toISOString(),
        });
      }
      try {
        // For OpenAI-compatible protocols, test with a minimal models request.
        if (protocol === 'openai-compatible' || protocol === '') {
          const modelsUrl = endpointUrl.replace(/\/+$/, '') + '/models';
          const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (response.ok) {
            return successResponse({
              connected: true,
              status: 'connected' as const,
              message: `Connected successfully (${response.status})`,
              testedAt: new Date().toISOString(),
            });
          }
          return successResponse({
            connected: false,
            status: 'failed' as const,
            message: `Endpoint returned ${response.status}: ${response.statusText}`,
            testedAt: new Date().toISOString(),
          });
        }
        // For other protocols, test basic reachability.
        const response = await fetch(endpointUrl, {
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        return successResponse({
          connected: response.ok,
          status: response.ok ? ('connected' as const) : ('failed' as const),
          message: response.ok
            ? `Endpoint reachable (${response.status})`
            : `Endpoint returned ${response.status}`,
          testedAt: new Date().toISOString(),
        });
      } catch (error) {
        return successResponse({
          connected: false,
          status: 'failed' as const,
          message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          testedAt: new Date().toISOString(),
        });
      }
    },
  };
}
