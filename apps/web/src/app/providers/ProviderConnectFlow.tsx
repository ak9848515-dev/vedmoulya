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
  const isGoogle = family === 'google';

  // Google: the consent round trip is the authentication step. Connect drives
  // the existing sign-in flow, and the OAuth return (`oauthJustCompleted`) is
  // what makes the pipeline run — a completed consent alone is never enough.
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

  // The Google OAuth return: consent is done, so finish the pipeline (persist →
  // validate → enable → connected). This is the fix for "consent → Not
  // configured": the callback no longer merely sets a device flag.
  useEffect(() => {
    if (isGoogle && oauthJustCompleted && phase === 'idle') {
      void runSetupRef.current({ oauthCompleted: true });
    }
  }, [isGoogle, oauthJustCompleted, phase, runSetupRef]);
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
                if (isGoogle && failure.needsCredential) {
                  void google.connect();
                  return;
                }
                if (family === 'ollama') {
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
            if (isGoogle) {
              if (oauthJustCompleted || google.connected) {
                void runSetup({ oauthCompleted: true });
                return;
              }
              void google.connect();
              return;
            }
            void runSetup();
          }}
          disabled={setup.isPending || google.connecting || (needsKey && apiKey.trim() === '')}
          data-testid={`provider-connect-${family}`}
          className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {setup.isPending || google.connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          Connect
        </button>
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
