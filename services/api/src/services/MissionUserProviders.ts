// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission: user-scoped provider registration (PROVIDER-01 → Mission)
//
// WHY THIS EXISTS
//   The Mission runtime registers providers from DEPLOYMENT environment keys
//   only (registerPlatformProviders). A provider a user connected with their
//   OWN credential via the Providers screen was therefore invisible to Mission,
//   so a mission honestly reported WAITING_FOR_PROVIDER even though the
//   Providers screen showed the provider CONNECTED + ACTIVE.
//
// WHAT IT DOES
//   Turns an OWNER's stored, encrypted credential into the EXISTING runtime
//   adapter for that family — using the SAME credential service and the SAME
//   provider adapters every other AI feature uses. No second credential store,
//   no second provider registry, no adapter duplicated.
//
// SCOPING / SECURITY
//   - Only the OWNER's credential is consulted; the platform credential is
//     left to registerPlatformProviders (this registrar never overrides it).
//   - The secret is read through ProviderCredentialService.resolve (which
//     decrypts) and handed straight to the adapter constructor. It is never
//     logged, never returned, never persisted into mission state, and never
//     placed in the environment.
//   - Because each user gets their own orchestrator (see MissionRuntime
//     registerUserProviders), one user's credential can never serve another
//     user's mission.
// ─────────────────────────────────────────────────────────────────────────────

import type { AIOrchestrationService, ProviderAdapter } from '@vedmoulya/services';
import {
  DeepSeekProvider,
  GoogleGeminiProvider,
  OpenAICompatibleProvider,
  VercelAIProvider,
} from '@vedmoulya/orchestrator';
import type { ProviderCredentialService } from '@vedmoulya/providers';
// The SAME per-user initialization cache the MissionRuntime uses (dedup +
// failure eviction). Reused verbatim so the Ask path cannot drift from Mission.
import { cacheUserInitialization } from '@vedmoulya/mission-runtime';

/** OpenRouter speaks the OpenAI chat-completions contract on its own base URL. */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Families that authenticate with a user-supplied SECRET, paired with the
 * EXISTING adapter that consumes it. Kept as a plain table (not a second
 * registry): the values are the same adapter classes the platform registrar
 * constructs. Ollama and generic openai-compatible endpoints are excluded on
 * purpose — they are configured by BASE URL / custom endpoint, not by a
 * per-user credential, so they remain exactly as the platform configured them.
 */
const USER_CREDENTIAL_FAMILIES: ReadonlyArray<{
  family: string;
  build: (secret: string) => ProviderAdapter;
}> = [
  { family: 'google', build: (secret) => new GoogleGeminiProvider(secret) },
  { family: 'openai', build: (secret) => new VercelAIProvider(secret) },
  { family: 'deepseek', build: (secret) => new DeepSeekProvider(secret) },
  {
    family: 'openrouter',
    build: (secret) =>
      new OpenAICompatibleProvider(secret, OPENROUTER_BASE_URL, 'openrouter', {
        name: 'OpenRouter',
      }),
  },
];

export type UserProviderRegistrar = (
  orchestrator: AIOrchestrationService,
  userId: string,
) => Promise<void>;

/**
 * Build the `registerUserProviders` callback for MissionRuntime from the
 * deployment's credential service. Returns `undefined` when this deployment
 * cannot store user credentials (no encryption key) — in which case Mission
 * keeps its exact previous behavior and the platform credentials remain the
 * only source.
 */
export function createMissionUserProviderRegistrar(
  credentials: ProviderCredentialService | undefined,
): UserProviderRegistrar | undefined {
  if (!credentials) return undefined;
  return async (orchestrator, userId) => {
    for (const entry of USER_CREDENTIAL_FAMILIES) {
      // USER-only resolution: with no platform secret supplied the service
      // answers from the owner's stored record or reports NONE. The platform
      // credential is deliberately NOT merged here — registerPlatformProviders
      // already registered it, and this registrar must not shadow it.
      const resolved = await credentials.resolve(userId, entry.family);
      if (resolved.source !== 'USER' || resolved.secret === undefined) continue;
      orchestrator.registerProvider(entry.build(resolved.secret));
    }
  };
}

// ── Direct AI runtime (Ask VedMoulya) — per-user orchestrator resolver ──────
//
// WHY THIS EXISTS
//   ai.stream / ai.orchestrate run on the DEPLOYMENT-wide orchestrator, whose
//   adapters come from platform environment keys only. A provider a user
//   connected with their OWN credential was therefore invisible to Ask
//   VedMoulya even though Mission could already use it (registerUserProviders).
//   This resolver applies the EXACT SAME composition per authenticated user:
//   a fresh orchestrator with the platform providers plus the owner's own
//   credential-backed adapters.
//
// WHAT IT IS NOT
//   Not a second provider registry, credential store or routing system. It
//   composes the EXISTING `createOrchestrator` + the EXISTING
//   `createMissionUserProviderRegistrar` and caches with the EXISTING
//   `cacheUserInitialization`. `createUserOrchestrator` is supplied by the host
//   (ApiApplicationService) so the per-user orchestrator carries the SAME
//   advisor/intelligence/observability wiring as the deployment one.
//
// SCOPING / SECURITY
//   One cached orchestrator per user, keyed by the verified session userId
//   (the auth middleware enforces userId === session user). A decrypted secret
//   only ever lives inside its OWNER's orchestrator instance — never in the
//   deployment orchestrator, never in module/global state. Users with no stored
//   credential (or a deployment that cannot store credentials) transparently use
//   the platform orchestrator, so platform providers are never lost.

export interface UserAiOrchestratorResolverOptions {
  /** The deployment-wide orchestrator (platform providers) — the fallback. */
  platform: AIOrchestrationService;
  /**
   * Build a FRESH orchestrator identical to the platform one (same options,
   * platform providers, advisor/intelligence and observability), before the
   * owner's adapters are overlaid. Never the platform instance itself.
   */
  createUserOrchestrator: () => AIOrchestrationService;
  /**
   * The owner's credential-backed adapters — the SAME registrar Mission
   * uses (createMissionUserProviderRegistrar). Absent → platform-only, exactly
   * the previous Ask behavior (no user credentials can be stored).
   */
  registerUserProviders?: UserProviderRegistrar;
}

/**
 * Resolve the AI runtime for one user: the platform orchestrator when no
 * user-scoped registrar exists, otherwise a cached per-user orchestrator with
 * the owner's credential-backed adapters overlaid on the platform providers.
 */
export function createUserAiOrchestratorResolver(
  options: UserAiOrchestratorResolverOptions,
): (userId: string) => Promise<AIOrchestrationService> {
  const cache = new Map<string, Promise<AIOrchestrationService>>();
  return (userId: string): Promise<AIOrchestrationService> => {
    const registrar = options.registerUserProviders;
    if (registrar === undefined || userId.trim().length === 0) {
      return Promise.resolve(options.platform);
    }
    return cacheUserInitialization(cache, userId, async () => {
      const orchestrator = options.createUserOrchestrator();
      await registrar(orchestrator, userId);
      return orchestrator;
    });
  };
}
