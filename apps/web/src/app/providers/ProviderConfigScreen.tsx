// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configure AI (Screen 2)
// AI PROVIDER UX SIMPLIFICATION — provider → authentication → model → done.
//
// Sections, in the order a person thinks:
//   1. Connection   — API KEY or OAUTH, side by side (no separate pages)
//   2. Model        — the AI's REAL models (Automatic preferred); one model
//                     means no choice to make
//   3. How VedMoulya can use this AI — auto-detected, read-only
//   4. Usage        — "Use this AI" / "Use as primary AI" (no priority numbers)
//   5. Advanced     — collapsed; endpoint/protocol shown as "Managed
//                     automatically" for built-in providers, and the existing
//                     custom-provider flow for Custom AI only.
//
// REUSE, not duplication: provider metadata comes from the shared preset
// registry, connection testing + model discovery from the existing gateway
// `connectProvider` probe, model intelligence from the existing provider
// intelligence layer, and every preference change goes through the existing
// owner-scoped provider preferences service. No endpoint, protocol, routing or
// capability logic lives in this component.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loading, Switch } from '@vedmoulya/ui';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Settings2,
  Zap,
} from 'lucide-react';
import { providerPreset } from '@vedmoulya/shared';
import {
  useConnectProvider,
  useProviderIntelligenceStatus,
  useRefreshProviderIntelligence,
  useSetProviderPreferences,
  type ProviderConnectionResultDTO,
  type ProviderExperienceRowDTO,
  type ProviderRuntimeStateDTO,
} from '../../lib/api-client.js';
import { ProviderMark } from './ProviderMark.js';
import { AddProviderPanel } from './AddProviderPanel.js';
import type { ProviderOverviewPreferences } from './ProvidersOverview.js';
import { DEFAULT_PRIMARY_PROVIDER_ID } from './ProvidersOverview.js';
import {
  capabilityPhrases,
  connectProviderFamily,
  friendlyConnectionError,
  isBuiltInProvider,
  modelSubtitle,
  providerIdentity,
  providerStatusDisplay,
  supportsAutomaticModel,
  supportsOAuth,
} from './provider-ux.js';
import { useGoogleAccountConnection } from './google-account-connection.js';

export interface ProviderConfigScreenProps {
  userId: string;
  provider: ProviderExperienceRowDTO;
  preferences: ProviderOverviewPreferences | undefined;
  runtime?: ProviderRuntimeStateDTO | undefined;
  onBack: () => void;
  /** Open the existing full provider detail (registry intelligence) view. */
  onOpenDetails: (providerId: string) => void;
  /** Turn this AI on/off (existing provider preferences service). */
  onToggle: (providerId: string, enabled: boolean) => void;
  /** Make this AI the Primary AI (existing provider preferences service). */
  onSetPrimary: (providerId: string) => void;
  /** Refresh the experience view model after a preference change. */
  onChanged: () => void;
}

type AuthMethod = 'api_key' | 'oauth';

interface ModelChoice {
  id: string;
  name: string;
  subtitle?: string;
}

// ── Small building blocks ───────────────────────────────────────────────────

function SectionCard({
  children,
  testId,
  labelledBy,
}: {
  children: React.ReactNode;
  testId?: string;
  /** id of the section heading — gives the region an accessible name. */
  labelledBy?: string;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby={labelledBy}
      className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 sm:p-6"
      data-testid={testId}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h2
      id={id}
      className="text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]"
    >
      {children}
    </h2>
  );
}

function Subtitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="mt-1 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">{children}</p>;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export function ProviderConfigScreen({
  userId,
  provider,
  preferences,
  runtime,
  onBack,
  onOpenDetails,
  onToggle,
  onSetPrimary,
  onChanged,
}: ProviderConfigScreenProps): React.JSX.Element {
  const identity = providerIdentity(provider.family, provider.name);
  const preset = providerPreset(provider.family);
  const builtIn = isBuiltInProvider(provider.family);

  const connect = useConnectProvider();
  const setPreferences = useSetProviderPreferences();
  const refreshIntelligence = useRefreshProviderIntelligence();
  const intelligence = useProviderIntelligenceStatus(userId, provider.providerId);

  const [method, setMethod] = useState<AuthMethod>('api_key');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProviderConnectionResultDTO | null>(null);
  const [failure, setFailure] = useState<{ title: string; hint?: string } | null>(null);
  const [savingModel, setSavingModel] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Announced to assistive tech when a probe fails (the alert is focused).
  const failureRef = useRef<HTMLDivElement>(null);

  // PROVIDER-01 — configured ≠ connected ≠ enabled: the display is derived
  // from the one canonical lifecycle, so a disabled provider never claims to
  // be connected. While the probe runs it reports the LIVE check (VERIFYING)
  // instead of a stale "Not connected" — the transient vocabulary the
  // lifecycle already defines, so the chip never contradicts the spinner.
  const status = providerStatusDisplay(runtime?.status, identity.name, provider.enabled, {
    ...(testing ? { activity: 'verifying' } : {}),
  });

  // The deployment may already hold a working credential for this provider
  // (same rule the Simple mode uses) — then no key is needed from the user.
  const serverManagedAvailable =
    provider.family === 'google' && runtime?.status === 'CONFIGURED' && !useOwnKey;

  // Recognise the OAuth round trip (`?oauth=google` set by our own return URL).
  const returnedFromOAuth = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('oauth') === 'google';
  }, []);
  const googleAccount = useGoogleAccountConnection(
    userId,
    `/providers?provider=${encodeURIComponent(provider.providerId)}`,
    returnedFromOAuth,
  );

  const enabled = provider.enabled;
  const isPrimary =
    (preferences?.preferredProviderId ?? DEFAULT_PRIMARY_PROVIDER_ID) === provider.providerId;
  // The domain default (never stored) — it cannot be switched off, only
  // outweighed by choosing another AI as primary.
  const defaultPrimary = isPrimary && !preferences?.preferredProviderId;
  const selectedModelId =
    isPrimary && preferences?.preferredModelId ? preferences.preferredModelId : undefined;

  // ── Models: provider intelligence first, registry catalog as fallback ────
  const models: ModelChoice[] = useMemo(() => {
    const profiles = intelligence.data?.record.profile.models ?? [];
    if (profiles.length > 0) {
      return profiles.map((model) => {
        const subtitle = modelSubtitle(model.capabilities.value ?? []);
        return {
          id: model.modelId,
          name: model.name,
          ...(subtitle ? { subtitle } : {}),
        };
      });
    }
    return provider.models.map((model) => {
      const subtitle = modelSubtitle(model.capabilities);
      return { id: model.id, name: model.name, ...(subtitle ? { subtitle } : {}) };
    });
  }, [intelligence.data, provider.models]);

  const discovered = result?.connected ? (result.models ?? []) : [];
  const automaticSupported = supportsAutomaticModel(models.length);

  // Capabilities — auto-detected, read-only. Union across the AI's models so
  // the answer does not depend on which model happens to be selected.
  const capabilities = useMemo(() => {
    const profiles = intelligence.data?.record.profile.models ?? [];
    const raw =
      profiles.length > 0
        ? profiles.flatMap((model) => model.capabilities.value ?? [])
        : provider.models.flatMap((model) => model.capabilities);
    return capabilityPhrases([...new Set(raw)]);
  }, [intelligence.data, provider.models]);

  // GEMINI UX (credential separation) — a Google ACCOUNT identity and Gemini
  // API access are different things. Gemini's required connection method is its
  // own API key; the Google account authorization is a separate, optional
  // identity connection that never activates Gemini. The labels below state
  // that explicitly, so OAuth can never read as an alternative way to switch
  // Gemini on.
  const isGemini = provider.family === 'google';
  const authOptions = [
    {
      id: 'api_key' as const,
      icon: <KeyRound className="h-4 w-4" aria-hidden="true" />,
      title: isGemini ? 'GEMINI API KEY' : 'API KEY',
      description: isGemini ? 'Required to use Gemini AI' : 'Connect with API key',
      available: true,
      unavailableReason: '',
    },
    {
      id: 'oauth' as const,
      icon: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
      title: 'GOOGLE ACCOUNT',
      description: isGemini
        ? 'Your Google account connection is separate from Gemini API access.'
        : 'Connect your Google account',
      available: supportsOAuth(provider.family),
      unavailableReason: `OAuth isn't available for ${identity.name} yet — use an API key.`,
    },
  ];

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleTest = useCallback(async (): Promise<void> => {
    setTesting(true);
    setFailure(null);
    setResult(null);
    try {
      const outcome = await connect.mutateAsync({
        userId,
        // The gateway family contract is the provider registry's own family id.
        // This screen is the ADVANCED/custom-endpoint path: a registry-only
        // family (openrouter, mock, a user-defined endpoint) deliberately probes
        // as OpenAI-compatible here. It is never reached from the one-click flow
        // for such a family — page.tsx gates that on isContractProviderFamily.
        family: connectProviderFamily(provider.family),
        ...(serverManagedAvailable ? {} : { apiKey: apiKey || undefined }),
        ...(preset.endpointUserConfigurable && preset.defaultEndpoint
          ? { endpointUrl: preset.defaultEndpoint }
          : {}),
      });
      setResult(outcome);
      if (outcome.connected) {
        // A verified connection is what "connect this AI" means: switch it on
        // through the EXISTING owner-scoped preferences service (no credential
        // is ever stored — VedMoulya keeps the provider choice only).
        if (!enabled) onToggle(provider.providerId, true);
        onChanged();
      } else {
        setFailure(friendlyConnectionError(identity.name, outcome.errorKind));
      }
    } catch {
      // Raw transport text never reaches the user — only the friendly message.
      setFailure(friendlyConnectionError(identity.name));
    } finally {
      setTesting(false);
    }
  }, [
    connect,
    userId,
    builtIn,
    provider.family,
    provider.providerId,
    serverManagedAvailable,
    apiKey,
    preset.endpointUserConfigurable,
    preset.defaultEndpoint,
    enabled,
    onToggle,
    onChanged,
    identity.name,
  ]);

  const handleModelSelect = useCallback(
    async (modelId: string | undefined): Promise<void> => {
      setSavingModel(true);
      setModelError(null);
      try {
        // Choosing a specific model records the preferred provider + model pair
        // (the domain's own semantics — one pair). Automatic clears the model
        // without touching which AI is primary.
        await setPreferences.mutateAsync(
          modelId
            ? {
                userId,
                preferredProviderId: provider.providerId,
                preferredModelId: modelId,
              }
            : { userId, preferredModelId: null },
        );
        onChanged();
      } catch {
        setModelError("Couldn't save that model. Please try again.");
      } finally {
        setSavingModel(false);
      }
    },
    [setPreferences, userId, provider.providerId, onChanged],
  );

  const handlePrimaryToggle = useCallback(
    (next: boolean): void => {
      if (next) {
        // The server requires the Primary AI to be enabled first.
        if (!enabled) onToggle(provider.providerId, true);
        onSetPrimary(provider.providerId);
      } else if (isPrimary && preferences?.preferredProviderId) {
        void setPreferences
          .mutateAsync({ userId, preferredProviderId: null, preferredModelId: null })
          .then(() => {
            onChanged();
          })
          .catch(() => {
            setModelError("Couldn't update the primary AI. Please try again.");
          });
      }
    },
    [
      enabled,
      onToggle,
      onSetPrimary,
      provider.providerId,
      isPrimary,
      preferences,
      setPreferences,
      userId,
      onChanged,
    ],
  );

  const handleDiscoverModels = useCallback(async (): Promise<void> => {
    try {
      await refreshIntelligence.mutateAsync({ userId, id: provider.providerId });
    } catch {
      setModelError("Couldn't refresh this AI's models. Please try again.");
    }
  }, [refreshIntelligence, userId, provider.providerId]);

  // A failed probe is announced to screen-reader users by moving focus to the
  // alert (keyboard users land on the Try Again action next).
  useEffect(() => {
    if (failure) failureRef.current?.focus();
  }, [failure]);

  if (intelligence.isLoading && models.length === 0) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading this AI..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-slide-up">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] rounded"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        AI Providers
      </button>

      <div className="flex items-start gap-4">
        <ProviderMark family={provider.family} name={provider.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-[22px] md:text-[26px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
            Configure {identity.name}
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">{identity.vendor}</p>
          <p
            className={`mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-medium ${status.connection.tone}`}
            title={status.connection.hint}
            data-testid="config-connection-status"
          >
            <span aria-hidden="true">{status.connection.symbol}</span>
            {status.connection.label}
          </p>
        </div>
      </div>

      {/* ── 1. Connection ───────────────────────────────────────────────── */}
      <SectionCard testId="config-section-connection" labelledBy="connection-heading">
        <SectionTitle id="connection-heading">Connection</SectionTitle>
        <Subtitle>
          {serverManagedAvailable
            ? 'This server already holds a working credential for this AI.'
            : isGemini
              ? 'Gemini requires its own API key to use Gemini AI.'
              : `Connect ${identity.name} to VedMoulya.`}
        </Subtitle>

        <fieldset className="mt-4">
          <legend className="sr-only">Authentication method</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {authOptions.map((option) => {
              const selected = method === option.id;
              return (
                <label
                  key={option.id}
                  className={`relative flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors ${
                    selected
                      ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A8A]/30'
                      : 'border-[#E2E8F0] dark:border-[#334155] hover:border-[#2B5FD9]/40'
                  } ${option.available ? '' : 'opacity-60 cursor-not-allowed'}`}
                  data-testid={`auth-option-${option.id}`}
                >
                  <input
                    type="radio"
                    name="auth-method"
                    value={option.id}
                    checked={selected}
                    disabled={!option.available}
                    onChange={() => {
                      setMethod(option.id);
                    }}
                    className="sr-only peer"
                  />
                  <span className="text-[#2B5FD9] dark:text-[#6B8FEF] peer-focus-visible:outline-none">
                    {option.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold tracking-wide text-[#111827] dark:text-[#F8FAFC]">
                      {option.title}
                    </span>
                    <span className="block text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {/* An unavailable method explains itself — VedMoulya never offers a
              connection it cannot make. */}
          {authOptions
            .filter((option) => !option.available)
            .map((option) => (
              <p
                key={`${option.id}-reason`}
                data-testid={`auth-option-${option.id}-unavailable`}
                className="mt-2 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]"
              >
                {option.unavailableReason}
              </p>
            ))}
        </fieldset>

        {/* API key panel — a real form, so pressing Enter in the key field
            runs the connection test (no hidden save action). */}
        {method === 'api_key' ? (
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleTest();
            }}
          >
            {serverManagedAvailable ? (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-[#F0FDF4] dark:bg-[#0F291D] p-3.5">
                <p className="text-[13px] font-medium text-emerald-700 dark:text-emerald-400">
                  Using this server&apos;s configured credential
                </p>
                <p className="mt-0.5 text-[12px] text-emerald-700/80 dark:text-emerald-500/80">
                  No key needed from you — VedMoulya verifies and connects directly.
                </p>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="provider-api-key"
                  className="block text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
                >
                  API Key
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="relative flex-1">
                    <input
                      id="provider-api-key"
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      autoComplete="off"
                      onChange={(event) => {
                        setApiKey(event.target.value);
                      }}
                      placeholder={`Paste your ${identity.name} key`}
                      data-testid="provider-api-key-input"
                      {...(preset.credentialHelp
                        ? { 'aria-describedby': 'provider-api-key-help' }
                        : {})}
                      className="w-full h-11 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] pl-3 pr-11 text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus:border-[#2B5FD9]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowKey((prev) => !prev);
                      }}
                      aria-label={showKey ? 'Hide API key' : 'Show API key'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9]"
                    >
                      {showKey ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </span>
                </div>
                {preset.credentialHelp ? (
                  <p
                    id="provider-api-key-help"
                    className="mt-1.5 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]"
                  >
                    {preset.credentialHelp}{' '}
                    {preset.docsUrl ? (
                      <a
                        href={preset.docsUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
                      >
                        Get a key
                      </a>
                    ) : null}
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={testing || (!serverManagedAvailable && apiKey.trim() === '')}
                data-testid="provider-test-connection"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Zap className="h-4 w-4" aria-hidden="true" />
                )}
                Test Connection
              </button>
              {provider.family === 'google' && runtime?.status === 'CONFIGURED' ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseOwnKey((prev) => !prev);
                  }}
                  data-testid="provider-use-own-key"
                  className="text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
                >
                  {useOwnKey ? 'Use the configured credential' : 'Use my own key instead'}
                </button>
              ) : null}
            </div>

            {result?.connected ? (
              <p
                role="status"
                data-testid="provider-connection-success"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Connected
                {typeof result.latencyMs === 'number' ? (
                  <span className="text-[12px] font-normal text-[#64748B] dark:text-[#94A3B8]">
                    · {result.latencyMs} ms
                    {discovered.length > 0
                      ? ` · ${String(discovered.length)} model${discovered.length === 1 ? '' : 's'} available`
                      : ''}
                  </span>
                ) : null}
              </p>
            ) : null}

            {failure ? (
              <div
                ref={failureRef}
                role="alert"
                tabIndex={-1}
                data-testid="provider-connection-error"
                className="rounded-xl border border-rose-200 dark:border-rose-900 bg-[#FEF2F2] dark:bg-[#2A1215] p-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <p className="text-[13px] font-medium text-rose-700 dark:text-rose-400">
                  {failure.title}
                </p>
                {failure.hint ? (
                  <p className="mt-0.5 text-[12px] text-rose-600 dark:text-rose-400/80">
                    {failure.hint}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="mt-2.5 inline-flex h-9 items-center rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-transparent px-3.5 text-[12.5px] font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : null}
          </form>
        ) : (
          /* OAuth panel — uses the EXISTING Google authorization flow */
          <div className="mt-5 space-y-3" data-testid="provider-oauth-panel">
            {googleAccount.connected ? (
              <>
                {/* The Google ACCOUNT is authorised — this is deliberately NOT
                    rendered as the AI being connected (no provider-green
                    checkmark): identity is not the Gemini credential. */}
                <p
                  data-testid="provider-google-account-status"
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0]"
                >
                  <ShieldCheck
                    className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]"
                    aria-hidden="true"
                  />
                  Google account connected
                </p>
                <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                  Your Google account connection is separate from Gemini API access. It does not
                  connect Gemini — Gemini requires its own API key, above.
                </p>
                <button
                  type="button"
                  onClick={googleAccount.disconnect}
                  data-testid="provider-oauth-disconnect"
                  className="inline-flex h-10 items-center rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-4 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 transition-colors"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#374151] dark:text-[#E2E8F0]">Google account</p>
                <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                  Your Google account connection is separate from Gemini API access.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void googleAccount.connect();
                  }}
                  disabled={googleAccount.connecting}
                  data-testid="provider-oauth-connect"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] disabled:opacity-60 transition-colors"
                >
                  {googleAccount.connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Continue with Google
                </button>
                <p className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                  Uses VedMoulya&apos;s existing Google sign-in — no new account is created.
                </p>
              </>
            )}
            {googleAccount.error ? (
              <p role="alert" className="text-[12.5px] text-rose-600 dark:text-rose-400">
                {googleAccount.error}
              </p>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* ── 2. Model ────────────────────────────────────────────────────── */}
      <SectionCard testId="config-section-model" labelledBy="model-heading">
        <SectionTitle id="model-heading">Model</SectionTitle>
        <Subtitle>Choose the model VedMoulya should use.</Subtitle>

        {models.length === 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
              VedMoulya hasn&apos;t discovered this AI&apos;s models yet.
            </p>
            <button
              type="button"
              onClick={() => {
                void handleDiscoverModels();
              }}
              disabled={refreshIntelligence.isPending}
              data-testid="provider-discover-models"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3.5 text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 transition-colors disabled:opacity-50"
            >
              {refreshIntelligence.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Discover models
            </button>
          </div>
        ) : models.length === 1 && models[0] ? (
          <div
            className="mt-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-4 py-3"
            data-testid="provider-model-single"
          >
            <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
              {models[0].name}
            </p>
            <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              The only model this AI offers — selected automatically.
            </p>
          </div>
        ) : (
          <fieldset className="mt-4">
            <legend className="sr-only">Model</legend>
            <div className="space-y-2" data-testid="provider-model-choices">
              {automaticSupported ? (
                <ModelOption
                  label="Automatic"
                  description="VedMoulya chooses the appropriate model"
                  selected={selectedModelId === undefined}
                  disabled={savingModel}
                  onSelect={() => {
                    void handleModelSelect(undefined);
                  }}
                />
              ) : null}
              {models.map((model) => (
                <ModelOption
                  key={model.id}
                  label={model.name}
                  {...(model.subtitle ? { description: model.subtitle } : {})}
                  selected={selectedModelId === model.id}
                  disabled={savingModel}
                  onSelect={() => {
                    void handleModelSelect(model.id);
                  }}
                />
              ))}
            </div>
          </fieldset>
        )}

        {models.length > 1 && !isPrimary ? (
          <p className="mt-3 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
            Choosing a specific model makes this AI your primary AI.
          </p>
        ) : null}
        {modelError ? (
          <p role="alert" className="mt-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            {modelError}
          </p>
        ) : null}
      </SectionCard>

      {/* ── 3. How VedMoulya can use this AI (read-only) ─────────────────── */}
      <SectionCard testId="config-section-capabilities" labelledBy="capabilities-heading">
        <SectionTitle id="capabilities-heading">How VedMoulya can use this AI</SectionTitle>
        {capabilities.length > 0 ? (
          <ul className="mt-3.5 space-y-2" data-testid="provider-capabilities">
            {capabilities.map((capability) => (
              <li
                key={capability}
                className="flex items-center gap-2 text-[13px] text-[#374151] dark:text-[#E2E8F0]"
              >
                <span className="text-emerald-600 dark:text-emerald-400" aria-hidden="true">
                  ✓
                </span>
                {capability}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
            Capabilities are detected automatically once VedMoulya connects to this AI.
          </p>
        )}
        <p className="mt-3 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
          Automatically detected — VedMoulya routes each task to the AI that fits it.
        </p>
      </SectionCard>

      {/* ── 4. Usage ────────────────────────────────────────────────────── */}
      <SectionCard testId="config-section-usage" labelledBy="usage-heading">
        <SectionTitle id="usage-heading">Usage</SectionTitle>
        <div className="mt-4 space-y-3">
          <div
            className="flex items-center justify-between gap-4"
            title={provider.switchDisabledReason}
          >
            {/* The visible label carries the accessible name (the design
                system Switch renders a button named by its associated
                label) — the AI name is included for screen readers. */}
            <label
              htmlFor="provider-enabled"
              className="text-[13px] text-[#374151] dark:text-[#E2E8F0]"
            >
              Use this AI
              <span className="sr-only"> — {identity.name}</span>
            </label>
            <Switch
              id="provider-enabled"
              checked={enabled}
              onCheckedChange={(checked) => {
                onToggle(provider.providerId, checked);
              }}
              disabled={enabled && Boolean(provider.switchDisabledReason)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="provider-primary"
              className="text-[13px] text-[#374151] dark:text-[#E2E8F0]"
            >
              Use as primary AI
              <span className="sr-only"> — {identity.name}</span>
            </label>
            <Switch
              id="provider-primary"
              checked={isPrimary}
              onCheckedChange={handlePrimaryToggle}
              disabled={!enabled || defaultPrimary}
            />
          </div>
          {/* The stored preference is optional: VedMoulya starts every account
              with Gemini as the primary AI, so this switch says so instead of
              silently doing nothing. */}
          {defaultPrimary ? (
            <p
              className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]"
              data-testid="provider-default-primary-note"
            >
              {identity.name} is VedMoulya&apos;s default primary AI. Choose another AI to change
              that.
            </p>
          ) : null}
        </div>

        <dl className="mt-4 space-y-1.5 border-t border-[#F1F5F9] dark:border-[#334155] pt-4 text-[12.5px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#64748B] dark:text-[#94A3B8]">Model routing</dt>
            <dd className="text-[#374151] dark:text-[#E2E8F0]">
              {selectedModelId
                ? (models.find((model) => model.id === selectedModelId)?.name ?? 'Selected model')
                : 'Automatic routing'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[#64748B] dark:text-[#94A3B8]">Fallback</dt>
            <dd className="text-[#374151] dark:text-[#E2E8F0]">Automatic</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
          VedMoulya chooses between your enabled AIs for every task — there is nothing to prioritise
          by hand.
        </p>
      </SectionCard>

      {/* ── 5. Advanced (collapsed by default) ──────────────────────────── */}
      <section
        aria-labelledby="provider-advanced-heading"
        className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] overflow-hidden"
      >
        <h2 id="provider-advanced-heading" className="sr-only">
          Advanced
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((prev) => !prev);
          }}
          aria-expanded={showAdvanced}
          aria-controls="provider-advanced-panel"
          data-testid="provider-advanced-toggle"
          className="flex w-full items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
        >
          <span className="inline-flex items-center gap-2 text-[15px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            <Settings2 className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
            Advanced
          </span>
          {showAdvanced ? (
            <ChevronDown
              className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="h-4 w-4 text-[#64748B] dark:text-[#94A3B8]"
              aria-hidden="true"
            />
          )}
        </button>
        {showAdvanced ? (
          <div
            id="provider-advanced-panel"
            className="px-5 sm:px-6 pb-5 space-y-4"
            data-testid="provider-advanced-panel"
          >
            {builtIn ? (
              <>
                <dl className="space-y-2 text-[12.5px]">
                  {[
                    { term: 'Endpoint', value: '✓ Managed automatically' },
                    { term: 'Protocol', value: 'Automatic' },
                    { term: 'Connection timeout', value: 'Automatic' },
                    { term: 'Retry policy', value: 'Automatic' },
                  ].map((row) => (
                    <div key={row.term} className="flex items-center justify-between gap-4">
                      <dt className="text-[#64748B] dark:text-[#94A3B8]">{row.term}</dt>
                      <dd
                        className={
                          row.value.startsWith('✓')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#374151] dark:text-[#E2E8F0]'
                        }
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                  VedMoulya configures and maintains this AI for you — there is nothing to fill in
                  here.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                  Custom AI brings its own endpoint and protocol. Register it in the provider
                  registry below.
                </p>
                <AddProviderPanel
                  embedded
                  userId={userId}
                  onProviderAdded={() => {
                    onChanged();
                  }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenDetails(provider.providerId);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3.5 text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] transition-colors"
            >
              Open provider details
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ── Model radio row ─────────────────────────────────────────────────────────

function ModelOption({
  label,
  description,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  description?: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
        selected
          ? 'border-[#2B5FD9] bg-[#EFF4FE] dark:bg-[#1E3A8A]/30'
          : 'border-[#E2E8F0] dark:border-[#334155] hover:border-[#2B5FD9]/40'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <input
        type="radio"
        name="model-choice"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 peer-focus-visible:outline-none ${
          // Unselected ring keeps ≥3:1 non-text contrast (WCAG 1.4.11).
          selected ? 'border-[#2B5FD9] bg-[#2B5FD9]' : 'border-[#64748B] dark:border-[#94A3B8]'
        }`}
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {label}
        </span>
        {description ? (
          <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
