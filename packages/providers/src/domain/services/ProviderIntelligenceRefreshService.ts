// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Intelligence Refresh Service
// EPIC-012B — AI Provider Intelligence & Model Discovery
//
// A SAFE refresh mechanism layered over the frozen EPIC-012A
// ProviderIntelligenceService (which remains the single profile
// derivation engine — nothing is rebuilt):
//   1. refresh() re-derives the profile from registry facts and runs
//      the optional provider-metadata discovery port (fail-safe —
//      a failed discovery NEVER fails the provider; the profile still
//      builds from declared registry facts with honest provenance).
//   2. The delta (added / removed / preserved models) is computed
//      against the previous profile. Removed models are marked
//      unavailable/deprecated — never silently deleted — and user
//      preferences are structurally untouched by refresh.
//   3. staleness() detects stale cached intelligence against a
//      refresh policy (maxAgeMs) so callers can refresh in the
//      background without querying metadata on every UI render.
//
// The cardinal rule stays: never fabricate. Unknown fields remain
// UNKNOWN; verification is never claimed beyond what a source proved.
// ──────────────────────────────────────────────────────────────────

import type { Provider } from '../entities/Provider.js';
import { ProviderIntelligenceService } from './ProviderIntelligenceService.js';
import type {
  IntelligenceVerificationState,
  ModelLifecycleStatus,
  ProfileStaleness,
  ProviderCatalogDiscoveryPort,
  ProviderCatalogDiscoveryResult,
  ProviderIntelligenceProfile,
  ProviderIntelligenceRefreshResult,
} from '../../types/intelligence-types.js';

/** Default refresh policy: intelligence older than 24h is stale. */
export const DEFAULT_INTELLIGENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ProviderIntelligenceRefreshOptions {
  now?: () => Date;
  /** Refresh policy for staleness verdicts (default 24h). */
  maxAgeMs?: number;
  /** Optional provider-metadata discovery. Default: a fail-safe adapter
   *  that never claims discovery (models stay registry-declared). */
  discovery?: ProviderCatalogDiscoveryPort;
}

/**
 * The fail-safe default: discovery is NOT attempted (no provider API
 * configured), and the result states so honestly. Refresh never fails
 * the provider because of it — the profile derives from registry facts.
 */
class DeclaredOnlyCatalogDiscovery implements ProviderCatalogDiscoveryPort {
  discover(providerId: string): Promise<ProviderCatalogDiscoveryResult> {
    return Promise.resolve({
      discovered: false,
      source: 'none',
      retrievedAt: new Date().toISOString(),
      verificationState: 'UNKNOWN',
      models: [],
      statusMessage:
        `No live provider metadata source is configured for "${providerId}"; ` +
        'model intelligence is derived from registry-declared metadata.',
    });
  }
}

/** Previous-refresh context used to compute the safe delta + lifecycle ledger. */
export interface ProviderIntelligenceRefreshContext {
  profile?: ProviderIntelligenceProfile;
  /** The previously persisted known-models ledger (survives across refreshes). */
  knownModels?: Record<string, ModelLifecycleStatus>;
}

export class ProviderIntelligenceRefreshService {
  private readonly now: () => Date;
  private readonly maxAgeMs: number;
  private readonly discovery: ProviderCatalogDiscoveryPort;
  private readonly builder: ProviderIntelligenceService;

  constructor(options: ProviderIntelligenceRefreshOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_INTELLIGENCE_MAX_AGE_MS;
    this.discovery = options.discovery ?? new DeclaredOnlyCatalogDiscovery();
    this.builder = new ProviderIntelligenceService({ now: this.now });
  }

  /**
   * Derive a fresh profile for a provider and compute the safe delta
   * against an optional previous refresh context. Never throws for
   * discovery failures — the provider stays Connected with
   * partially-verified intelligence and UNKNOWN fields.
   */
  async refresh(
    provider: Provider,
    previous?: ProviderIntelligenceRefreshContext,
  ): Promise<ProviderIntelligenceRefreshResult> {
    const previousProfile = previous?.profile;
    const profile = this.builder.buildProfile(provider);
    const knownModels = this.mergeKnownModels(profile, previous?.knownModels);

    // Fail-safe discovery: a failed/unavailable metadata source must not
    // take the provider down — the declared registry facts still apply.
    let discovery: ProviderCatalogDiscoveryResult;
    try {
      discovery = await this.discovery.discover(provider.id);
    } catch {
      discovery = {
        discovered: false,
        source: 'none',
        retrievedAt: this.now().toISOString(),
        verificationState: 'UNKNOWN',
        models: [],
        statusMessage: `Provider metadata discovery for "${provider.id}" failed; model intelligence stays registry-declared.`,
      };
    }

    const delta = this.computeDelta(profile, previousProfile);
    const verificationState = this.verificationState(profile, discovery);

    return {
      providerId: provider.id,
      providerName: provider.name,
      profile,
      knownModels,
      verifiedAt: this.now().toISOString(),
      verificationState,
      discovery: {
        attempted: true,
        discovered: discovery.discovered,
        source: discovery.source,
        message: discovery.statusMessage,
      },
      delta,
      refreshPolicy: { maxAgeMs: this.maxAgeMs },
    };
  }

