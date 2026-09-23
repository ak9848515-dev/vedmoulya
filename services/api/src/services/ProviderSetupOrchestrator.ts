// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Setup Orchestrator (G9)
// ONE server-side orchestration for "ADD AI → choose provider → CONNECT → done".
//
// WHY THIS EXISTS
// Provider setup used to be a pipeline the USER had to drive across several
// screens: Scan → pick model → Test Connection → Save → Enable → set preferred.
// Each step was a separate gateway call made by a component, and each provider
// family had its own screen. Every one of those steps can fail, and a failure
// in the middle left the UI guessing — the reported symptom being Google
// consent → "Not configured", with no indication WHERE it broke.
//
// This service owns the whole pipeline once, so:
//   • the UI makes ONE call and renders ONE result,
//   • the final state is only CONNECTED when the runtime can really use the
//     credential (validation happened), never because a step merely returned ok,
//   • a failure reports the EXACT stage that failed plus a recovery action,
//   • provider-specific behaviour stays in provider METADATA (the shared preset
//     table + the family-aware connection tester), never in the UI.
//
// REUSE (nothing here re-implements provider infrastructure):
//   • ProviderConnectionTester — reachability, auth probe + real model discovery
//   • validateProviderGeneration — a tiny real generation on the chosen model
//   • ProviderCredentialService — ENCRYPTED owner-scoped credential persistence
//   • ProviderExperienceService — enable flags + preferred provider/model
//   • @vedmoulya/shared presets — credential type, endpoints, default model
//
// NOT TOUCHED: provider security/encryption, the provider runtime registry, the
// orchestrator runtime, missions, watchdog, recovery, governance and autonomy.
// ─────────────────────────────────────────────────────────────────────────────

import { ProviderCredentialService, ProviderPreferencesService } from '@vedmoulya/providers';
import type { ProviderCredentialSource } from '@vedmoulya/providers';
import { choosePreferredModel, providerPreset } from '@vedmoulya/shared';
import {
  testProviderConnection,
  validateProviderGeneration,
  type DiscoveredProviderModel,
  type ProviderConnectionErrorKind,
  type TestableProviderFamily,
} from './ProviderConnectionTester.js';

// ── The typed result contract ───────────────────────────────────────────────

/**
 * Every way a setup can end. `SUCCESS` is the ONLY outcome that may be rendered
 * as connected; each failure names the stage that failed so the UI never has to
 * guess (and never shows a vague "not configured" after a real failure).
 */
export type ProviderSetupOutcome =
  /** Credential persisted, provider enabled, model chosen AND validated. */
  | 'SUCCESS'
  /** The provider needs the user to authorize/supply a credential. */
  | 'AUTH_REQUIRED'
  /** Something outside VedMoulya must happen first (start a local server). */
  | 'ACTION_REQUIRED'
  /** The credential/connection was rejected by the provider. */
  | 'VALIDATION_FAILED'
  /** Connected, but the provider reported no usable models. */
  | 'MODEL_DISCOVERY_FAILED'
  /** The credential was valid but could not be stored (deployment key). */
  | 'PERSISTENCE_FAILED'
  /** The provider could not be reached at all. */
  | 'UNAVAILABLE';

/** Which pipeline stage a result describes (for precise diagnostics). */
export type ProviderSetupStage =
  | 'discover'
  | 'authenticate'
  | 'validate'
  | 'discover_models'
  | 'choose_default_model'
  | 'persist_credential'
  | 'enable_provider'
  | 'set_preferred'
  | 'refresh_state';

/** What the user can do about a failure (never a developer instruction). */
export type ProviderSetupRecovery =
  | { kind: 'start_local_provider'; actionLabel: string; detail: string }
  | { kind: 'check_credential'; actionLabel: string }
  | { kind: 'retry'; actionLabel: string }
  | { kind: 'go_advanced'; actionLabel: string };

