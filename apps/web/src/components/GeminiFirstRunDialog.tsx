// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — First-login Gemini onboarding (PROVIDER-01, Phases 3 / 4 / 6 / 16)
//
// A non-technical user must reach "Gemini is ready" without ever being asked
// what an endpoint, API key, adapter or model registry is. This rebuild does
// three things the previous dialog did not:
//
//   1. IT NEVER ASKS FOR AN UNNECESSARY STEP. When this deployment already runs
//      its own Gemini credential, there is nothing for the user to connect: the
//      flow shows the automatic sequence, verifies against the REAL provider
//      and reports the model that was really selected. The one extra step (and
//      its one-sentence explanation) only appears when it is truly required.
//   2. IT AUTO-VERIFIES END TO END. A successful screen is only reachable after
//      a real server-side connection test + real model discovery through the
//      EXISTING gateway endpoint (the same one /providers uses) — never from a
//      database record, an `enabled` flag, or a local optimistic guess.
//   3. SO IT IS SHOWN ONCE PER ACCOUNT. Completion is recorded as real account
//      state (the provider + model that setup verified), so a returning user on
//      a NEW device is not walked through setup again; they only see something
//      if Gemini is their primary AI and its credential was really rejected.
//
// Presentation only: every fact here is read from the existing provider
// runtime / preferences endpoints, and every write goes through the existing
// provider preference services. This component never touches a credential
// itself (the credential step embeds the existing SimpleProviderConfig, whose
// key is verified server-side and — PROVIDER-01 — sealed encrypted at rest by
// the gateway, never readable by a browser again).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPortal, DialogOverlay, DialogContent } from '@vedmoulya/ui';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { providerPreset } from '@vedmoulya/shared';
import { useAuthStore } from '../stores/auth-store.js';
import { useFirstRunStore } from '../stores/first-run-store.js';
import {
  useConnectProvider,
  useProviderPreferences,
  useProviderRuntimeStatus,
  useSetProviderEnabled,
  useSetProviderPreferences,
  type ProviderConnectionResultDTO,
} from '../lib/api-client.js';
import { SimpleProviderConfig } from '../app/providers/SimpleProviderConfig.js';
import {
  GEMINI_ONBOARDING_COPY,
  buildPreparingSteps,
  decideGeminiOnboarding,
  isGeminiRuntimeConfigured,
  problemForFailure,
  selectRecommendedModel,
  type GeminiProblem,
  type GeminiStage,
  type RecommendedModel,
} from '../app/providers/gemini-onboarding.js';

const GEMINI_PRESET = providerPreset('google');

type ProbeStatus = 'idle' | 'running' | 'connected' | 'failed';

