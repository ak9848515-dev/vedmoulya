// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Connection Lifecycle (SINGLE AUTHORITY)
// PROVIDER-01 — Phase 5/8: one provider state machine, no fake READY.
//
// THE PROBLEM THIS SOLVES
// The platform had three UNRELATED provider vocabularies that could disagree
// on the same screen:
//   1. runtime truth (packages/core startup/provider-runtime):
//        CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR
//   2. UI readiness (provider-readiness.ts): green / orange / red
//   3. connection display (provider-ux.ts): connected / issue / not_connected
// plus the user's persisted `enabled` preference. So "configured", "connected",
// "enabled" and "ready" were genuinely confusable — a configured-but-disabled
// provider could still render as "Connected".
//
// THE MODEL
// Everything user-visible is now derived from ONE lifecycle here:
//
//   NOT_CONFIGURED → CONFIGURING → VERIFYING → READY
//                        ↘              ↘        ↘
//                       FAILED        FAILED    DEGRADED / DISABLED
//
// INVARIANTS (enforced by tests, never by prose):
//   • READY is the ONLY state that means "this AI can answer right now".
//   • READY requires runtimeConfigured === true AND enabled === true AND no
//     failed verification — so a provider whose runtime cannot execute can
//     never be presented as ready (the "no fake READY" rule).
//   • configured ≠ enabled ≠ ready: each is a separate field on the result.
//   • The catalog lifecycle in @vedmoulya/providers (draft/testing/active/
//     maintenance/deprecated) is a DIFFERENT concern — it describes a catalog
//     entry's publishing state, not whether a user's connection works. It is
//     deliberately not conflated with this connection lifecycle.
//   • Nothing is fabricated: an unknown/missing runtime report is
//     NOT_CONFIGURED, never a hopeful READY.
// ─────────────────────────────────────────────────────────────────────────────

/** The one connection lifecycle for every provider (Gemini included). */
export type ProviderLifecycle =
  /** No usable runtime credential exists for this provider. */
  | 'NOT_CONFIGURED'
  /** The user is supplying/authorizing a credential right now (transient). */
  | 'CONFIGURING'
  /** A real connection test is running right now (transient). */
  | 'VERIFYING'
  /** Runtime-configured, enabled, and not known to be failing. */
  | 'READY'
  /** Configured and enabled, but the last real check failed transiently. */
  | 'DEGRADED'
  /** Configured but the credential/endpoint was rejected — needs the user. */
  | 'FAILED'
  /** Configured, but the user switched it off. */
  | 'DISABLED';

/** The single primary action a surface may offer for a state. */
export type ProviderNextAction = 'connect' | 'reconnect' | 'retry' | 'enable' | 'none';

/** Transient kinds: a retry can plausibly succeed without user action. */
const TRANSIENT_FAILURE_KINDS: ReadonlySet<string> = new Set([
  'unreachable',
  'rate_limited',
  'unavailable',
  'timeout',
]);

/**
 * Credential kinds: the user must reconnect/replace the credential. Kept
 * explicit so a rejected credential can never be softened into "retry".
 */
const CREDENTIAL_FAILURE_KINDS: ReadonlySet<string> = new Set([
  'invalid_api_key',
  'unauthorized',
  'not_found',
  'bad_request',
  'no_credential',
]);

export interface ProviderStateInput {
  /**
   * Runtime truth for the family, exactly as reported by the platform's
   * provider runtime (never re-derived from UI state).
   */
  runtimeStatus?: string | undefined;
  /** The user's persisted enable preference for this provider. */
  enabled: boolean;
  /**
   * In-flight flow stage for THIS surface (connect dialog / test button).
   * Transient presentation only — never persisted, never a stored state.
   */
  activity?: 'idle' | 'configuring' | 'verifying';
  /**
   * Outcome of the last REAL verification (connection test) for this
   * provider, when one has run. Absent means "not verified yet", which is
   * NOT the same as "verified broken".
   */
  lastVerification?: { ok: boolean; failureKind?: string } | undefined;
}

export interface ProviderState {
  lifecycle: ProviderLifecycle;
  /** TRUE only when the provider's runtime can really execute. */
  runtimeConfigured: boolean;
  /** The user's preference, preserved separately from readiness. */
  enabled: boolean;
  /** TRUE only for READY. The single source of truth for "usable now". */
  ready: boolean;
  /** Plain-language state name — colour is never the only signal. */
  label: string;
  /** ✓ / ⚠ / ○ / ● */
  symbol: string;
  /** Tailwind text colour for the label. */
  tone: string;
  /** One-line, non-technical explanation. Never a raw error or env var name. */
  hint: string;
  /** The one action a surface should offer. */
  nextAction: ProviderNextAction;
}

const CONNECTED_TONE = 'text-emerald-600 dark:text-emerald-400';
const ATTENTION_TONE = 'text-amber-600 dark:text-amber-400';
// #64748B on white is 4.76:1 (WCAG AA) — the lighter slate tint failed it.
const NEUTRAL_TONE = 'text-[#64748B] dark:text-[#94A3B8]';