/** Everything the UI needs to render a success or a precise recovery. */
export interface ProviderSetupResult {
  outcome: ProviderSetupOutcome;
  /** Never true unless the runtime can really use this provider. */
  connected: boolean;
  providerId: string;
  /** The stage this result came from (SUCCESS ⇒ 'refresh_state'). */
  stage: ProviderSetupStage;
  /** Which credential authenticated the setup — never the secret itself. */
  credentialSource: ProviderCredentialSource;
  /** The model actually selected (and validated on SUCCESS). */
  selectedModel: { id: string; name: string } | null;
  /** Every model the provider really reported. */
  availableModels: DiscoveredProviderModel[];
  /** True when the provider offered a choice of models. */
  hasModelChoice: boolean;
  /** How the default model was chosen (provider default vs capability rank). */
  modelSelectionSource: 'provider_default' | 'capability_rank' | 'first_available' | 'none';
  /** Measured latency of the validation generation, when it ran. */
  validationLatencyMs?: number;
  /**
   * ONE actionable message in plain language — never a raw error, never an env
   * var name, never credential material.
   */
  message: string;
  /** Classified failure kind (for the existing friendly-error vocabulary). */
  errorKind?: ProviderConnectionErrorKind;
  /**
   * What the user can do about it. `go_advanced` is offered only for genuinely
   * technical dead ends — never in the happy path.
   */
  recovery?: ProviderSetupRecovery;
  /**
   * Set when the provider itself is verified but VedMoulya could not persist a
   * preference (enable / default). Names the stage so the UI can say exactly
   * which part needs a retry instead of showing "not configured".
   */
  preferenceStage?: 'enable_provider' | 'set_preferred';
  /** True when an encrypted credential is now stored for this owner + family. */
  credentialStored: boolean;
  /** True when the owner's enabled/preferred state was written. */
  preferencesApplied: boolean;
  completedAt: string;
}

