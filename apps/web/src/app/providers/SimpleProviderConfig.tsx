// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Simple Provider Configuration (FINAL-02)
//
// Preset-driven Simple mode for KNOWN providers: the user sees ONLY the
// fields actually necessary (credential for cloud providers, server URL for
// Ollama) plus a model dropdown populated from REAL provider discovery.
// Endpoint URL / protocol / deployment type / adapter internals are never
// shown here — Advanced mode (the existing provider detail sections and the
// Add-Provider panel) keeps every capability.
//
// FLOW (Phase 5): credential → Test Connection (server-side probe) → real
// model discovery → choose model (or preset default) → Save & Enable.
//
// SECURITY (PROVIDER-01): the API key lives only in this form's state and is
// sent once to the gateway, which verifies it against the REAL provider. On a
// successful verification the gateway (never this component) persists it
// ENCRYPTED at rest, owner-scoped, and it can never be read back by a browser;
// it is never logged and never rendered outside the password input. Without a
// deployment encryption key nothing is stored at all — there is no plaintext
// fallback. Save & Enable persists ONLY owner-scoped, non-secret configuration
// (enabled flag + preferred model) through the provider preferences service.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  KeyRound,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { providerPreset, isSimpleProviderPreset, type ProviderPreset } from '@vedmoulya/shared';
import {
  useConnectProvider,
  useSetProviderEnabled,
  useSetProviderPreferences,
  useProviderRuntimeStatus,
  type ConnectProviderFamily,
  type ProviderConnectionResultDTO,
  type DiscoveredProviderModelDTO,
} from '../../lib/api-client.js';

// BUGFIX (Ollama honesty) — browser-side discovery for local runtimes.
import {
  OLLAMA_START_HINT,
  OLLAMA_ENDPOINT_CANDIDATES,
  discoverOllama,
  testOllamaGeneration,
  type OllamaDiscoveryResult,
} from './ollama-discovery.js';

export interface SimpleProviderConfigProps {
  userId: string;
  /** Provider family id (google/openai/anthropic/deepseek/ollama). */
  presetId: string;
  /** Called after Save & Enable succeeds. Receives the saved model name. */
  onConfigured?: (modelName?: string) => void;
  /** Offered when Simple mode cannot configure this provider (custom). */
  onAdvanced?: () => void;
  /** Dialog embedding uses compact spacing. */
  variant?: 'panel' | 'dialog';
}

type SaveStage = 'idle' | 'saving' | 'done';