function state(
  lifecycle: ProviderLifecycle,
  runtimeConfigured: boolean,
  enabled: boolean,
  label: string,
  symbol: string,
  tone: string,
  hint: string,
  nextAction: ProviderNextAction,
): ProviderState {
  return {
    lifecycle,
    runtimeConfigured,
    enabled,
    ready: lifecycle === 'READY',
    label,
    symbol,
    tone,
    hint,
    nextAction,
  };
}

/**
 * Derive the ONE lifecycle state from real platform facts.
 *
 * Order matters and is deliberate:
 *   1. in-flight activity (the user is literally mid-connect/verify),
 *   2. can the runtime execute at all (runtimeConfigured),
 *   3. did the user enable it,
 *   4. did a real verification fail (transient → DEGRADED, credential → FAILED),
 *   5. otherwise READY.
 */
export function deriveProviderState(input: ProviderStateInput): ProviderState {
  const runtimeStatus = input.runtimeStatus;
  const runtimeConfigured = runtimeStatus === 'CONFIGURED' || runtimeStatus === 'MOCK';
  const enabled = input.enabled;

  // 1. In-flight flow stages — the user is watching this happen right now.
  if (input.activity === 'configuring') {
    return state(
      'CONFIGURING',
      runtimeConfigured,
      enabled,
      'Connecting',
      '●',
      NEUTRAL_TONE,
      'Setting up this AI. This only takes a moment.',
      'none',
    );
  }
  if (input.activity === 'verifying') {
    return state(
      'VERIFYING',
      runtimeConfigured,
      enabled,
      'Verifying',
      '●',
      NEUTRAL_TONE,
      'Checking that this AI is ready to use.',
      'none',
    );
  }

  // 2. The runtime genuinely cannot execute this provider.
  if (!runtimeConfigured) {
    if (runtimeStatus === 'ERROR') {
      return state(
        'FAILED',
        false,
        enabled,
        'Connection problem',
        '⚠',
        ATTENTION_TONE,
        'The saved credential was rejected. Reconnect this AI to continue.',
        'reconnect',
      );
    }
    if (runtimeStatus === 'UNSUPPORTED_RUNTIME') {
      return state(
        'NOT_CONFIGURED',
        false,
        enabled,
        'Not available',
        '○',
        NEUTRAL_TONE,
        'Catalog only — this AI cannot run in this program yet.',
        'none',
      );
    }
    if (runtimeStatus === 'DISABLED') {
      // The runtime registry uses DISABLED for "not registered for execution
      // in this deployment" — a third meaning again, so it gets its own
      // wording. Offering "Connect" here would be a lie: there is nothing in
      // this build to connect to.
      return state(
        'NOT_CONFIGURED',
        false,
        enabled,
        'Not connected',
        '○',
        NEUTRAL_TONE,
        'This AI is not available in this version of VedMoulya.',
        'none',
      );
    }
    return state(
      'NOT_CONFIGURED',
      false,
      enabled,
      'Not connected',
      '○',
      NEUTRAL_TONE,
      'Connect this AI to use it.',
      'connect',
    );
  }

  // 3. Runnable, but the user switched it off — never shown as ready.
  if (!enabled) {
    return state(
      'DISABLED',
      true,
      false,
      'Disabled',
      '○',
      NEUTRAL_TONE,
      'This AI is turned off. Turn it on to use it again.',
      'enable',
    );
  }

  // 4. A real verification failed for this provider.
  const verification = input.lastVerification;
  if (verification && !verification.ok) {
    const kind = verification.failureKind;
    if (kind !== undefined && TRANSIENT_FAILURE_KINDS.has(kind)) {
      return state(
        'DEGRADED',
        true,
        true,
        'Needs attention',
        '⚠',
        ATTENTION_TONE,
        'This AI could not be reached just now. It may work if you try again.',
        'retry',
      );
    }
    return state(
      'FAILED',
      true,
      true,
      'Connection problem',
      '⚠',
      ATTENTION_TONE,
      'This AI did not accept the connection. Reconnect it to continue.',
      'reconnect',
    );
  }

  // 5. Runtime configured + enabled + no known failure ⇒ genuinely usable.
  if (runtimeStatus === 'MOCK') {
    return state(
      'READY',
      true,
      true,
      'Mock provider ready',
      '✓',
      CONNECTED_TONE,
      'Development mock runtime — deterministic and free.',
      'none',
    );
  }
  return state('READY', true, true, 'Ready', '✓', CONNECTED_TONE, 'Ready to use.', 'none');
}

/**
 * The single predicate for "this AI can answer right now".
 * Every badge, chip, card and gate should ask THIS — never a raw status.
 */
export function isProviderReady(input: ProviderStateInput): boolean {
  return deriveProviderState(input).ready;
}

/**
 * Kept for call sites that already hold a lifecycle/activity pair and need a
 * plain-language primary action label.
 */
export const NEXT_ACTION_LABELS: Readonly<Record<ProviderNextAction, string>> = {
  connect: 'Connect',
  reconnect: 'Reconnect',
  retry: 'Retry',
  enable: 'Enable',
  none: '',
};

/** True when a failure kind demands the user's credential, not a retry. */
export function isCredentialFailureKind(kind: string | undefined): boolean {
  return kind !== undefined && CREDENTIAL_FAILURE_KINDS.has(kind);
}
