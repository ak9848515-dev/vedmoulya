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
