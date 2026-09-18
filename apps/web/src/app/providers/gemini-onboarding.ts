// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gemini onboarding (SINGLE SOURCE OF TRUTH for the first-login flow)
// PROVIDER-01 — Phases 3 / 4 / 6 / 16.
//
// WHAT THIS MODULE DECIDES (all pure — no React, no network):
//   1. whether the onboarding should appear AT ALL, and if so whether the user
//      is a new account (first-run) or a returning account with a real problem,
//   2. which steps the "Preparing your AI workspace" screen may show — and,
//      critically, which of them are TRUE at this moment,
//   3. which model is the recommended one, and whether that id was really
//      DISCOVERED or is only the registry default,
//   4. the plain-language copy for every state.
//
// THE TWO HONESTY RULES THIS ENCODES
//   R1 — NEVER ASK FOR A STEP THAT ISN'T NEEDED. When this deployment already
//        runs its own Gemini credential there is nothing for the user to
//        connect, so the flow verifies automatically and says so. The extra
//        step (and its one-sentence explanation) appears ONLY when it is
//        genuinely required.
//   R2 — NEVER SHOW A STEP AS DONE UNTIL IT IS. A step is `done` only when the
//        real fact behind it exists (the probe really connected, models were
//        really discovered, a model was really selected). The step list is
//        derived from the live operation, not from a timer.
//
// A Google sign-in is an IDENTITY, not Gemini generative-language access —
// there is no credential exchange, so the flow never pretends the sign-in
// configured Gemini.
// ─────────────────────────────────────────────────────────────────────────────

/** Screens of the first-login flow (Phase 3). */
export type GeminiStage =
  /** Screen 2 — "Preparing your AI workspace…" + automatic verification. */
  | 'preparing'
  /** Screen 3 — the ONE extra step, explained in one sentence. */
  | 'consent'
  /** The extra step itself (credential or server-managed confirmation). */
  | 'connect'
  /** SUCCESS — verified, with the model that was really selected. */
  | 'ready'
  /** Returning user — a real problem worth their attention. */
  | 'attention';

// ── Entry decision ──────────────────────────────────────────────────────────

/** A real, actionable problem — never a vague "something went wrong". */
export interface GeminiProblem {
  kind: 'credential' | 'unreachable';
  title: string;
  /** WHAT happened, in one plain sentence. */
  body: string;
  /** WHAT to do next. */
  action: 'reconnect' | 'retry';
  actionLabel: string;
}

export interface GeminiEntryInput {
  signedIn: boolean;
  /** Device-level dismissal ("don't ask me again on this browser"). */
  deviceDismissed: boolean;
  /** Device-level completion from an earlier visit (localStorage). */
  deviceConnectDone: boolean;
  /** Runtime registry truth for the `google` family (never re-derived). */
  googleRuntimeStatus?: string;
  /** Account-level state — the user's persisted provider preferences. */
  preferredProviderId?: string | undefined;
  preferredModelId?: string | undefined;
  /** The google row's enable flag from the provider experience view model. */
  geminiEnabledByUser?: boolean | undefined;
}

export type GeminiEntry =
  { kind: 'hidden' } | { kind: 'firstRun' } | { kind: 'attention'; problem: GeminiProblem };

/** True when the runtime can really execute this family. */
export function isGeminiRuntimeConfigured(runtimeStatus: string | undefined): boolean {
  return runtimeStatus === 'CONFIGURED' || runtimeStatus === 'MOCK';
}

const CREDENTIAL_PROBLEM: GeminiProblem = {
  kind: 'credential',
  title: 'Gemini needs attention',
  body: 'Your Gemini connection needs to be renewed.',
  action: 'reconnect',
  actionLabel: 'Reconnect Gemini',
};

const UNREACHABLE_PROBLEM: GeminiProblem = {
  kind: 'unreachable',
  title: 'Gemini is temporarily unavailable',
  body: "We couldn't reach Gemini just now. Check your connection and try again.",
  action: 'retry',
  actionLabel: 'Retry',
};

/**
 * Decide whether onboarding appears, and in which form.
 *
 * Order matters:
 *   1. signed out / dismissed on this device / Gemini deliberately switched
 *      off  → hidden. Onboarding is never a blocker and never nags.
 *   2. the account has already completed AI setup (a model was persisted at
 *      some point — real account state, so it holds on a NEW device too):
 *      show something ONLY if Gemini is the primary AI and the runtime really
 *      reports a broken credential.
 *   3. otherwise it is a first run.
 *
 * A missing/unknown runtime status is never treated as a problem — the
 * first-run flow discovers the truth by probing, it does not assume it.
 */
export function decideGeminiOnboarding(input: GeminiEntryInput): GeminiEntry {
  if (!input.signedIn) return { kind: 'hidden' };
  if (input.deviceDismissed) return { kind: 'hidden' };
  // The user switched Gemini off on purpose — never ask again.
  if (input.geminiEnabledByUser === false) return { kind: 'hidden' };

  const returningUser = Boolean(input.preferredModelId) || input.deviceConnectDone;
  if (returningUser) {
    const geminiIsPrimary = (input.preferredProviderId ?? 'google') === 'google';
    // The ONE runtime state that means "your credential was rejected": the
    // saved configuration cannot execute and the user must act.
    if (geminiIsPrimary && input.googleRuntimeStatus === 'ERROR') {
      return { kind: 'attention', problem: CREDENTIAL_PROBLEM };
    }
    // Everything else is either healthy (the /providers page shows the live
    // state) or impossible to act on in this build — stay out of the way.
    return { kind: 'hidden' };
  }

  return { kind: 'firstRun' };
}

// ── "Preparing your AI workspace" step list ─────────────────────────────────

