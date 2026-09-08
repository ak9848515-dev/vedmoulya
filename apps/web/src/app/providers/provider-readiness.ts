// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Readiness & Usage Derivation (pure UI logic)
// EPIC-012A — Premium Experience Refinement
//
// Two DIFFERENT concepts, kept deliberately separate:
//
//   READINESS — can this provider operate for orchestration right now?
//     RED    → not configured sufficiently to operate ("Configure to use")
//     ORANGE → configuration exists and is valid, but the user disabled it
//              ("Ready to enable")
//     GREEN  → configured AND enabled ("Ready to use")
//
//   USAGE — what does the provider actually report about quota availability?
//     AVAILABLE / WARNING / LIMITED / UNAVAILABLE / NOT_CONFIGURED
//
// Everything here is PURE and derived from REAL persisted state (the same
// runtime-truth registry the config layer, production validator and
// registration use, plus per-user enable preferences and the registry health
// snapshot). NO VALUES ARE FABRICATED: when a provider does not report a
// quota number the UI says "Usage unavailable" — it never invents a
// remaining-percent.
// ─────────────────────────────────────────────────────────────────────────────

// ── Readiness ───────────────────────────────────────────────────────────────

export type ReadinessKey = 'green' | 'orange' | 'red';

export interface ProviderReadiness {
  key: ReadinessKey;
  /** Readable status text — colour is never the only signal. */
  label: string;
  /** Optional next-step hint (title tooltip / legend detail). */
  hint?: string;
}

/** Legend rows explained on the AI Providers overview (section 14). */
export const READINESS_LEGEND: ReadonlyArray<{
  key: ReadinessKey;
  label: string;
  hint: string;
}> = [
  { key: 'red', label: 'Not configured', hint: 'Configure to use' },
  { key: 'orange', label: 'Configured, not enabled', hint: 'Ready to enable' },
  { key: 'green', label: 'Configured and enabled', hint: 'Ready to use' },
];

/**
 * Map the runtime-truth status (packages/core startup provider-runtime:
 * CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / DISABLED /
 * ERROR — the same registry the config layer and production validator use)
 * plus the user's enable preference onto the single readiness indicator.
 *
 * A provider may only reach GREEN when it is genuinely CONFIGURED (or the
 * deterministic mock is the active dev/test runtime) AND the user enabled it.
 */
export function providerReadiness(
  runtimeStatus: string | undefined,
  enabled: boolean,
): ProviderReadiness {
  switch (runtimeStatus) {
    case 'CONFIGURED':
      return enabled
        ? { key: 'green', label: 'Configured and enabled', hint: 'Ready to use' }
        : { key: 'orange', label: 'Configured, not enabled', hint: 'Ready to enable' };
    case 'MOCK':
      // The deterministic mock is a real registered runtime in dev/test only.
      // It is never branded "Configured" (no key) — but it does execute.
      return enabled
        ? {
            key: 'green',
            label: 'Mock provider ready',
            hint: 'Deterministic mock active — development/test runtime.',
          }
        : {
            key: 'orange',
            label: 'Mock provider, disabled',
            hint: 'Deterministic mock is configured but turned off.',
          };
    case 'NOT_CONFIGURED':
      return {
        key: 'red',
        label: 'Not configured',
        hint: 'No runtime key is set — configure the provider to use it.',
      };
    case 'UNSUPPORTED_RUNTIME':
      return {
        key: 'red',
        label: 'Not available',
        hint: 'Catalog only — no runtime adapter exists for this provider in this build.',
      };
    case 'ERROR':
      return {
        key: 'red',
        label: 'Configuration error',
        hint: 'The configured key looks invalid — check the provider configuration.',
      };
    case 'DISABLED':
      return {
        key: 'red',
        label: 'Not registered',
        hint: 'This provider is not registered for execution in this environment.',
      };
    default:
      // Custom/user-registered entries, unknown families, or a missing runtime
      // report are never claimed executable.
      return {
        key: 'red',
        label: 'Not configured',
        hint: 'No runtime state is reported — configure the provider to use it.',
      };
  }
}

// ── Usage states (independent of readiness) ─────────────────────────────────