/** The orchestrator's inputs — one call replaces the whole manual pipeline. */
export interface ProviderSetupRequest {
  userId: string;
  /** Provider family id (google / openai / anthropic / deepseek / ollama / …). */
  family: string;
  /**
   * A credential the user just supplied (API-key flow). It is used for the
   * probe and then ENCRYPTED at rest by ProviderCredentialService — it is never
   * logged and never returned.
   */
  apiKey?: string;
  /** Local endpoint override (Ollama). Omitted ⇒ the provider's default. */
  endpointUrl?: string;
  /**
   * GOOGLE ONLY — the OAuth callback completed and the server already holds a
   * verified Google account token for this user. It means the AUTHENTICATE
   * stage succeeded without a pasted key; the pipeline still has to persist,
   * validate and enable before anything may be called connected.
   */
  oauthCompleted?: boolean;
  /** Test doubles only. */
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

/** Injectable collaborators (all optional ⇒ production wiring by default). */
export interface ProviderSetupOrchestratorOptions {
  credentials?: ProviderCredentialService;
  /** Enable + preferred provider/model persistence (the existing service). */
  preferences?: Pick<ProviderPreferencesService, 'setProviderEnabled' | 'updatePreferences'>;
  /** Test double for the discover/validate probes. */
  probe?: typeof testProviderConnection;
  generate?: typeof validateProviderGeneration;
}

// ── Families + plain-language names ─────────────────────────────────────────

/** Families the setup pipeline understands (mirrors the gateway enum). */
export const SETUP_FAMILIES: readonly TestableProviderFamily[] = [
  'google',
  'openai',
  'anthropic',
  'deepseek',
  'ollama',
  'openai-compatible',
] as const;

export function isSetupFamily(family: string): family is TestableProviderFamily {
  return (SETUP_FAMILIES as readonly string[]).includes(family);
}

// ── SINGLE SOURCE OF TRUTH: the resolved provider status ────────────────────
// The UI must never derive "connected" from unrelated facts (runtime env, the
// registry, a preference row, a localStorage marker). This is the ONE resolved
// status: it is computed server-side from the credential service + the real
// runtime report + the user's preferences, and every surface renders it.

/**
 * The four states a provider can be in. Deliberately small: anything a user can
 * act on collapses into one of these, and no other vocabulary is allowed to
 * reach the screen.
 */
export type ProviderConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

/** Everything a surface needs to render one provider, honestly. */
export interface ProviderStatus {
  providerId: string;
  connectionState: ProviderConnectionState;
  /** Which credential can authenticate this family for this user. */
  credentialSource: ProviderCredentialSource;
  /** The model that will actually be used. */
  selectedModel: { id: string; name: string } | null;
  /** Models the provider is known to serve (from the last real discovery). */
  availableModels: DiscoveredProviderModel[];
  /** Plain-language capability phrases (never raw capability ids). */
  capabilities: string[];
  /** When the last real verification ran (ISO), when known. */
  lastValidatedAt?: string;
  /** The ONE actionable problem, when connectionState is ERROR. */
  actionableError?: { message: string; recovery?: ProviderSetupRecovery };
  /** Safe to show as "Connected" only when this is true. */
  runtimeConfigured: boolean;
}

/** User-facing provider names — plain words, never internal ids. */
const SETUP_PROVIDER_NAMES: ReadonlyMap<string, string> = new Map([
  ['google', 'Gemini'],
  ['openai', 'OpenAI'],
  ['anthropic', 'Claude'],
  ['deepseek', 'DeepSeek'],
  ['ollama', 'Ollama'],
  ['openai-compatible', 'this AI'],
]);

function providerName(family: string): string {
  return SETUP_PROVIDER_NAMES.get(family) ?? providerPreset(family).displayName;
}

/**
 * Which family a pasted credential belongs to. Kept a PLAIN MAP (not a second
 * registry): the values are the same family ids the gateway already validates.
 */
const KEYED_FAMILIES: ReadonlySet<string> = new Set([
  'openai',
  'anthropic',
  'deepseek',
  'google',
  'openai-compatible',
]);

// ── Result builders (one place, so no surface can invent its own outcome) ───

interface ResultSeed {
  request: ProviderSetupRequest;
  stage: ProviderSetupStage;
  credentialSource: ProviderCredentialSource;
  credentialStored: boolean;
  preferencesApplied: boolean;
  availableModels: DiscoveredProviderModel[];
  credentialRequired: boolean;
  selectedModel: { id: string; name: string } | null;
  modelSelectionSource: 'provider_default' | 'capability_rank' | 'first_available' | 'none';
}

function emptySeed(request: ProviderSetupRequest): ResultSeed {
  return {
    request,
    stage: 'discover',
    credentialSource: 'NONE',
    credentialStored: false,
    preferencesApplied: false,
    availableModels: [],
    credentialRequired: false,
    selectedModel: null,
    modelSelectionSource: 'none',
  };
}

function baseResult(
  seed: ResultSeed,
  outcome: ProviderSetupOutcome,
  message: string,
  extra: Partial<ProviderSetupResult> = {},
): ProviderSetupResult {
  return {
    outcome,
    connected: false,
    providerId: seed.request.family,
    stage: seed.stage,
    credentialSource: seed.credentialSource,
    selectedModel: seed.selectedModel,
    availableModels: seed.availableModels,
    hasModelChoice: seed.availableModels.length > 1,
    modelSelectionSource: seed.modelSelectionSource,
    message,
    credentialStored: seed.credentialStored,
    preferencesApplied: seed.preferencesApplied,
    completedAt: new Date().toISOString(),
    ...extra,
  };
}

// ── Honest failure mapping (stage + kind ⇒ outcome, message, recovery) ──────

/** Credential-shaped failures: the user must replace what they supplied. */
const CREDENTIAL_KINDS: ReadonlySet<string> = new Set([
  'invalid_api_key',
  'unauthorized',
  'not_found',
  'bad_request',
  'no_credential',
]);

interface FailureMapping {
  outcome: ProviderSetupOutcome;
  message: string;
  recovery?: ProviderSetupRecovery;
}

/**
 * Turn a classified probe/generation failure into what actually happened and
 * what to do next. Provider-specific recovery exists for exactly one case — a
 * local runtime that is not running — and even there the instruction is one
 * sentence, with the technical detail only reachable through Advanced.
 */
function mapFailure(
  family: string,
  errorKind: ProviderConnectionErrorKind | undefined,
  message: string,
  stage: ProviderSetupStage,
): FailureMapping {
  const name = providerName(family);

  if (errorKind === 'browser_origin_blocked') {
    return {
      outcome: 'ACTION_REQUIRED',
      message: `VedMoulya can see ${name}, but browser access is blocked.`,
      recovery: {
        kind: 'start_local_provider',
        actionLabel: 'Restart it once',
        detail: `Close ${name} completely, start it again, then press Connect.`,
      },
    };
  }

  if (errorKind === 'unreachable') {
    if (family === 'ollama') {
      return {
        outcome: 'ACTION_REQUIRED',
        message: "Ollama isn't running on this computer.",
        recovery: {
          kind: 'start_local_provider',
          actionLabel: 'Start Ollama',
          detail: 'Install it from ollama.com, open it, then press Connect again.',
        },
      };
    }
    return {
      outcome: 'UNAVAILABLE',
      message: `${name} could not be reached just now.`,
      recovery: { kind: 'retry', actionLabel: 'Try again' },
    };
  }

  if (errorKind === 'rate_limited' || errorKind === 'unavailable') {
    return {
      outcome: 'UNAVAILABLE',
      message: `${name} is temporarily unavailable.`,
      recovery: { kind: 'retry', actionLabel: 'Try again' },
    };
  }

  if (errorKind === 'no_credential') {
    return {
      outcome: 'AUTH_REQUIRED',
      message: `${name} needs a key before VedMoulya can use it.`,
      recovery: { kind: 'check_credential', actionLabel: 'Add key' },
    };
  }

  if (errorKind !== undefined && CREDENTIAL_KINDS.has(errorKind)) {
    return {
      outcome: 'VALIDATION_FAILED',
      message:
        stage === 'validate'
          ? `${name} connected but did not answer — the key or model was rejected.`
          : `${name} did not accept this key.`,
      recovery: { kind: 'check_credential', actionLabel: 'Check key' },
    };
  }

  // Unknown kinds keep the provider's own friendly message (already scrubbed).
  return {
    outcome: stage === 'validate' ? 'VALIDATION_FAILED' : 'UNAVAILABLE',
    message,
    recovery: { kind: 'retry', actionLabel: 'Try again' },
  };
}

/**
 * A local runtime refusal that is really a browser-origin policy problem is the
 * ONE technical dead end where Advanced is genuinely useful — every other
 * failure has a plain recovery.
 */
function advancedRecoveryFor(
  kind: ProviderConnectionErrorKind | undefined,
): ProviderSetupRecovery | undefined {
  return kind === 'browser_origin_blocked'
    ? { kind: 'go_advanced', actionLabel: 'Advanced setup' }
    : undefined;
}

// ── The orchestrator ────────────────────────────────────────────────────────

/** Outcome of the enable/preference writes (kept explicit, never inferred). */
interface PreferenceWriteOutcome {
  applied: boolean;
  failure?: { stage: 'enable_provider' | 'set_preferred'; message: string };
}

/**
 * ONE setup pipeline for every provider. The caller supplies a provider id and
 * (when the provider needs one) a credential; everything else — probing,
 * authentication, model discovery, default-model choice, real validation,
 * encrypted persistence, enabling and preferences — happens here, in order, and
 * is reported as a single typed `ProviderSetupResult`.
 */
export class ProviderSetupOrchestrator {
  private readonly credentials: ProviderCredentialService | undefined;
  private readonly preferences:
    Pick<ProviderPreferencesService, 'setProviderEnabled' | 'updatePreferences'> | undefined;
  private readonly probe: typeof testProviderConnection;
  private readonly generate: typeof validateProviderGeneration;