  /**
   * Staleness verdict for a cached profile. A missing/never-verified
   * profile is always stale; otherwise the age vs the refresh policy.
   */
  staleness(
    profile: ProviderIntelligenceProfile | null,
    options: { now?: () => Date; maxAgeMs?: number } = {},
  ): ProfileStaleness {
    const clock = options.now ?? this.now;
    const maxAgeMs = options.maxAgeMs ?? this.maxAgeMs;
    if (!profile) {
      return {
        isStale: true,
        ageMs: 0,
        maxAgeMs,
        lastVerifiedAt: null,
      };
    }
    const generatedAt = Date.parse(profile.generatedAt);
    const ageMs = Number.isFinite(generatedAt)
      ? Math.max(0, clock().getTime() - generatedAt)
      : Number.POSITIVE_INFINITY;
    return {
      isStale: ageMs > maxAgeMs,
      ageMs,
      maxAgeMs,
      lastVerifiedAt: profile.generatedAt,
    };
  }

  // ── Internals ───────────────────────────────────────────────────

  /**
   * The persistent lifecycle ledger. Current models are 'active'; models
   * that were previously seen but are absent now are marked 'unavailable'
   * (or keep an escalated 'deprecated' verdict) — never silently deleted,
   * and the fact survives across refreshes.
   */
  private mergeKnownModels(
    profile: ProviderIntelligenceProfile,
    previousKnown?: Record<string, ModelLifecycleStatus>,
  ): Record<string, ModelLifecycleStatus> {
    // A Map keeps this lint-safe (no computed member access on records) and
    // type-safe under noUncheckedIndexedAccess; the ledger keys are the
    // provider's own model ids, never raw user input.
    const merged = new Map<string, ModelLifecycleStatus>();
    for (const model of profile.models) {
      merged.set(model.modelId, 'active');
    }
    for (const [modelId, status] of Object.entries(previousKnown ?? {})) {
      if (!merged.has(modelId)) {
        // Escalate once, then persist: active → unavailable; deprecated stays
        // deprecated. A model that returns to the registry becomes active again.
        merged.set(modelId, status === 'deprecated' ? 'deprecated' : 'unavailable');
      }
    }
    return Object.fromEntries(merged);
  }

  private computeDelta(
    profile: ProviderIntelligenceProfile,
    previousProfile?: ProviderIntelligenceProfile,
  ): ProviderIntelligenceRefreshResult['delta'] {
    const current = new Set(profile.models.map((m) => m.modelId));
    const previousIds = new Set(previousProfile?.models.map((m) => m.modelId) ?? []);

    const addedModels = [...current].filter((id) => !previousIds.has(id));
    const preservedModels = [...current].filter((id) => previousIds.has(id));
    // Removed models are reported (never deleted) so the UI can mark them
    // unavailable/deprecated while preserving the user's stored preference.
    const removedModels = [...previousIds].filter((id) => !current.has(id));

    // Stable ordering keeps results deterministic.
    addedModels.sort();
    preservedModels.sort();
    removedModels.sort();
    return { addedModels, removedModels, preservedModels, userPreferencesPreserved: true };
  }

  /**
   * Honest verification state:
   *  - LIVE metadata discovered  → FULLY_VERIFIED (provider source confirmed).
   *  - Registry-declared facts   → PARTIALLY_VERIFIED (unknowns stay UNKNOWN).
   *  - No known facts at all     → UNVERIFIED (never with a valid registry).
   */
  private verificationState(
    profile: ProviderIntelligenceProfile,
    discovery: ProviderCatalogDiscoveryResult,
  ): IntelligenceVerificationState {
    if (discovery.discovered) return 'FULLY_VERIFIED';
    const known =
      profile.coverage.modelCount > 0 &&
      profile.coverage.knownPropertyCount + profile.coverage.unknownPropertyCount > 0 &&
      profile.coverage.knownPropertyCount > 0;
    return known ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED';
  }
}