export function SimpleProviderConfig({
  userId,
  presetId,
  onConfigured,
  onAdvanced,
  variant = 'panel',
}: SimpleProviderConfigProps): React.JSX.Element {
  const preset: ProviderPreset = providerPreset(presetId);
  const connect = useConnectProvider();
  const setEnabled = useSetProviderEnabled();
  const setPrefs = useSetProviderPreferences();
  const runtimeStatus = useProviderRuntimeStatus(userId);

  const runtimeByFamily = new Map(
    (runtimeStatus.data?.providers ?? []).map((p) => [p.family, p] as const),
  );
  const serverManagedAvailable =
    preset.presetId === 'google' && runtimeByFamily.get('google')?.status === 'CONFIGURED';
  // Local providers (Ollama) need no credential and their models can be read
  // straight from the running server — so the panel can detect them on open
  // and the user only has to scroll the model list and pick one.
  const isLocalProvider = preset.credentialType === 'none_local';
  const autoDetected = useRef(false);

  const [useOwnKey, setUseOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [serverUrl, setServerUrl] = useState(preset.defaultEndpoint);
  const [showServerUrl, setShowServerUrl] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProviderConnectionResultDTO | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(preset.defaultModelId);
  const [manualModel, setManualModel] = useState('');
  const [saveStage, setSaveStage] = useState<SaveStage>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── BUGFIX (Ollama honesty) — BROWSER-side local discovery state ────────
  // The gateway probe cannot see the user's machine when VedMoulya is deployed
  // remotely, so a failed server probe is NOT evidence about the user's Ollama.
  // The browser (the only actor on the same machine) performs the real
  // discovery, and its classified result drives every message below.
  const [localDiscovery, setLocalDiscovery] = useState<OllamaDiscoveryResult | null>(null);
  const [localTesting, setLocalTesting] = useState(false);

  const pad = variant === 'dialog' ? 'gap-3' : 'gap-4';

  const discovered: DiscoveredProviderModelDTO[] = useMemo(
    () => (result?.connected ? (result.models ?? []) : []),
    [result],
  );
  const discoveryAvailable = preset.modelDiscovery !== 'none';

  const handleTest = useCallback(async () => {
    setTesting(true);
    setRequestError(null);
    setResult(null);
    setSaveStage('idle');
    setSaveError(null);
    try {
      const outcome: ProviderConnectionResultDTO = await connect.mutateAsync({
        userId,
        family: preset.presetId as ConnectProviderFamily,
        ...(preset.presetId === 'google' && serverManagedAvailable && !useOwnKey
          ? {}
          : { apiKey: apiKey || undefined }),
        ...(preset.endpointUserConfigurable ? { endpointUrl: serverUrl } : {}),
      });
      setResult(outcome);
      if (outcome.connected) {
        // Preselect the preset default when the provider really offers it;
        // otherwise the first discovered model — never an invented id.
        const ids = (outcome.models ?? []).map((m: DiscoveredProviderModelDTO) => m.id);
        setSelectedModel(
          ids.includes(preset.defaultModelId) ? preset.defaultModelId : (ids[0] ?? ''),
        );
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, [connect, userId, preset, apiKey, serverUrl, serverManagedAvailable, useOwnKey]);

  /**
   * BUGFIX (Ollama honesty) — the REAL local discovery, run in the browser.
   *
   * It replaces "any failed request ⇒ Ollama isn't installed" with measured
   * states: not-reachable, no-models, models-found, browser-blocked. The gateway
   * probe still runs afterwards when it makes sense, because persistence and the
   * runtime credential store stay server-side.
   */
  const runLocalDiscovery = useCallback(async () => {
    setLocalTesting(true);
    setLocalDiscovery(null);
    try {
      const discovery = await discoverOllama({ endpoint: serverUrl });
      setLocalDiscovery(discovery);

      if (discovery.state === 'MODELS_FOUND') {
        // Preselect a REAL id from the list Ollama just returned — never a
        // hard-coded one. The preset default wins only when it really exists.
        const ids = discovery.models.map((m) => m.id);
        setSelectedModel(
          ids.includes(preset.defaultModelId) ? preset.defaultModelId : (ids[0] ?? ''),
        );

        // A real generation test is required before anything is called
        // connected: /api/tags only proves the CATALOG was readable.
        const chosen = ids.includes(preset.defaultModelId) ? preset.defaultModelId : (ids[0] ?? '');
        const generation = await testOllamaGeneration(discovery.endpoint, chosen);
        if (generation.state === 'CONNECTED') {
          // Only now is the provider declared usable, and only through the
          // existing gateway pipeline (which persists owner-scoped config).
          const outcome = await connect.mutateAsync({
            userId,
            family: preset.presetId as ConnectProviderFamily,
            endpointUrl: discovery.endpoint,
          });
          setResult(outcome);
        } else {
          setLocalDiscovery({
            ...discovery,
            error: generation.error,
            message: generation.message,
          });
        }
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Local discovery failed');
    } finally {
      setLocalTesting(false);
    }
  }, [serverUrl, connect, userId, preset]);

  // Local providers: detect the available models as soon as the panel opens so
  // the user never has to press "Test Connection" first — they just choose from
  // the list. Cloud providers keep the explicit step (a key must be supplied).
  //
  // BUGFIX (Ollama honesty) — detection is the BROWSER-side discovery, because a
  // failed server-side probe says nothing about the user's own machine.
  useEffect(() => {
    if (!isLocalProvider || autoDetected.current) return;
    autoDetected.current = true;
    void runLocalDiscovery();
  }, [isLocalProvider, runLocalDiscovery]);

  // If the local server cannot be reached (or answers with an error), surface
  // the address field so the user can correct it and scan again.
  useEffect(() => {
    if (isLocalProvider && (requestError !== null || (result !== null && !result.connected))) {
      setShowServerUrl(true);
    }
  }, [isLocalProvider, requestError, result]);

  const canSave = Boolean(result?.connected);

  const handleSaveAndEnable = useCallback(async () => {
    if (!result?.connected) return;
    setSaveStage('saving');
    setSaveError(null);
    const modelId = discoveryAvailable ? selectedModel : manualModel.trim();
    try {
      // Owner-scoped, NON-SECRET configuration only: enable the provider for
      // routing and record the chosen model. The credential was already
      // verified and sealed server-side by the connect call — this writes no
      // secret material and never sends one back to the browser.
      await setEnabled.mutateAsync({ userId, providerId: preset.presetId, enabled: true });
      await setPrefs.mutateAsync({
        userId,
        preferredProviderId: preset.presetId,
        preferredModelId: modelId || null,
      });
      setSaveStage('done');
      const model = (result.models ?? []).find((m) => m.id === modelId);
      onConfigured?.(model?.name ?? modelId);
    } catch (error) {
      setSaveStage('idle');
      setSaveError(error instanceof Error ? error.message : 'Unable to save the provider.');
    }
  }, [
    result,
    discoveryAvailable,
    selectedModel,
    manualModel,
    setEnabled,
    setPrefs,
    userId,
    preset.presetId,
    onConfigured,
  ]);

  if (!isSimpleProviderPreset(presetId) || !preset.simpleModeSupported) {
    return (
      <div
        className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 flex flex-col gap-3"
        data-testid="simple-provider-advanced-required"
      >
        <p className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {preset.displayName} needs advanced configuration
        </p>
        <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
          Custom and OpenAI-compatible providers use their own endpoint URL and protocol, so they
          are configured in Advanced mode where every field is available.
        </p>
        {onAdvanced ? (
          <button
            type="button"
            onClick={onAdvanced}
            className="self-start inline-flex h-9 items-center rounded-[12px] bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] transition-colors"
          >
            Open Advanced setup
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 flex flex-col ${pad}`}
      data-testid="simple-provider-config"
    >
      {/* Provider identity */}
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
        <p className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {preset.displayName}
        </p>
        <span className="text-[11px] text-[#94A3B8]">{preset.category}</span>
      </div>

      {/* Credential — ONLY the field the user actually needs. */}
      {preset.credentialType !== 'none_local' ? (
        serverManagedAvailable && !useOwnKey ? (
          <div className="rounded-lg bg-[#F0FDF4] dark:bg-[#0F291D] border border-emerald-200 dark:border-emerald-900 p-3">
            <p className="text-[12.5px] font-medium text-emerald-700 dark:text-emerald-400">
              Using this server&apos;s configured Gemini credential
            </p>
            <p className="mt-0.5 text-[11.5px] text-emerald-600/80 dark:text-emerald-500/80">
              No key needed from you — VedMoulya verifies and connects directly.
            </p>
          </div>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]">
              {preset.credentialLabel}
            </span>
            <span className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                }}
                placeholder={
                  preset.presetId === 'google'
                    ? 'Paste your Google AI Studio key'
                    : `Paste your ${preset.displayName} key`
                }
                autoComplete="off"
                data-testid="simple-provider-key"
                className="w-full h-10 rounded-[12px] border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-3 pr-10 text-[13px] text-[#111827] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2B5FD9]"
              />
              <button
                type="button"
                onClick={() => {
                  setShowKey(!showKey);
                }}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                className="absolute right-2 p-1 text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#E2E8F0]"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              {preset.credentialHelp}
              {serverManagedAvailable ? ' Or use the server’s configured Gemini credential.' : ''}
            </span>
          </label>
        )
      ) : (
        <div className="flex flex-col gap-1.5" data-testid="simple-provider-local-server">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]">
              Local server
            </span>
            <button
              type="button"
              onClick={() => {
                setShowServerUrl((prev) => !prev);
              }}
              data-testid="simple-provider-server-toggle"
              className="text-[11.5px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] rounded"
            >
              {showServerUrl ? 'Done' : 'Change address'}
            </button>
          </div>
          {showServerUrl ? (
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
              }}
              onKeyDown={(e) => {
                // Changing the address must RE-RUN discovery, so an entered
                // endpoint is validated by a real probe rather than assumed.
                if (e.key === 'Enter' && isLocalProvider) {
                  e.preventDefault();
                  void runLocalDiscovery();
                }
              }}
              placeholder="http://localhost:11434"
              data-testid="simple-provider-server-url"
              className="w-full h-10 rounded-[12px] border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-3 text-[13px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2B5FD9]"
            />
          ) : (
            <p
              data-testid="simple-provider-server-current"
              className="text-[12.5px] text-[#374151] dark:text-[#E2E8F0]"
            >
              {serverUrl}
            </p>
          )}
          <span className="text-[11px] text-[#94A3B8]">{preset.credentialHelp}</span>
        </div>
      )}

      {preset.presetId === 'google' && serverManagedAvailable && !useOwnKey ? (
        <button
          type="button"
          onClick={() => {
            setUseOwnKey(true);
          }}
          data-testid="simple-provider-use-own-key"
          className="self-start text-[11.5px] text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          Use my own Gemini key instead
        </button>
      ) : null}

      {/* Model — populated from REAL provider discovery (never invented ids). */}
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0]">Model</span>
        {discoveryAvailable && discovered.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
            }}
            data-testid="simple-provider-model"
            className="w-full h-10 rounded-[12px] border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-3 text-[13px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2B5FD9]"
          >
            {discovered.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name === m.id ? m.name : `${m.name} (${m.id})`}
              </option>
            ))}
          </select>
        ) : discoveryAvailable ? (
          <div
            className="flex items-center gap-2 h-10 rounded-[12px] border border-dashed border-[#E2E8F0] dark:border-[#334155] px-3 text-[12.5px] text-[#94A3B8]"
            data-testid="simple-provider-model-pending"
          >
            {testing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Discovering models…
              </>
            ) : (
              <>Test the connection to discover available models</>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={manualModel}
            onChange={(e) => {
              setManualModel(e.target.value);
            }}
            placeholder="Enter model ID"
            data-testid="simple-provider-model-manual"
            className="w-full h-10 rounded-[12px] border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] px-3 text-[13px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2B5FD9]"
          />
        )}
        {discoveryAvailable && discovered.length === 0 && !testing ? (
          <span className="text-[11px] text-[#94A3B8]">
            {isLocalProvider
              ? 'Start your Ollama server and the models it has pulled appear here automatically.'
              : 'This provider exposes its model list over the API — the dropdown fills in automatically after a successful connection test.'}
          </span>
        ) : null}
      </label>

      {/* ── BUGFIX (Ollama honesty): the REAL local discovery state ─────────
          Progressive and measured — never a blanket "Ollama isn't running". */}
      {isLocalProvider && (localTesting || localDiscovery !== null) ? (
        <div
          role="status"
          data-testid="simple-provider-local-discovery"
          className={`rounded-lg border p-3 ${
            localDiscovery?.state === 'MODELS_FOUND'
              ? 'bg-[#F0FDF4] dark:bg-[#0F291D] border-emerald-200 dark:border-emerald-900'
              : 'bg-[#FFFBEB] dark:bg-[#291704] border-amber-200 dark:border-amber-900'
          }`}
        >
          {localTesting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#2B5FD9]" aria-hidden="true" />
              <p className="text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                Checking for Ollama…
              </p>
            </div>
          ) : localDiscovery !== null ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                {localDiscovery.state === 'MODELS_FOUND' ? (
                  <CheckCircle2
                    className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <AlertTriangle
                    className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-[#374151] dark:text-[#E2E8F0]">
                    {localDiscovery.message}
                  </p>
                  {localDiscovery.state === 'MODELS_FOUND' ? (
                    <p
                      className="mt-0.5 text-[11.5px] text-[#64748B] dark:text-[#94A3B8]"
                      data-testid="simple-provider-local-found"
                    >
                      Running · {localDiscovery.models.length} model
                      {localDiscovery.models.length === 1 ? '' : 's'} found
                      {localDiscovery.endpoint === '' ? '' : ` on ${localDiscovery.endpoint}`}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* The honest next action per classified state. */}
              {localDiscovery.error === 'OLLAMA_NOT_REACHABLE' ? (
                <p className="text-[11.5px] text-amber-700/90 dark:text-amber-400/90">
                  {OLLAMA_START_HINT} You can also check the address below — Ollama may be running
                  on a different one.
                </p>
              ) : null}
              {localDiscovery.error === 'OLLAMA_NO_MODELS' ? (
                <p className="text-[11.5px] text-amber-700/90 dark:text-amber-400/90">
                  Ollama is running. Install a model first — for example{' '}
                  <code className="font-mono">ollama pull llama3.2</code> — then scan again.
                </p>
              ) : null}
              {localDiscovery.error === 'OLLAMA_CORS_OR_BROWSER_BLOCKED' ? (
                <p className="text-[11.5px] text-amber-700/90 dark:text-amber-400/90">
                  Ollama is running, but this browser is not allowed to reach it. Add this app’s
                  address to Ollama’s <code className="font-mono">OLLAMA_ORIGINS</code> setting,
                  restart Ollama, then try again.
                </p>
              ) : null}
              {localDiscovery.error === 'OLLAMA_INVALID_RESPONSE' ? (
                <p className="text-[11.5px] text-amber-700/90 dark:text-amber-400/90">
                  Something answered that address, but it was not an Ollama service. Check the
                  address and try again.
                </p>
              ) : null}
              {localDiscovery.error === 'OLLAMA_MODEL_UNAVAILABLE' ||
              localDiscovery.error === 'OLLAMA_GENERATION_FAILED' ? (
                <p className="text-[11.5px] text-amber-700/90 dark:text-amber-400/90">
                  Choose a different model and press Scan again.
                </p>
              ) : null}

              {/* Candidate addresses are shown as guidance, never applied silently. */}
              {localDiscovery.error === 'OLLAMA_NOT_REACHABLE' ? (
                <p className="text-[11px] text-[#94A3B8]">
                  Tried: {OLLAMA_ENDPOINT_CANDIDATES.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Connection result — actionable, secret-free. */}
      {result ? (
        <div
          role="status"
          data-testid="simple-provider-result"
          className={`rounded-lg border p-3 ${
            result.connected
              ? 'bg-[#F0FDF4] dark:bg-[#0F291D] border-emerald-200 dark:border-emerald-900'
              : 'bg-[#FEF2F2] dark:bg-[#2A1215] border-rose-200 dark:border-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.connected ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            )}
            <p
              className={`text-[12.5px] font-medium ${
                result.connected
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {result.message}
            </p>
          </div>
          {result.connected && typeof result.latencyMs === 'number' ? (
            <p className="mt-1 text-[11.5px] text-emerald-600/80 dark:text-emerald-500/80">
              {result.latencyMs} ms
            </p>
          ) : null}
        </div>
      ) : null}

      {requestError ? (
        <div className="rounded-lg bg-[#FEF2F2] dark:bg-[#2A1215] border border-rose-200 dark:border-rose-900 p-3 text-[12.5px] text-rose-700 dark:text-rose-400">
          {requestError}
        </div>
      ) : null}

      {/* Honest runtime note — execution truth is never fabricated. */}
      {result?.connected && result.runtimeNote ? (
        <div className="flex items-start gap-2 rounded-lg bg-[#FFFBEB] dark:bg-[#291704] border border-amber-200 dark:border-amber-900 p-3">
          {result.runtimeConfigured ? (
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="text-[11.5px] leading-relaxed text-amber-700 dark:text-amber-400">
            {result.runtimeNote}
          </p>
        </div>
      ) : null}
      {preset.runtimeNote ? (
        <p className="text-[11.5px] text-[#94A3B8]">{preset.runtimeNote}</p>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => {
            void (isLocalProvider ? runLocalDiscovery() : handleTest());
          }}
          disabled={testing || localTesting}
          data-testid="simple-provider-test"
          className="inline-flex h-10 items-center gap-2 rounded-[14px] border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors disabled:opacity-50"
        >
          {testing || localTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {isLocalProvider ? 'Scan again' : 'Test Connection'}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleSaveAndEnable();
          }}
          disabled={!canSave || saveStage === 'saving'}
          data-testid="simple-provider-save"
          className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
        >
          {saveStage === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Save &amp; Enable
        </button>
      </div>
      {saveError ? (
        <p className="text-[12px] text-rose-600 dark:text-rose-400" role="alert">
          {saveError}
        </p>
      ) : null}

      <p className="text-[11px] text-[#94A3B8]">
        Your key is verified against the provider and is never shown again or written to logs.
        VedMoulya keeps your provider choice and selected model in your account.
      </p>
    </div>
  );
}