export interface PreparingStep {
  key: string;
  label: string;
  /** TRUE only when the real fact behind this step exists. */
  done: boolean;
  /** The single step currently in flight (undefined once all are done). */
  active: boolean;
}

export interface PreparingStepsInput {
  /** e.g. "Account ready — founder@example.com". */
  accountLabel: string;
  /** The signed-in account's AI workspace state was really read. */
  workspaceReady: boolean;
  /** Runtime truth: can this deployment execute Gemini without the user? */
  runtimeConfigured: boolean;
  /**
   * Did the runtime read land at all? Before it does, nothing is known — and
   * showing the automatic sequence while it is unknown is honest because not a
   * single line is marked done; hiding it would imply we already know which
   * branch we are on.
   */
  runtimeKnown: boolean;
  /** Did the real connection attempt already succeed? */
  probeConnected: boolean;
  /** Number of models the provider really returned (null = not discovered). */
  discoveredModelCount: number | null;
  /** Name of the model that was really selected (null = not selected yet). */
  selectedModelName: string | null;
}

/**
 * Build the visible progress of the automatic sequence.
 *
 * With a server-managed credential the flow really does connect → verify →
 * discover → select, and each line flips to done when that really happened.
 * WITHOUT one, claiming "Connecting Gemini…" would be a lie: the honest line
 * says a single step is needed, and the flow goes on to explain it.
 */
export function buildPreparingSteps(input: PreparingStepsInput): PreparingStep[] {
  const steps: Array<{ key: string; label: string; done: boolean }> = [
    { key: 'account', label: input.accountLabel, done: true },
    { key: 'workspace', label: 'VedMoulya workspace ready', done: input.workspaceReady },
  ];

  if (input.runtimeConfigured || !input.runtimeKnown) {
    steps.push(
      { key: 'connecting', label: 'Connecting to Gemini…', done: input.probeConnected },
      { key: 'verifying', label: 'Verifying the connection…', done: input.probeConnected },
      {
        key: 'discovering',
        label: 'Discovering available models…',
        done: input.probeConnected && input.discoveredModelCount !== null,
      },
      {
        key: 'selecting',
        label: 'Selecting the recommended model…',
        done: input.selectedModelName !== null,
      },
    );
  } else {
    steps.push({ key: 'one-step', label: 'Gemini needs one quick step from you', done: false });
  }

  const firstPending = steps.find((step) => !step.done)?.key;
  return steps.map((step) => ({
    ...step,
    // Nothing is "in flight" until the workspace read has landed.
    active: input.workspaceReady && step.key === firstPending,
  }));
}

// ── Model selection ─────────────────────────────────────────────────────────

export interface RecommendedModel {
  id: string;
  name: string;
  /** `discovered` = the provider really returned it; `preset` = registry default. */
  source: 'discovered' | 'preset';
}

/**
 * Pick the recommended model from what the provider REALLY returned: the
 * registry default when the provider offers it, otherwise the provider's first
 * model. Only when nothing was discovered does it fall back to the registry
 * default — and it says so (`source: 'preset'`), so the UI can avoid claiming
 * a model was found on the account.
 */
export function selectRecommendedModel(
  models: ReadonlyArray<{ id: string; name: string }>,
  defaultModelId: string,
): RecommendedModel {
  const first = models[0];
  if (!first) return { id: defaultModelId, name: defaultModelId, source: 'preset' };
  const chosen = models.find((model) => model.id === defaultModelId) ?? first;
  return {
    id: chosen.id,
    name: chosen.name.trim() === '' ? chosen.id : chosen.name,
    source: 'discovered',
  };
}

// ── Failure → honest problem ────────────────────────────────────────────────

/** Credential-shaped failures demand the user's key; the rest are transient. */
const CREDENTIAL_FAILURE_KINDS: ReadonlySet<string> = new Set([
  'invalid_api_key',
  'unauthorized',
  'not_found',
  'bad_request',
  'no_credential',
]);

/**
 * Turn a real failure into WHAT happened / WHY / WHAT to do next (Phase 16).
 * Raw error text and env-var names never appear: only the classified kind is
 * used, and unknown kinds fall back to the retry guidance.
 */
export function problemForFailure(failureKind: string | undefined): GeminiProblem {
  return failureKind !== undefined && CREDENTIAL_FAILURE_KINDS.has(failureKind)
    ? CREDENTIAL_PROBLEM
    : UNREACHABLE_PROBLEM;
}

// ── Copy (plain language — no jargon, no env vars, no endpoints) ────────────

export const GEMINI_ONBOARDING_COPY = {
  preparingTitle: 'Preparing your AI workspace…',
  preparingLead: 'This only takes a moment.',
  consentTitle: 'Gemini',
  consentSubtitle: 'Your default AI assistant for VedMoulya.',
  /** The ONE sentence the mission asks for (Phase 3). */
  consentWhy:
    "Connect Gemini so VedMoulya can use Google's AI for your missions, learning and planning.",
  /** The honest clarification, without the words "API" or "authorization". */
  consentClarification:
    'Your Google sign-in is separate from Gemini — Gemini needs its own connection.',
  consentContinue: 'Continue',
  consentLater: 'Not now',
  readyTitle: 'Gemini is ready',
  readyLead: 'AI is ready for VedMoulya.',
  readyEnter: 'Enter VedMoulya',
  /** Shown when the connection is verified but the runtime still cannot run it. */
  verifiedNotRunnable:
    'Your connection is verified. This VedMoulya server needs its own Gemini credential before AI runs here — an administrator can enable it. Nothing else is blocked.',
  notNowNote: 'You can connect any AI later from AI Providers — nothing is blocked until then.',
} as const;
