// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Configuration & Intelligence
// EPIC-012B — AI Provider Intelligence & Model Discovery
// A dedicated configuration experience (separate view, never inline in the
// provider row). First view: provider, connection status, selected model,
// models, usage, health, capabilities. Advanced sections (pricing & limits,
// token economics, routing, diagnostics) are behind progressive disclosure.
// The intelligence section shows last-verified + a safe refresh action.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useCallback } from 'react';
import { Loading, Switch, EmptyState } from '@vedmoulya/ui';
import {
  Cpu,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Brain,
  Gauge,
  Database,
  CircleDollarSign,
  ShieldCheck,
  Activity,
} from 'lucide-react';
import {
  useProvider,
  useProviderIntelligenceStatus,
  useRefreshProviderIntelligence,
  useProviderPreferences,
  useSetProviderEnabled,
  useSetProviderPreferences,
} from '../../lib/api-client.js';
import { ModelSelector, type ModelOption } from './ModelSelector.js';

// ── Lifecycle status presentation (never colour-only) ────────────────────────

const LIFECYCLE_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  active: {
    label: 'Active',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  preview: { label: 'Preview', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  deprecated: {
    label: 'Deprecated',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  unavailable: {
    label: 'Unavailable',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  unknown: {
    label: 'Unknown',
    dot: 'bg-slate-300 dark:bg-slate-600',
    text: 'text-slate-400 dark:text-slate-500',
  },
};

const VERIFICATION_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; description: string; tone: string }
> = {
  FULLY_VERIFIED: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    label: 'Fully verified',
    description: 'Model intelligence confirmed against the provider source.',
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
  PARTIALLY_VERIFIED: {
    icon: <ShieldCheck className="h-4 w-4 text-[#2B5FD9]" />,
    label: 'Partially verified',
    description: 'Derived from registry-declared metadata; unknown fields stay unknown.',
    tone: 'text-[#2B5FD9] dark:text-[#6B8FEF]',
  },
  UNVERIFIED: {
    icon: <HelpCircle className="h-4 w-4 text-slate-400" />,
    label: 'Unverified',
    description: 'No verified model intelligence is available yet.',
    tone: 'text-slate-500 dark:text-slate-400',
  },
};

/** Safe lookup — never undefined (noUncheckedIndexedAccess). */
function verificationConfig(state: string): {
  icon: React.ReactNode;
  label: string;
  description: string;
  tone: string;
} {
  return (
    VERIFICATION_CONFIG[state] ?? {
      icon: <HelpCircle className="h-4 w-4 text-slate-400" />,
      label: 'Unknown',
      description: 'No verification state is available.',
      tone: 'text-slate-500 dark:text-slate-400',
    }
  );
}

/** Safe lookup — never undefined (noUncheckedIndexedAccess). */
function lifecycleConfig(status: string): {
  label: string;
  dot: string;
  text: string;
} {
  return (
    LIFECYCLE_CONFIG[status] ?? {
      label: 'Unknown',
      dot: 'bg-slate-300 dark:bg-slate-600',
      text: 'text-slate-400 dark:text-slate-500',
    }
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function fmtTokens(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Progressive disclosure section wrapper ───────────────────────────────────

function DisclosureSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] overflow-hidden">
      <button
        onClick={() => {
          setOpen(!open);
        }}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────

export function ProviderDetailView({
  providerId,
  userId,
  onBack,
}: {
  providerId: string;
  userId: string;
  onBack: () => void;
}): React.JSX.Element {
  const {
    data: provider,
    isLoading: providerLoading,
    isError: providerError,
  } = useProvider(userId, providerId);
  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useProviderIntelligenceStatus(userId, providerId);
  const { data: preferences } = useProviderPreferences(userId);
  const refreshMutation = useRefreshProviderIntelligence();
  const setEnabledMutation = useSetProviderEnabled();
  const setPrefsMutation = useSetProviderPreferences();
  const [refreshing, setRefreshing] = useState(false);

  // Enabled by default — a provider is ON until the user explicitly disables
  // it (matches the main providers screen's experience view).
  const enabled = !(preferences?.disabledProviderIds.includes(providerId) ?? false);
  const selectedModelId =
    preferences?.preferredProviderId === providerId
      ? (preferences.preferredModelId ?? undefined)
      : undefined;

  const handleToggle = useCallback(
    async (next: boolean) => {
      try {
        await setEnabledMutation.mutateAsync({ userId, providerId, enabled: next });
      } catch {
        // Error handled by mutation.
      }
    },
    [userId, providerId, setEnabledMutation],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMutation.mutateAsync({ userId, id: providerId });
      void refetchStatus();
    } catch {
      // Error handled by mutation.
    } finally {
      setRefreshing(false);
    }
  }, [userId, providerId, refreshMutation, refetchStatus]);

  const handleModelSelect = useCallback(
    async (modelId: string | undefined): Promise<void> => {
      try {
        await setPrefsMutation.mutateAsync({
          userId,
          preferredProviderId: modelId ? providerId : null,
          preferredModelId: modelId ?? null,
        });
      } catch {
        // Error handled by mutation.
      }
    },
    [userId, providerId, setPrefsMutation],
  );

  if (providerError || statusError) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          AI Providers
        </button>
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-6 text-center">
          <p className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load provider intelligence
          </p>
          <p className="mt-1 text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
          <button
            onClick={() => {
              void refetchStatus();
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:bg-[#DFEAFD] dark:hover:bg-[#1E3A8A]/70 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (providerLoading || statusLoading || !provider || !status) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading provider intelligence..." size="lg" />
      </div>
    );
  }

  const profile = status.record.profile;
  const staleness = status.staleness;
  const verification = verificationConfig(status.record.verificationState);
  const models: ModelOption[] = profile.models.map((m) => ({
    id: m.modelId,
    name: m.name,
    capabilities: m.capabilities.value ?? [],
    status:
      m.lifecycleStatus.value === 'deprecated'
        ? ('deprecated' as const)
        : m.lifecycleStatus.value === 'unavailable'
          ? ('offline' as const)
          : m.lifecycleStatus.value === 'preview'
            ? ('limited' as const)
            : ('available' as const),
  }));

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        AI Providers
      </button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <Cpu className="h-5 w-5 text-[#2B5FD9]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] md:text-[26px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC] truncate">
              {provider.name}
            </h1>
            <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              {provider.family} · {provider.models.length} models ·{' '}
              {enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${verification.tone}`}
          >
            {verification.icon}
            {verification.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {enabled ? 'On' : 'Off'}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => {
                void handleToggle(checked);
              }}
              aria-label={`${enabled ? 'Disable' : 'Enable'} ${provider.name}`}
            />
          </div>
        </div>
      </div>

      {/* Connection + selected model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Connection status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${provider.health.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC] capitalize">
              {provider.health.status}
            </span>
            <span className="text-[12px] text-[#94A3B8]">
              · {Math.round(provider.health.healthScore * 100)}% health
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Selected model
          </span>
          <div className="mt-2">
            <ModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelect={(modelId) => {
                void handleModelSelect(modelId);
              }}
              providerName={provider.name}
              enabled={enabled}
            />
          </div>
        </div>
      </div>

      {/* Intelligence verification + last verified + refresh */}
      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="h-4 w-4 text-[#2B5FD9] shrink-0" />
            <span className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
              Model intelligence
            </span>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#64748B] dark:text-[#94A3B8] md:ml-auto flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5" />
              Verified {timeAgo(staleness.lastVerifiedAt)}
              {staleness.isStale && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Update available
                </span>
              )}
            </span>
            <button
              onClick={() => {
                void handleRefresh();
              }}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:bg-[#DFEAFD] dark:hover:bg-[#1E3A8A]/70 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Updating...' : 'Update intelligence'}
            </button>
          </div>
        </div>
        <p className={`mt-2 text-[12px] ${verification.tone}`}>{verification.description}</p>
        {!status.record.discovery.discovered && (
          <p className="mt-1 text-[11px] text-[#94A3B8]">{status.record.discovery.message}</p>
        )}
        {status.record.delta.addedModels.length > 0 && (
          <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            {status.record.delta.addedModels.length} new model(s) discovered on the last refresh.
          </p>
        )}
        {status.record.delta.removedModels.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
            {status.record.delta.removedModels.length} model(s) no longer listed — marked
            unavailable, your selection is preserved.
          </p>
        )}
      </div>

      {/* Models */}
      <DisclosureSection
        title="Models & capabilities"
        icon={<Database className="h-4 w-4 text-[#2B5FD9]" />}
        defaultOpen
      >
        <div className="space-y-2">
          {profile.models.map((m) => {
            const lifecycle = lifecycleConfig(m.lifecycleStatus.value ?? 'unknown');
            return (
              <div
                key={m.modelId}
                className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 px-3 py-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                      {m.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${lifecycle.dot}`} />
                      <span className={lifecycle.text}>{lifecycle.label}</span>
                    </span>
                  </div>
                  {(m.capabilities.value?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(m.capabilities.value ?? []).slice(0, 5).map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 rounded bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[10px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-[11px] text-[#64748B] dark:text-[#94A3B8] md:shrink-0">
                  <span title="Context window">Context {fmtTokens(m.contextWindow.value)}</span>
                  <span title="Max output">Out {fmtTokens(m.maxOutputTokens.value)}</span>
                  <span title="Input price per 1M tokens">
                    ${m.priceInputPer1M.value?.toFixed(2) ?? '—'}/1M in
                  </span>
                  <span title="Output price per 1M tokens">
                    ${m.priceOutputPer1M.value?.toFixed(2) ?? '—'}/1M out
                  </span>
                </div>
              </div>
            );
          })}
          {profile.models.length === 0 && (
            <EmptyState
              icon={<Database className="h-8 w-8" />}
              title="No models discovered"
              description="Run “Update intelligence” after connecting the provider."
            />
          )}
        </div>
      </DisclosureSection>

      {/* Usage & quota */}
      <DisclosureSection
        title="Usage & quota"
        icon={<Activity className="h-4 w-4 text-[#2B5FD9]" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div>
            <span className="text-[#94A3B8]">Quota used</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              {provider.health.quotaUsedPercent}%
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Requests / min</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              {provider.requestsPerMinute}
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Tokens / min</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              {fmtTokens(provider.tokensPerMinute)}
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Rate limit remaining</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              {provider.health.rateLimitRemaining}
            </p>
          </div>
        </div>
      </DisclosureSection>

      {/* Pricing & limits */}
      <DisclosureSection
        title="Pricing & limits"
        icon={<CircleDollarSign className="h-4 w-4 text-[#2B5FD9]" />}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
          <div>
            <span className="text-[#94A3B8]">Input / 1M tokens</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              ${provider.inputPerMillionTokens.toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Output / 1M tokens</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              ${provider.outputPerMillionTokens.toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">P95 latency</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">{provider.p95Ms} ms</p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Availability</span>
            <p className="font-medium text-[#374151] dark:text-[#E2E8F0]">
              {(provider.availability * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </DisclosureSection>

      {/* Diagnostics (provenance — only when requested) */}
      <DisclosureSection
        title="Advanced diagnostics"
        icon={<Activity className="h-4 w-4 text-[#94A3B8]" />}
      >
        <div className="space-y-3 text-[12px]">
          <div>
            <span className="text-[#94A3B8]">Derived from</span>
            <p className="text-[#374151] dark:text-[#E2E8F0]">{profile.derivedFrom}</p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Coverage</span>
            <p className="text-[#374151] dark:text-[#E2E8F0]">
              {profile.coverage.knownPropertyCount} known · {profile.coverage.unknownPropertyCount}{' '}
              unknown across {profile.coverage.modelCount} models
            </p>
          </div>
          <div>
            <span className="text-[#94A3B8]">Refresh policy</span>
            <p className="text-[#374151] dark:text-[#E2E8F0]">
              Stale after {Math.round(status.record.refreshPolicy.maxAgeMs / 3_600_000)} hours
            </p>
          </div>
        </div>
      </DisclosureSection>
    </div>
  );
}
