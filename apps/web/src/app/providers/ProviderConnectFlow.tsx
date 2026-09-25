// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Connect (G9: the ONE setup experience)
//
// This component IS the normal path:
//
//     AI → Add AI → choose provider → [Connect] → done
//
// It replaces the manual Scan → pick model → Test Connection → Save & Enable →
// set-preferred sequence (and the per-family configuration screens) with ONE
// call to the ProviderSetupOrchestrator, and renders ONE typed result:
//
//   • SUCCESS      → "✓ <Provider> connected" + model + kind + [Change model] /
//                    [Disconnect], with the advanced affordance secondary,
//   • any failure  → the EXACT stage that stopped, ONE plain message and ONE
//                    next action — never a vague "not configured".
//
// Nothing provider-specific lives here: the provider's identity, kind, model
// default and discovery behaviour all come from the shared preset metadata and
// the gateway. The technical surfaces (endpoint, protocol, connection details)
// stay behind [Advanced], which reuses the existing infrastructure untouched.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  Settings2,
  ExternalLink,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { providerPreset } from '@vedmoulya/shared';
import {
  useSetupProvider,
  useDisconnectProvider,
  useProviderSetupStatus,
  type ProviderSetupResultDTO,
  type ConnectProviderFamily,
} from '../../lib/api-client.js';
import { providerIdentity } from './provider-ux.js';
import { ProviderMark } from './ProviderMark.js';
import { useGoogleAccountConnection } from './google-account-connection.js';
import {
  SetupStepView,
  connectActionLabel,
  providerNeedsKeyUpFront,
  setupFailureView,
  setupStepViews,
  setupSuccessView,
} from './provider-setup-copy.js';

export interface ProviderConnectFlowProps {
  userId: string;
  /**
   * Provider family id from the platform registry (never typed by the user),
   * restricted to the gateway's G9 connect contract. Callers holding a wider
   * registry id narrow it with `connectProviderFamily` (provider-ux.ts).
   */
  family: ConnectProviderFamily;
  /** Called once a setup really succeeded (parent refreshes its view model). */
  onConnected?: (result: ProviderSetupResultDTO) => void;
  /** Opens the existing advanced provider surfaces (nothing is deleted). */
  onAdvanced?: () => void;
  /** Google only — the OAuth round trip just completed for this user. */
  oauthJustCompleted?: boolean;
}

type Phase = 'idle' | 'connecting' | 'connected' | 'failed';