  constructor(options: ProviderSetupOrchestratorOptions = {}) {
    this.credentials = options.credentials;
    this.preferences = options.preferences;
    this.probe = options.probe ?? testProviderConnection;
    this.generate = options.generate ?? validateProviderGeneration;
  }

  // ── Stage 2 · authenticate (which credential will be used?) ────────────
  private async resolveCredential(
    request: ProviderSetupRequest,
    pastedKey: string | undefined,
  ): Promise<{ source: Exclude<ProviderCredentialSource, 'NONE'>; secret: string } | undefined> {
    if (pastedKey !== undefined) return { source: 'USER', secret: pastedKey };
    if (!this.credentials) return undefined;
    const resolved = await this.credentials.resolve(request.userId, request.family);
    if (resolved.source === 'NONE' || resolved.secret === undefined) return undefined;
    return { source: resolved.source, secret: resolved.secret };
  }

  // ── Stage 6 · persist the credential (encrypted, owner-scoped) ─────────
  private async persistCredential(
    request: ProviderSetupRequest,
    pastedKey: string | undefined,
  ): Promise<boolean> {
    if (pastedKey === undefined || !this.credentials) return false;
    await this.credentials.store(request.userId, request.family, pastedKey);
    return true;
  }

  // ── Stage 8/9 · enable + preferred provider/model (existing service) ───
  // The preferences service reports business failures in its RESULT (it does not
  // throw), so a rejected write must be read from `success` — otherwise a
  // failed enable would be reported as a completed setup.
  private async applyPreferences(
    request: ProviderSetupRequest,
    modelId: string,
  ): Promise<PreferenceWriteOutcome> {
    if (!this.preferences) return { applied: false };
    const name = providerName(request.family);
    try {
      const enabled = await this.preferences.setProviderEnabled(
        request.userId,
        request.family,
        true,
      );
      if (!enabled.success) {
        return {
          applied: false,
          failure: {
            stage: 'enable_provider',
            message: `${name} was verified, but VedMoulya could not turn it on. Try again.`,
          },
        };
      }
      const preferred = await this.preferences.updatePreferences(request.userId, {
        preferredProviderId: request.family,
        preferredModelId: modelId,
      });
      if (!preferred.success) {
        return {
          applied: false,
          failure: {
            stage: 'set_preferred',
            message: `${name} is verified, but VedMoulya could not save it as your default. Try again.`,
          },
        };
      }
    } catch {
      return {
        applied: false,
        failure: {
          stage: 'enable_provider',
          message: `${name} was verified, but VedMoulya could not save your choice. Try again.`,
        },
      };
    }
    return { applied: true };
  }