export type UsageState =
  | 'AVAILABLE' // usable known capacity/quota remaining
  | 'WARNING' // approaching a known quota/rate limit
  | 'LIMITED' // reached or nearly reached a known limit
  | 'UNAVAILABLE' // usage information cannot be retrieved
  | 'NOT_CONFIGURED' // provider has not been configured
  | 'UNMETERED'; // local/mock provider — no metered quota exists

export type UsageTone = 'emerald' | 'amber' | 'rose' | 'slate';

export interface ProviderUsageDisplay {
  state: UsageState;
  /** Primary line, e.g. "72% remaining", "Available", "Usage unavailable". */
  label: string;
  /** Optional clarifying detail (never a fabricated number). */
  detail?: string;
  tone: UsageTone;
}

/** Below this remaining-percent the provider is WARNING. */
export const USAGE_WARNING_BELOW_PCT = 40;
/** Below this remaining-percent the provider is LIMITED. */
export const USAGE_LIMITED_BELOW_PCT = 20;

/**
 * Caption shown whenever the widget displays provider-level percentages.
 * The percentage is the platform registry's provider-health quota signal —
 * it is NEVER the user's personal free-tier / plan balance (the backend does
 * not expose account balances, so none is ever claimed).
 */
export const PROVIDER_QUOTA_DISCLAIMER =
  'Percentages reflect the platform’s provider-health quota signal — not your account’s free-tier or plan balance.';

export interface ProviderUsageInput {
  readiness: ProviderReadiness;
  /** Registry health snapshot quota (0 when the provider reports none). */
  quotaUsedPercent: number;
  /** Local provider (ollama / lm-studio / local family) — no metered quota. */
  local?: boolean;
  /** Deterministic mock runtime active — no metered quota. */
  mock?: boolean;
}

/**
 * Honest per-provider usage display. Order matters:
 *  1. A provider that cannot operate is simply "Not configured".
 *  2. Local / mock providers are unmetered by construction.
 *  3. quotaUsedPercent <= 0 means the provider reports NO quota to the
 *     platform — the UI says "Usage unavailable" rather than inventing a
 *     number (e.g. claiming "100% remaining" from a missing signal).
 *  4. Only then is a REAL remaining-percent derived from the reported quota.
 */
export function deriveProviderUsage(input: ProviderUsageInput): ProviderUsageDisplay {
  if (input.readiness.key === 'red') {
    return {
      state: 'NOT_CONFIGURED',
      label: 'Not configured',
      detail: input.readiness.hint,
      tone: 'slate',
    };
  }
  if (input.local) {
    return {
      state: 'UNMETERED',
      label: 'Local',
      detail: 'Local provider — no metered quota.',
      tone: 'emerald',
    };
  }
  if (input.mock) {
    return {
      state: 'UNMETERED',
      label: 'Unmetered',
      detail: 'Deterministic mock — no metered quota.',
      tone: 'emerald',
    };
  }
  const quota = input.quotaUsedPercent;
  if (!Number.isFinite(quota) || quota <= 0) {
    return {
      state: 'UNAVAILABLE',
      label: 'Usage unavailable',
      detail: 'This provider does not report quota usage to VedMoulya.',
      tone: 'slate',
    };
  }
  const used = Math.min(100, Math.max(0, quota));
  const remaining = Math.round(100 - used);
  // The label names the SOURCE explicitly: this percentage is the platform's
  // provider-health quota signal (registry), never the user's free-tier
  // balance — the two must never be confused.
  if (remaining < USAGE_LIMITED_BELOW_PCT) {
    return {
      state: 'LIMITED',
      label: `Provider usage · ${remaining}% remaining`,
      detail:
        'Provider-level quota nearly exhausted (registry health signal — not your account balance).',
      tone: 'rose',
    };
  }
  if (remaining < USAGE_WARNING_BELOW_PCT) {
    return {
      state: 'WARNING',
      label: `Provider usage · ${remaining}% remaining`,
      detail:
        'Provider-level quota approaching its limit (registry health signal — not your account balance).',
      tone: 'amber',
    };
  }
  return {
    state: 'AVAILABLE',
    label: `Provider usage · ${remaining}% remaining`,
    detail: 'Provider-level quota signal from the registry (not your account balance).',
    tone: 'emerald',
  };
}