export function ProviderConnectFlow({
  userId,
  family,
  onConnected,
  onAdvanced,
  oauthJustCompleted = false,
}: ProviderConnectFlowProps): React.JSX.Element {
  const preset = providerPreset(family);
  const identity = providerIdentity(family);
  const setup = useSetupProvider();
  const disconnect = useDisconnectProvider();
  const status = useProviderSetupStatus(userId, family);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ProviderSetupResultDTO | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const needsKey = providerNeedsKeyUpFront(family);
  // BUGFIX (Gemini credential confusion) — the `google` family id is a MODEL
  // VENDOR, not an authentication method. Connect uses the Gemini API KEY
  // (keyed flow), while Google identity OAuth stays available only through the
  // EXPLICIT "Connect Google account" affordance below. Mapping Connected to
  // `family === 'google'` is what sent Gemini users into the identity consent
  // screen instead of the Gemini key configuration.
  const isGoogle = family === 'google';
  const supportsGoogleIdentity = isGoogle;

  // Google identity is OPTIONAL enrichment — never the way a provider is
  // switched on. A Gemini API key is the credential the Gemini API requires, so
  // the keyed setup path above is the only pipeline. This hook exists for the
  // explicit account-connection action and for honouring an OAuth round trip.
  const google = useGoogleAccountConnection(
    userId,
    '/providers?provider=google',
    oauthJustCompleted,
  );

  const runSetup = useCallback(
    async (options: { oauthCompleted?: boolean } = {}): Promise<void> => {
      setPhase('connecting');
      setResult(null);
      try {
        const outcome = await setup.mutateAsync({
          userId,
          family,
          ...(needsKey && apiKey.trim() !== '' ? { apiKey: apiKey.trim() } : {}),
          ...(options.oauthCompleted === true ? { oauthCompleted: true } : {}),
        });
        setResult(outcome);
        if (outcome.outcome === 'SUCCESS' && outcome.connected) {
          setPhase('connected');
          setApiKey('');
          onConnected?.(outcome);
          return;
        }
        setPhase('failed');
      } catch (error) {
        // A transport failure (offline, gateway error) is NOT a provider
        // verdict — say so instead of inventing a provider problem.
        //
        // BUGFIX (transport dead end) — the gateway ALWAYS attaches a recovery
        // action to a provider verdict, but this locally-constructed result has
        // no gateway verdict behind it, so it must supply its own. Omitting it
        // left the user with "gateway unreachable" and NO next action at all
        // (the recovery button only renders when actionLabel exists), i.e. no
        // way forward except a manual page reload.
        setResult({
          outcome: 'UNAVAILABLE',
          connected: false,
          providerId: family,
          stage: 'validate',
          credentialSource: 'NONE',
          selectedModel: null,
          availableModels: [],
          hasModelChoice: false,
          modelSelectionSource: 'none',
          message:
            error instanceof Error && error.message
              ? error.message
              : 'VedMoulya could not reach its own gateway. Try again.',
          recovery: { kind: 'retry', actionLabel: 'Try again' },
          credentialStored: false,
          preferencesApplied: false,
          completedAt: new Date().toISOString(),
        });
        setPhase('failed');
      }
    },
    [apiKey, family, needsKey, onConnected, setup, userId],
  );

  const runSetupRef = React.useRef(runSetup);
  runSetupRef.current = runSetup;

  // BUGFIX (family switch) — the flow can be re-used for a DIFFERENT provider on
  // the same mounted instance (the provider page keeps one flow mounted while
  // the selected family changes). `phase` and `result` belong to the PREVIOUS
  // family: leaving `phase === 'failed'` in place hid the key field for the new
  // family too (it is gated on `phase !== 'failed'`), so the card showed a stale
  // failure from another provider and offered NO key input at all — a dead end.
  // Every per-family verdict is discarded when the family changes.
  const previousFamilyRef = React.useRef(family);
  useEffect(() => {
    if (previousFamilyRef.current === family) return;
    previousFamilyRef.current = family;
    setPhase('idle');
    setResult(null);
    setApiKey('');
    setShowKey(false);
  }, [family]);

  // The Google OAuth return: consent finished, so the account marker is shown —
  // but consent is NOT the Gemini credential, so the KEYED pipeline still runs
  // and still decides whether Gemini is connected. This is why a returning user
  // no longer sees "consent done → still needs a key".
  //
  // BUGFIX (Gemini recovery loop) — this runs AT MOST ONCE per mounted flow.
  // Without the latch, the effect re-armed itself every time the phase returned
  // to 'idle' and re-ran the keyless pipeline immediately: the recovery action
  // on an AUTH_REQUIRED failure ("Add key") set the phase to 'idle', the effect
  // fired again, the run failed again, and the user was trapped on the failure
  // card with no way to ever reach the key field. The flag records that this
  // mount has already honoured its OAuth return; returning to the key field is
  // now a real, stable state.
  const oauthSetupStartedRef = React.useRef(false);
  useEffect(() => {
    if (!isGoogle || !oauthJustCompleted) return;
    if (oauthSetupStartedRef.current) return;
    if (phase !== 'idle' || apiKey.trim() !== '') return;
    oauthSetupStartedRef.current = true;
    void runSetupRef.current({ oauthCompleted: true });
  }, [isGoogle, oauthJustCompleted, phase, apiKey, runSetupRef]);
  const connectedFromStatus = status.data?.connectionState === 'CONNECTED';
  const success = useMemo(
    () => (result ? setupSuccessView(result, identity.name) : null),
    [identity.name, result],
  );

  if (phase === 'connected' && success) {
    return (
      <div className="space-y-3" data-testid="provider-connect-success">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
          <CheckCircle2
            className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-emerald-800 dark:text-emerald-300">
              {success.title}
            </p>
            <p className="mt-0.5 text-[13px] text-[#374151] dark:text-[#E2E8F0] break-words">
              {success.modelName}
            </p>
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">{success.kind}</p>
            {success.credentialNote ? (
              <p className="mt-1 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                {success.credentialNote}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {success.canChangeModel ? (
            <button
              type="button"
              onClick={() => {
                // Changing the model is an ADVANCED action — hand off to the
                // existing advanced surfaces (which own model selection),
                // exactly like "Open provider details" below. No second model
                // chooser is invented here.
                onAdvanced?.();
              }}
              data-testid="provider-connect-change-model"
              className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 transition-colors"
            >
              Change model
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void disconnect.mutateAsync({ userId, family }).then(() => {
                setPhase('idle');
                setResult(null);
              });
            }}
            data-testid="provider-connect-disconnect"
            className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 text-[13px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:border-rose-300 hover:text-rose-600 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'connecting') {
    const steps = setupStepViews('discover', false);
    return (
      <div className="space-y-3" data-testid="provider-connect-progress" aria-live="polite">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-[#2B5FD9]" aria-hidden="true" />
          <p className="text-[13.5px] font-medium text-[#111827] dark:text-[#F8FAFC]">
            Connecting {identity.name}…
          </p>
        </div>
        <ul className="space-y-1.5">
          {steps.map((step: SetupStepView) => (
            <li
              key={step.stage as string}
              className="flex items-center gap-2 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]"
            >
              <span aria-hidden="true" className="w-4 text-center">
                {step.active ? '•' : '○'}
              </span>
              {step.label}
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-[#94A3B8]">
          VedMoulya sets this AI up for you — no technical configuration needed.
        </p>
      </div>
    );
  }

  const failure = result ? setupFailureView(result) : null;

  return (
    <div className="space-y-3" data-testid="provider-connect-flow">
      {/* ── The provider card: one primary action ───────────────────────── */}
      <div className="flex items-start gap-3">
        <ProviderMark family={family} name={identity.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {identity.name}
          </p>
          <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
            {preset.deployment === 'local' ? 'Runs on this computer' : identity.vendor}
          </p>
        </div>
        {connectedFromStatus && phase === 'idle' ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Connected
          </span>
        ) : null}
      </div>

      {/* ── API-key providers: ONE key field, nothing else ──────────────── */}
      {needsKey && phase !== 'failed' ? (
        <div>
          <label
            htmlFor={`provider-key-${family}`}
            className="block text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0] mb-1.5"
          >
            {preset.credentialLabel}
          </label>
          <div className="relative">
            <KeyRound
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]"
              aria-hidden="true"
            />
            <input
              id={`provider-key-${family}`}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder={preset.credentialLabel}
              data-testid={`provider-connect-key-${family}`}
              className="w-full h-10 rounded-[12px] border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] pl-9 pr-10 text-[13px] text-[#111827] dark:text-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
            />
            <button
              type="button"
              onClick={() => {
                setShowKey((current) => !current);
              }}
              aria-label={showKey ? 'Hide key' : 'Show key'}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#475569] dark:hover:text-[#CBD5E1]"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#94A3B8]">
            Stored encrypted for your account — never shown again, never logged.
          </p>
        </div>
      ) : null}

      {/* ── The failure: exactly ONE message and ONE next action ─────────── */}
      {failure ? (
        <div
          data-testid="provider-connect-failure"
          className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 p-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-amber-800 dark:text-amber-300">
                {failure.message}
              </p>
              {failure.detail ? (
                <p className="mt-1 text-[12px] text-amber-700/90 dark:text-amber-400/90">
                  {failure.detail}
                </p>
              ) : null}
            </div>
          </div>
          {failure.actionLabel ? (
            <button
              type="button"
              onClick={() => {
                // The recovery action is chosen by WHAT THE GATEWAY SAID went
                // wrong (recovery.kind), never by which provider it is.
                //
                // BUGFIX (retry ignored for non-local providers) — this used to
                // special-case `family === 'ollama'` for retrying and fall
                // through to a bare `setPhase('idle')` for everyone else. A
                // gateway `retry` recovery ("Try again" / "Scan again") on any
                // CLOUD family therefore did nothing at all: the error card was
                // dismissed and the user had to find and press Connect again,
                // even though the button they pressed promised a retry. Keying
                // on the kind makes the button do what its label says for every
                // family, while a credential problem still returns to the KEY
                // field instead of firing a request that cannot succeed yet.
                if (failure.needsCredential) {
                  // A missing/incorrect credential (Gemini included) → back to
                  // the key field, never to a consent screen and never an
                  // immediate re-run that is guaranteed to fail the same way.
                  setPhase('idle');
                  return;
                }
                // BUGFIX (local-runtime recovery dead end) — `start_local_provider`
                // is the gateway's recovery kind for a LOCAL runtime it could not
                // use (not reachable / no models installed / browser blocked), and
                // its label is always an invitation to try again ("Try again",
                // "Scan again"). It was unhandled, so pressing it only dismissed
                // the card and silently dropped back to an unchanged idle form:
                // the action the user just pressed did nothing at all. It is now
                // handled the same way as an explicit retry — because for a local
                // runtime the setup call IS the scan.
                if (
                  failure.recoveryKind === 'retry' ||
                  failure.recoveryKind === 'start_local_provider'
                ) {
                  void runSetup();
                  return;
                }
                setPhase('idle');
              }}
              data-testid="provider-connect-recovery"
              className="mt-2.5 ml-6 inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#2B5FD9] px-3.5 text-[12.5px] font-medium text-white hover:bg-[#1E4AA8] transition-colors"
            >
              {failure.actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── One primary action: Connect ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            // ONE primary action. Every provider — including Gemini — connects
            // through the gateway setup pipeline; a Google account authorization
            // is a SEPARATE, explicit action offered below.
            void runSetup();
          }}
          disabled={setup.isPending || (needsKey && apiKey.trim() === '')}
          data-testid={`provider-connect-${family}`}
          className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {setup.isPending || google.connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {connectActionLabel(family)}
        </button>
        {/* Google IDENTITY — an explicit, separate action. It authorizes a
            Google ACCOUNT and is deliberately NOT the way Gemini is connected,
            because a Gemini API key is a different credential. */}
        {supportsGoogleIdentity ? (
          <button
            type="button"
            onClick={() => {
              void google.connect();
            }}
            disabled={google.connecting}
            data-testid="provider-connect-google-account"
            className="inline-flex h-10 items-center gap-2 rounded-[14px] border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 transition-colors disabled:opacity-50"
          >
            {google.connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {google.connected ? 'Google account connected' : 'Connect Google account'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((current) => !current);
          }}
          data-testid="provider-connect-advanced-toggle"
          className="inline-flex h-10 items-center gap-1.5 rounded-[14px] px-3 text-[12.5px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          Advanced
        </button>
        {preset.docsUrl ? (
          <a
            href={preset.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-[#64748B] dark:text-[#94A3B8] hover:underline"
          >
            {family === 'ollama' ? 'Get Ollama' : 'Where to get a key'}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {google.error ? (
        <p className="text-[12px] text-rose-600 dark:text-rose-400" role="alert">
          {google.error}
        </p>
      ) : null}

      {/* ── Advanced: everything technical lives here, and only here ─────── */}
      {showAdvanced ? (
        <div
          data-testid="provider-connect-advanced"
          className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] p-3 space-y-2"
        >
          <p className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
            VedMoulya configures this AI automatically. These details are only useful for
            troubleshooting.
          </p>
          <dl className="space-y-1.5 text-[12px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#64748B] dark:text-[#94A3B8]">Connection</dt>
              <dd className="text-[#374151] dark:text-[#E2E8F0]">Managed automatically</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#64748B] dark:text-[#94A3B8]">Key stored</dt>
              <dd className="text-[#374151] dark:text-[#E2E8F0]">
                {status.data?.credentialSource === 'NONE' ? 'Not yet' : 'Encrypted'}
              </dd>
            </div>
            {status.data?.lastValidatedAt ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#64748B] dark:text-[#94A3B8]">Last checked</dt>
                <dd className="text-[#374151] dark:text-[#E2E8F0]">
                  {new Date(status.data.lastValidatedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            onClick={() => {
              onAdvanced?.();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3.5 text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 transition-colors"
          >
            Open provider details
          </button>
        </div>
      ) : null}
    </div>
  );
}