export function GeminiFirstRunDialog(): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const deviceDismissed = useFirstRunStore((s) => s.geminiPromptDismissed);
  const deviceConnectDone = useFirstRunStore((s) => s.geminiConnectDone);
  const dismiss = useFirstRunStore((s) => s.dismissGeminiPrompt);
  const markDone = useFirstRunStore((s) => s.markGeminiConnectDone);

  const connect = useConnectProvider();
  const setEnabled = useSetProviderEnabled();
  const setPrefs = useSetProviderPreferences();

  const userId = user?.userId ?? '';
  const runtimeQuery = useProviderRuntimeStatus(userId);
  const preferencesQuery = useProviderPreferences(userId);

  const [stage, setStage] = useState<GeminiStage>('preparing');
  /** Local hide: closes the dialog for THIS mount once the user acts. */
  const [hidden, setHidden] = useState(false);
  /**
   * The user has acted in THIS mount (chose a step, connected, or verified).
   * Once that is true the dialog stays visible through the success screen even
   * if the entry decision would now hide it (e.g. completion was just recorded).
   * Without this the save→ready hand-off could unmount the very screen that
   * confirms the connection.
   */
  const [acted, setActed] = useState(false);
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>('idle');
  const [probeResult, setProbeResult] = useState<ProviderConnectionResultDTO | null>(null);
  const [problem, setProblem] = useState<GeminiProblem | null>(null);
  const [recommended, setRecommended] = useState<RecommendedModel | null>(null);
  /** Model reported by the credential step (SimpleProviderConfig). */
  const [connectedModelName, setConnectedModelName] = useState<string | null>(null);

  // ── Real platform facts (never re-derived from UI state) ──────────────────

  const googleRuntime = (runtimeQuery.data?.providers ?? []).find((p) => p.family === 'google');
  const runtimeConfigured = isGeminiRuntimeConfigured(googleRuntime?.status);
  /** The runtime registry read really returned — no step before that is true. */
  const workspaceReady = runtimeQuery.data !== undefined;

  const preferences = preferencesQuery.data;
  /**
   * Only the user's switch-off list can say "the user turned Gemini off".
   * Absent preferences must NOT be read as "disabled" — unknown is unknown.
   */
  const geminiEnabledByUser = preferences
    ? !preferences.disabledProviderIds.includes('google')
    : undefined;

  const entry = useMemo(
    () =>
      decideGeminiOnboarding({
        signedIn: Boolean(user),
        deviceDismissed,
        deviceConnectDone,
        ...(googleRuntime ? { googleRuntimeStatus: googleRuntime.status } : {}),
        preferredProviderId: preferences?.preferredProviderId,
        preferredModelId: preferences?.preferredModelId,
        geminiEnabledByUser,
      }),
    [
      user,
      deviceDismissed,
      deviceConnectDone,
      googleRuntime,
      preferences?.preferredProviderId,
      preferences?.preferredModelId,
      geminiEnabledByUser,
    ],
  );

  // ── Automatic verification (the real governed provider path) ──────────────

  const runAutoVerify = useCallback(async (): Promise<void> => {
    setActed(true);
    setProbeStatus('running');
    setProblem(null);
    try {
      // No credential is sent: this asks the EXISTING gateway endpoint to test
      // this deployment's own Gemini runtime and return the models it really
      // exposes. Nothing is assumed or optimistically marked ready.
      const result = await connect.mutateAsync({ userId, family: 'google' });
      setProbeResult(result);
      if (!result.connected) {
        setProbeStatus('failed');
        setProblem(problemForFailure(result.errorKind));
        setStage('attention');
        return;
      }
      const selection = selectRecommendedModel(result.models ?? [], GEMINI_PRESET.defaultModelId);
      setRecommended(selection);
      setProbeStatus('connected');
      try {
        // Phase 6 — automatic registration + model selection. Only facts this
        // verification just established are written; a model id is persisted
        // ONLY when the provider really returned it.
        await setEnabled.mutateAsync({ userId, providerId: 'google', enabled: true });
        await setPrefs.mutateAsync({
          userId,
          preferredProviderId: 'google',
          ...(selection.source === 'discovered' ? { preferredModelId: selection.id } : {}),
        });
      } catch {
        // Verification already succeeded; persisting the choice is best-effort
        // and must never turn a working Gemini into an error screen.
      }
      setStage('ready');
    } catch {
      setProbeStatus('failed');
      setProblem(problemForFailure(undefined));
      setStage('attention');
    }
  }, [connect, setEnabled, setPrefs, userId]);

  /**
   * Returning account whose Gemini credential was really rejected: the entry
   * decision already knows the honest problem, so surface it directly instead
   * of sitting on the "preparing" screen forever (nothing to probe).
   */
  const entryProblem = entry.kind === 'attention' ? entry.problem : null;
  useEffect(() => {
    if (hidden || entryProblem === null) return;
    setProblem(entryProblem);
    setStage('attention');
  }, [hidden, entryProblem]);

  useEffect(() => {
    if (hidden || entry.kind !== 'firstRun' || stage !== 'preparing') return;
    // Wait for the real runtime read before claiming anything about Gemini.
    if (!workspaceReady) return;
    if (!runtimeConfigured) {
      // Nothing to verify without a credential — explain the one extra step.
      setStage('consent');
      return;
    }
    if (probeStatus !== 'idle') return;
    void runAutoVerify();
  }, [hidden, entry.kind, stage, workspaceReady, runtimeConfigured, probeStatus, runAutoVerify]);

  const steps = buildPreparingSteps({
    accountLabel: `Account ready${user?.email ? ` — ${user.email}` : ''}`,
    workspaceReady,
    runtimeConfigured,
    runtimeKnown: workspaceReady,
    probeConnected: probeStatus === 'connected',
    discoveredModelCount: probeResult?.connected ? (probeResult.models ?? []).length : null,
    selectedModelName: recommended?.name ?? null,
  });

  // ── Visibility + close semantics ──────────────────────────────────────────

  // Once the user has acted in this mount, the dialog stays open through the
  // hand-off (the entry decision may hide itself the moment completion is
  // recorded — that must not tear down the confirmation screen).
  const open = !hidden && (entry.kind !== 'hidden' || acted);

  const close = useCallback(() => {
    if (stage === 'ready') markDone();
    else dismiss();
    setHidden(true);
  }, [stage, markDone, dismiss]);

  const handleContinue = useCallback(() => {
    setActed(true);
    setStage('connect');
  }, []);

  const handleRetry = useCallback(() => {
    setProblem(null);
    setProbeStatus('idle');
    setStage('preparing');
  }, []);

  const handleReconnect = useCallback(() => {
    setActed(true);
    setProblem(null);
    setProbeStatus('idle');
    setStage('connect');
  }, []);

  const handleConfigured = useCallback(
    (modelName?: string) => {
      setActed(true);
      if (modelName !== undefined && modelName.trim() !== '') setConnectedModelName(modelName);
      // The credential step already ran the REAL server-side test + discovery;
      // completion is recorded for the account and for this browser.
      markDone();
      setStage('ready');
    },
    [markDone],
  );

  const readyModel = stage === 'ready' ? (recommended?.name ?? connectedModelName) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          size={stage === 'connect' ? 'lg' : 'md'}
          aria-label="Connect your AI"
          className="dark:bg-[#1E293B] dark:border dark:border-[#334155]"
        >
          {stage === 'preparing' ? (
            <div data-testid="gemini-preparing" aria-busy={probeStatus === 'running'}>
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                  <Sparkles className="h-5 w-5 text-[#2B5FD9]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
                    Welcome to VedMoulya
                  </p>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                    {GEMINI_ONBOARDING_COPY.preparingTitle}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {GEMINI_ONBOARDING_COPY.preparingLead}
                  </p>
                </div>
              </div>

              {/* Every line here is a REAL fact: it flips to done only when the
                  underlying step actually happened. */}
              <ul
                className="mt-5 space-y-2.5"
                data-testid="gemini-preparing-steps"
                role="status"
                aria-live="polite"
              >
                {steps.map((step) => (
                  <li
                    key={step.key}
                    data-step={step.key}
                    data-done={step.done ? 'true' : 'false'}
                    className="flex items-center gap-2.5 text-[13px] text-[#374151] dark:text-[#E2E8F0]"
                  >
                    {step.done ? (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    ) : step.active ? (
                      <Loader2
                        className="h-4 w-4 shrink-0 animate-spin text-[#2B5FD9] dark:text-[#6B8FEF]"
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="h-1.5 w-1.5 ml-1.5 mr-0.5 shrink-0 rounded-full bg-[#CBD5E1] dark:bg-[#475569]"
                        aria-hidden="true"
                      />
                    )}
                    {step.label}
                    <span className="sr-only">
                      {step.done ? ' — done' : step.active ? ' — in progress' : ' — waiting'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : stage === 'consent' ? (
            <div data-testid="gemini-consent">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                  <Cpu className="h-5 w-5 text-[#2B5FD9]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
                    Recommended
                  </p>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                    {GEMINI_ONBOARDING_COPY.consentTitle}
                  </h2>
                  <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {GEMINI_ONBOARDING_COPY.consentSubtitle}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-[#374151] dark:text-[#E2E8F0]">
                {GEMINI_ONBOARDING_COPY.consentWhy}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                {GEMINI_ONBOARDING_COPY.consentClarification}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleContinue}
                  data-testid="gemini-continue"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2"
                >
                  {GEMINI_ONBOARDING_COPY.consentContinue}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-9 items-center rounded-[12px] px-3 text-[13px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B] dark:hover:text-[#CBD5E1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
                >
                  {GEMINI_ONBOARDING_COPY.consentLater}
                </button>
              </div>
              <p className="mt-3 text-[11.5px] text-[#94A3B8]">
                {GEMINI_ONBOARDING_COPY.notNowNote}
              </p>
            </div>
          ) : stage === 'connect' ? (
            <div data-testid="gemini-connect">
              <SimpleProviderConfig
                userId={userId}
                presetId="google"
                variant="dialog"
                onConfigured={handleConfigured}
              />
            </div>
          ) : stage === 'attention' && problem ? (
            <div data-testid="gemini-attention" role="alert">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#FFFBEB] dark:bg-[#291704] shrink-0">
                  <AlertTriangle
                    className="h-5 w-5 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    {problem.title}
                  </h2>
                  {/* WHAT happened + WHY + WHAT to do next. */}
                  <p className="mt-1 text-[13px] leading-relaxed text-[#374151] dark:text-[#E2E8F0]">
                    {problem.body}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {problem.action === 'reconnect' ? (
                  <button
                    type="button"
                    onClick={handleReconnect}
                    data-testid="gemini-reconnect"
                    className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2"
                  >
                    {problem.actionLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRetry}
                    data-testid="gemini-retry"
                    className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2"
                  >
                    {problem.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-10 items-center rounded-[14px] border border-[#CBD5E1] px-4 text-[14px] font-medium text-[#374151] transition-colors hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-[#E2E8F0] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
                >
                  {GEMINI_ONBOARDING_COPY.consentLater}
                </button>
              </div>
            </div>
          ) : (
            <div data-testid="gemini-ready">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#F0FDF4] dark:bg-[#0F291D] shrink-0">
                  <ShieldCheck
                    className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
                    Verified
                  </p>
                  <h2 className="text-[20px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] mt-1">
                    {GEMINI_ONBOARDING_COPY.readyTitle}
                  </h2>
                  <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {GEMINI_ONBOARDING_COPY.readyLead}
                  </p>
                </div>
              </div>

              {readyModel ? (
                <p
                  className="mt-4 text-[14px] text-[#374151] dark:text-[#E2E8F0]"
                  data-testid="gemini-ready-model"
                >
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Model — </span>
                  {readyModel}
                </p>
              ) : null}

              {/* Honest, non-technical: verified does not mean this deployment can
                  run it. No env-var names are shown to the user. */}
              {!runtimeConfigured ? (
                <p className="mt-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                  {GEMINI_ONBOARDING_COPY.verifiedNotRunnable}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    // Completion is REAL account state — record it before leaving.
                    markDone();
                    setHidden(true);
                    router.push('/dashboard');
                  }}
                  data-testid="gemini-enter"
                  className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[14px] font-medium text-white transition-all hover:bg-[#1E4AA8] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2"
                >
                  {GEMINI_ONBOARDING_COPY.readyEnter}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markDone();
                    setHidden(true);
                    router.push('/providers?provider=google');
                  }}
                  className="inline-flex h-10 items-center rounded-[14px] border border-[#CBD5E1] px-4 text-[14px] font-medium text-[#374151] transition-colors hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-[#E2E8F0] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
                >
                  Review AI Providers
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