  /** Can the runtime resolve a usable credential for this family right now? */
  private async runtimeResolvable(
    request: ProviderSetupRequest,
    credentialStored: boolean,
    probeSource: ProviderCredentialSource,
    credentialRequired: boolean,
  ): Promise<boolean> {
    if (credentialStored) return true;
    if (probeSource === 'PLATFORM') return true;
    if (!credentialRequired) return true;
    if (!this.credentials) return false;
    return this.credentials.hasCredential(request.userId, request.family);
  }

  /**
   * Resolve the ONE authoritative status for a provider.
   *
   * HONESTY RULES (the reason this exists):
   *   • CONNECTED requires a credential the runtime can actually resolve AND the
   *     runtime registry reporting the family as executable — a stored key alone
   *     is NOT a connection (the "no fake connected" rule),
   *   • a known failure becomes ERROR with ONE actionable message; it is never
   *     flattened back into DISCONNECTED ("not configured"),
   *   • nothing is derived from localStorage, a device marker or a UI flag.
   */
  async getStatus(
    userId: string,
    family: string,
    options: {
      /** Runtime registry truth for this family (CONFIGURED / … ). */
      runtimeStatus?: string;
      /** Whether the operator switched the provider off. */
      enabled?: boolean;
      /** The model the runtime would use. */
      selectedModel?: { id: string; name: string } | null;
      /** Models from the last real discovery, when available. */
      availableModels?: DiscoveredProviderModel[];
      /** Capability phrases from the provider view model. */
      capabilities?: string[];
      /** The last real verification for this provider, when one is known. */
      lastVerification?: {
        ok: boolean;
        failureKind?: ProviderConnectionErrorKind;
        at?: string;
        message?: string;
      };
      /** True while a setup for this provider is running right now. */
      connecting?: boolean;
    } = {},
  ): Promise<ProviderStatus> {
    const credentialSource =
      this.credentials !== undefined
        ? await this.credentials
            .resolve(userId, family)
            .then((resolved) => resolved.source)
            .catch(() => 'NONE' as const)
        : 'NONE';

    const base: Omit<ProviderStatus, 'connectionState'> = {
      providerId: family,
      credentialSource,
      selectedModel: options.selectedModel ?? null,
      availableModels: options.availableModels ?? [],
      capabilities: options.capabilities ?? [],
      runtimeConfigured: options.runtimeStatus === 'CONFIGURED' || options.runtimeStatus === 'MOCK',
      ...(options.lastVerification?.at !== undefined
        ? { lastValidatedAt: options.lastVerification.at }
        : {}),
    };

    // A setup in flight is its own state — never "disconnected" mid-connect.
    if (options.connecting === true) return { ...base, connectionState: 'CONNECTING' };

    // A real failure outranks everything: it is actionable and must be shown.
    if (options.lastVerification && !options.lastVerification.ok) {
      const mapped = mapFailure(
        family,
        options.lastVerification.failureKind,
        options.lastVerification.message ?? '',
        'validate',
      );
      return {
        ...base,
        connectionState: 'ERROR',
        actionableError: {
          message: mapped.message,
          ...(mapped.recovery !== undefined ? { recovery: mapped.recovery } : {}),
        },
      };
    }

    // Local providers need no credential, so runtime truth alone decides.
    const credentialRequired = KEYED_FAMILIES.has(family);
    const hasUsableCredential = credentialSource !== 'NONE' || !credentialRequired;
    if (hasUsableCredential && options.enabled !== false && base.runtimeConfigured) {
      return { ...base, connectionState: 'CONNECTED' };
    }

    // Configured + enabled but the runtime cannot execute it yet: that is a real
    // problem the user can act on, not a silent "not connected".
    if (
      hasUsableCredential &&
      options.enabled !== false &&
      options.runtimeStatus === 'UNSUPPORTED_RUNTIME'
    ) {
      return {
        ...base,
        connectionState: 'ERROR',
        actionableError: {
          message: `${providerName(family)} is connected, but this VedMoulya cannot run it yet.`,
          recovery: { kind: 'go_advanced', actionLabel: 'Advanced setup' },
        },
      };
    }

    return { ...base, connectionState: 'DISCONNECTED' };
  }

  /**
   * Run the complete setup for one provider family on behalf of `userId`.
   *
   * NEVER throws for an expected provider failure: every stage outcome is a
   * typed result, so the UI can always render the truth — and a failure in the
   * middle can never be mistaken for "not configured".
   */
  async setup(request: ProviderSetupRequest): Promise<ProviderSetupResult> {
    const seed = emptySeed(request);
    const family = request.family;
    const name = providerName(family);

    // ── Stage 1 · discover (which provider is this?) ──────────────────────
    // Provider behaviour comes from the shared preset METADATA — the pipeline
    // itself has no per-vendor branches beyond names and the local runtime.
    if (!isSetupFamily(family)) {
      seed.stage = 'discover';
      return baseResult(seed, 'UNAVAILABLE', `${name} is not available in this VedMoulya.`);
    }
    const preset = providerPreset(family);
    const credentialRequired = KEYED_FAMILIES.has(family);
    const pastedKey = request.apiKey?.trim() || undefined;
    // Google's OAuth round trip is an authentication result that arrives
    // OUTSIDE this call. When it is reported as completed the pipeline still has
    // to verify the provider really works before anything may be "connected".
    const oauthAuthenticated = family === 'google' && request.oauthCompleted === true;

    // ── Stage 2 · authenticate ────────────────────────────────────────────
    seed.stage = 'authenticate';
    const credential = await this.resolveCredential(request, pastedKey);
    if (credential !== undefined) seed.credentialSource = credential.source;
    seed.credentialRequired = credentialRequired;

    // ── Stage 3 · validate reachability + authentication (ONE probe) ──────
    // The probe also answers "what models does this provider really serve", so
    // discovery is not a separate round trip.
    seed.stage = 'validate';
    const probeResult = await this.probe({
      family,
      apiKey: pastedKey,
      ...(credential !== undefined ? { credential } : {}),
      ...(request.endpointUrl !== undefined ? { endpointUrl: request.endpointUrl } : {}),
      ...(request.fetchFn !== undefined ? { fetchFn: request.fetchFn } : {}),
      ...(request.env !== undefined ? { env: request.env } : {}),
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    });
    if (probeResult.credentialSource !== 'NONE')
      seed.credentialSource = probeResult.credentialSource;

    if (!probeResult.connected) {
      // A key the user has not supplied yet is AUTH_REQUIRED; a keyless local
      // provider that is simply not running is ACTION_REQUIRED; a rejected key
      // is VALIDATION_FAILED. None may be softened into "not configured".
      if (probeResult.errorKind === 'no_credential' && credentialRequired && !oauthAuthenticated) {
        seed.stage = 'authenticate';
      }
      const mapped = mapFailure(family, probeResult.errorKind, probeResult.message, seed.stage);
      const advanced = advancedRecoveryFor(probeResult.errorKind);
      return baseResult(seed, mapped.outcome, mapped.message, {
        errorKind: probeResult.errorKind,
        ...(advanced !== undefined || mapped.recovery !== undefined
          ? { recovery: advanced ?? mapped.recovery }
          : {}),
      });
    }

    // ── Stage 4 · discover models (what the provider REALLY serves) ───────
    seed.stage = 'discover_models';
    seed.availableModels = probeResult.models ?? [];
    if (seed.availableModels.length === 0) {
      return baseResult(
        seed,
        'MODEL_DISCOVERY_FAILED',
        `${name} connected but reported no models.`,
        {
          recovery: { kind: 'retry', actionLabel: 'Scan again' },
        },
      );
    }

    // ── Stage 5 · choose the default model (from provider METADATA) ───────
    seed.stage = 'choose_default_model';
    const choice = choosePreferredModel(
      seed.availableModels.map((model) => ({ id: model.id, name: model.name })),
      preset.defaultModelId,
    );
    const chosen = choice.model;
    if (chosen === null) {
      return baseResult(seed, 'MODEL_DISCOVERY_FAILED', `${name} reported no usable model.`, {
        recovery: { kind: 'retry', actionLabel: 'Scan again' },
      });
    }
    seed.selectedModel = { id: chosen.id, name: chosen.name };
    seed.modelSelectionSource = choice.source;

    // ── Stage 6 · persist the credential (encrypted, owner-scoped) ────────
    // The secret is written ONLY after the provider accepted it, so a wrong key
    // is never stored. Without a deployment encryption key nothing is stored at
    // all, and the pipeline says so instead of pretending otherwise.
    seed.stage = 'persist_credential';
    try {
      seed.credentialStored = await this.persistCredential(request, pastedKey);
    } catch {
      return baseResult(
        seed,
        'PERSISTENCE_FAILED',
        `VedMoulya could not save this key securely, so ${name} was not connected.`,
        { recovery: { kind: 'go_advanced', actionLabel: 'Advanced setup' } },
      );
    }

    // ── Stage 7 · real generation validation on the chosen model ──────────
    // "Connected" must mean the AI can ANSWER. This is the step that separates a
    // working provider from one that merely listed models.
    seed.stage = 'validate';
    const generation = await this.generate({
      family,
      modelId: chosen.id,
      apiKey: pastedKey,
      ...(credential !== undefined ? { credential } : {}),
      ...(request.endpointUrl !== undefined ? { endpointUrl: request.endpointUrl } : {}),
      ...(request.fetchFn !== undefined ? { fetchFn: request.fetchFn } : {}),
      ...(request.env !== undefined ? { env: request.env } : {}),
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    });
    if (!generation.ok) {
      const mapped = mapFailure(family, generation.errorKind, generation.message ?? '', 'validate');
      const advanced = advancedRecoveryFor(generation.errorKind);
      return baseResult(seed, mapped.outcome, mapped.message, {
        errorKind: generation.errorKind,
        ...(advanced !== undefined || mapped.recovery !== undefined
          ? { recovery: advanced ?? mapped.recovery }
          : {}),
      });
    }

    // ── Stage 8/9 · enable + preferred provider/model ─────────────────────
    seed.stage = 'enable_provider';
    const preferences = await this.applyPreferences(request, chosen.id);
    seed.preferencesApplied = preferences.applied;
    if (preferences.failure) {
      // The credential is stored and verified, but the runtime still will not
      // pick this provider up. Reported as a real, recoverable failure.
      return baseResult(seed, 'PERSISTENCE_FAILED', preferences.failure.message, {
        preferenceStage: preferences.failure.stage,
        recovery: { kind: 'retry', actionLabel: 'Try again' },
      });
    }
    seed.stage = 'set_preferred';

    // ── Stage 10 · refresh state ──────────────────────────────────────────
    // The caller invalidates/refetches the provider queries; this result states
    // exactly what the new authoritative state is.
    seed.stage = 'refresh_state';
    const resolvable = await this.runtimeResolvable(
      request,
      seed.credentialStored,
      seed.credentialSource,
      credentialRequired,
    );
    if (!resolvable) {
      return baseResult(
        seed,
        'AUTH_REQUIRED',
        `${name} is verified, but VedMoulya still has no key it can use — add one to finish.`,
        { recovery: { kind: 'check_credential', actionLabel: 'Add key' } },
      );
    }

    return baseResult(seed, 'SUCCESS', `${name} connected.`, {
      connected: true,
      validationLatencyMs: generation.latencyMs,
    });
  }
}
