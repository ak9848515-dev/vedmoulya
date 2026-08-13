// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers
// EPIC-012A — Premium Experience Refinement (Phases 1–6 / 17)
// PRIMARY VIEW: premium AI Providers screen with aggregate usage, provider
// rows (provider → model → availability → ON/OFF), and inline model selector.
// SECONDARY: registry tabs (marketplace/benchmarks/model registry) are behind
// "Advanced" — never removed, just moved to progressive disclosure.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Loading, Switch, EmptyState } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  Cpu,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Server,
  Activity,
  CircleDollarSign,
  FlaskConical,
  Database,
  Wallet,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import {
  useProviderExperience,
  useProviderRuntimeStatus,
  useSetProviderEnabled,
  useSetProviderPreferences,
  useProviderUsageDetail,
} from '../../lib/api-client.js';
import dynamic from 'next/dynamic';
import { ModelSelector, type ModelOption } from './ModelSelector.js';
import { ProviderDetailView } from './ProviderDetailView.js';

// ── Lazy-loaded registry tabs (progressive disclosure) ───────────────────────
const BenchmarkDatasetsView = dynamic(
  () => import('./benchmark-view.js').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
);
const ModelRegistryView = dynamic(
  () => import('./model-registry-view.js').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
);

// ── Family colors ────────────────────────────────────────────────────────────

const FAMILY_COLORS: Record<string, string> = {
  openai: 'bg-[#10A37F]/15 text-[#10A37F]',
  anthropic: 'bg-[#D97757]/15 text-[#D97757]',
  google: 'bg-[#4285F4]/15 text-[#4285F4]',
  deepseek: 'bg-[#4D6BFE]/15 text-[#4D6BFE]',
  openrouter: 'bg-[#7C3AED]/15 text-[#7C3AED]',
  ollama: 'bg-[#64748B]/15 text-[#64748B]',
  mock: 'bg-[#94A3B8]/15 text-[#64748B]',
};

const FAMILY_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google (Gemini)',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
  mock: 'Mock (Test)',
};

// ── Availability indicator (NEVER depends on colour alone) ───────────────────

interface AvailabilityIndicatorProps {
  availability: 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'LOCAL' | 'UNKNOWN';
}

const AVAILABILITY_CONFIG: Record<
  AvailabilityIndicatorProps['availability'],
  { icon: string; label: string; dot: string; text: string }
> = {
  AVAILABLE: {
    icon: '●',
    label: 'Available',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  LIMITED: {
    icon: '●',
    label: 'Limited',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  UNAVAILABLE: {
    icon: '○',
    label: 'Unavailable',
    dot: 'bg-slate-300 dark:bg-slate-600',
    text: 'text-slate-400 dark:text-slate-500',
  },
  LOCAL: {
    icon: '◆',
    label: 'Local',
    dot: 'bg-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
  },
  UNKNOWN: {
    icon: '?',
    label: 'Unknown',
    dot: 'bg-slate-300 dark:bg-slate-600',
    text: 'text-slate-400 dark:text-slate-500',
  },
};

function AvailabilityIndicator({ availability }: AvailabilityIndicatorProps): React.JSX.Element {
  // The availability union covers every key of AVAILABILITY_CONFIG, so the
  // lookup is always defined (typed Record over the closed union).
  const cfg = AVAILABILITY_CONFIG[availability];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]" title={cfg.label}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

// ── Runtime truth badge (EPIC-019) ──────────────────────────────────────────
// "Availability" above is CATALOG availability. This badge is the RUNTIME
// truth from the same registry the config layer, production validator and
// registration use: CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME /
// MOCK / DISABLED / ERROR. A catalog-only family (UNSUPPORTED_RUNTIME) is
// never claimed executable — its enable switch is disabled below.

const RUNTIME_TRUTH_CONFIG: Record<string, { label: string; cls: string }> = {
  CONFIGURED: {
    label: 'Runtime: configured',
    cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  NOT_CONFIGURED: {
    label: 'Runtime: no key',
    cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  UNSUPPORTED_RUNTIME: {
    label: 'Catalog only — no runtime adapter',
    cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  },
  MOCK: {
    label: 'Deterministic mock',
    cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  DISABLED: {
    label: 'Runtime: disabled',
    cls: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
  },
  ERROR: {
    label: 'Runtime: invalid config',
    cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
};

function RuntimeTruthBadge({
  status,
  reason,
}: {
  status: string;
  reason: string;
}): React.JSX.Element | null {
  const cfg = RUNTIME_TRUTH_CONFIG[status];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center mt-0.5 max-w-full rounded-md border px-1.5 py-px text-[10px] font-medium ${cfg.cls}`}
      title={reason}
    >
      {cfg.label}
    </span>
  );
}

// ── Usage Indicator (Phase 17 — premium aggregate presentation) ─────────────

function UsageIndicator({
  tokensUsed,
  tokenBudget,
  costUsd,
  freePercent,
  aiCalls,
  onClick,
}: {
  tokensUsed: number;
  tokenBudget: number;
  costUsd: number;
  freePercent: number;
  aiCalls: number;
  onClick: () => void;
}): React.JSX.Element {
  const pct = Math.min(100, Math.round((tokensUsed / Math.max(1, tokenBudget)) * 100));
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]" />
          <span className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            AI Usage
          </span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-[#94A3B8] group-hover:text-[#2B5FD9] transition-colors" />
      </div>
      <div className="flex items-baseline gap-4 flex-wrap">
        <span className="text-[22px] font-bold font-heading text-[#111827] dark:text-[#F8FAFC] tabular-nums">
          {fmtTokens(tokensUsed)}
        </span>
        <span className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          / {fmtTokens(tokenBudget)} tokens
        </span>
        <span className="text-[15px] font-semibold text-[#374151] dark:text-[#E2E8F0] tabular-nums">
          ${costUsd.toFixed(2)}
        </span>
        <span className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
          {freePercent}% free
        </span>
        <span className="text-[11px] text-[#94A3B8]">{aiCalls} calls</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2B5FD9] to-[#7C3AED] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-[#94A3B8]">{pct}% of monthly budget</div>
    </button>
  );
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ProvidersPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [showUsage, setShowUsage] = useState(false);
  // EPIC-012B — clicking a provider opens its dedicated configuration view.
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  useEffect(() => {
    setActiveSection('providers');
    setBreadcrumbs([{ label: 'AI Providers', href: '/providers' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // EPIC-012C — "Configure Provider" deep link: the AI World bell/page
  // navigates here with ?provider=<family> so the existing provider
  // configuration view opens directly (no duplicated configuration logic).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('provider');
    if (provider) {
      setSelectedProviderId(provider);
    }
  }, []);

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading AI Providers..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
          <Cpu className="h-5 w-5 text-[#2B5FD9]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            AI Providers
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Configure, enable, and manage your AI providers
          </p>
        </div>
      </div>

      {/* ── Main content: experience view ───────────────────────────────── */}
      <ErrorBoundary section="ai-providers">
        {showUsage ? (
          <UsageDetailView
            userId={userId}
            onBack={() => {
              setShowUsage(false);
            }}
          />
        ) : selectedProviderId ? (
          <ProviderDetailView
            userId={userId}
            providerId={selectedProviderId}
            onBack={() => {
              setSelectedProviderId(null);
            }}
          />
        ) : (
          <ProviderExperienceView
            userId={userId}
            onUsageClick={() => {
              setShowUsage(true);
            }}
            onProviderClick={(providerId) => {
              setSelectedProviderId(providerId);
            }}
          />
        )}
      </ErrorBoundary>

      {/* ── Advanced: Registry tabs (progressive disclosure) ────────────── */}
      <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
        <button
          onClick={() => {
            setShowAdvanced(!showAdvanced);
          }}
          className="flex items-center gap-2 text-[13px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#E2E8F0] transition-colors"
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced — Provider Registry
        </button>
        {showAdvanced && (
          <div className="mt-4">
            <div className="flex gap-2 mb-4">
              {[
                { id: 'marketplace', label: 'Providers', icon: <Cpu className="h-4 w-4" /> },
                {
                  id: 'benchmarks',
                  label: 'Benchmarks',
                  icon: <FlaskConical className="h-4 w-4" />,
                },
                { id: 'models', label: 'Model Registry', icon: <Database className="h-4 w-4" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#2B5FD9] text-white'
                      : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'marketplace' && (
              <ErrorBoundary section="provider-marketplace">
                <ProviderMarketplace userId={userId} />
              </ErrorBoundary>
            )}
            {activeTab === 'benchmarks' && (
              <ErrorBoundary section="provider-benchmarks">
                <BenchmarkDatasetsView userId={userId} />
              </ErrorBoundary>
            )}
            {activeTab === 'models' && (
              <ErrorBoundary section="provider-model-registry">
                <ModelRegistryView userId={userId} />
              </ErrorBoundary>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Provider Experience View (Phase 4) ───────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ProviderExperienceView({
  userId,
  onUsageClick,
  onProviderClick,
}: {
  userId: string;
  onUsageClick: () => void;
  onProviderClick: (providerId: string) => void;
}): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useProviderExperience(userId);
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const setEnabledMutation = useSetProviderEnabled();
  const setPrefsMutation = useSetProviderPreferences();
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);

  // EPIC-019 — runtime truth per family (CONFIGURED / NOT_CONFIGURED /
  // UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR) from the same registry the
  // config layer, production validator and registration use.
  const runtimeByFamily = new Map(
    (runtimeStatus.data?.providers ?? []).map((p) => [p.family, p] as const),
  );

  const handleToggle = useCallback(
    async (providerId: string, enabled: boolean) => {
      setUpdatingProvider(providerId);
      try {
        await setEnabledMutation.mutateAsync({ userId, providerId, enabled });
        // Re-fetch to update the view.
        void refetch();
      } catch {
        // Error handled by mutation.
      } finally {
        setUpdatingProvider(null);
      }
    },
    [userId, setEnabledMutation, refetch],
  );

  const handleModelSelect = useCallback(
    async (providerId: string, modelId: string | undefined): Promise<void> => {
      try {
        await setPrefsMutation.mutateAsync({
          userId,
          preferredProviderId: modelId ? providerId : null,
          preferredModelId: modelId ?? null,
        });
        void refetch();
      } catch {
        // Error handled by mutation.
      }
    },
    [userId, setPrefsMutation, refetch],
  );

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading providers..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card variant="standard" padding="lg" className="text-center dark:bg-[#1E293B]">
        <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          Unable to load AI providers
        </h2>
        <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
          Please try again in a moment.
        </p>
      </Card>
    );
  }

  const { providers, usage } = data;

  return (
    <div className="space-y-4">
      {/* ── Usage indicator ────────────────────────────────────────────── */}
      <UsageIndicator
        tokensUsed={usage.tokensUsed}
        tokenBudget={usage.tokenBudget}
        costUsd={usage.costUsd}
        freePercent={usage.freePercent}
        aiCalls={usage.aiCalls}
        onClick={onUsageClick}
      />

      {/* ── Provider rows ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Provider
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Model
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Status
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Enable
          </span>
        </div>

        {providers.map((provider) => {
          const models: ModelOption[] = provider.models.map((m) => ({
            id: m.id,
            name: m.name,
            // Real per-model capabilities piped from the registry intelligence
            // layer (never hardcoded in the UI).
            capabilities: m.capabilities,
            status:
              provider.availability === 'LOCAL'
                ? ('local' as const)
                : provider.availability === 'LIMITED'
                  ? ('limited' as const)
                  : provider.availability === 'UNAVAILABLE'
                    ? ('offline' as const)
                    : ('available' as const),
            freeToUse: provider.freeToUse,
          }));

          const runtime = runtimeByFamily.get(provider.family);
          // A catalog-only family has no adapter — enabling it would claim a
          // runtime that cannot exist. The switch is disabled (EPIC-019 truth).
          const catalogOnly = runtime?.status === 'UNSUPPORTED_RUNTIME';

          return (
            <div
              key={provider.providerId}
              className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
            >
              {/* Provider info — clicking opens the dedicated configuration
                  view (EPIC-012B). The model selector + enable switch stay on
                  the main screen exactly as before. */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => {
                    onProviderClick(provider.providerId);
                  }}
                  className="flex items-center gap-3 min-w-0 group text-left"
                  aria-label={`Configure ${provider.name}`}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 ${FAMILY_COLORS[provider.family] ?? 'bg-[#F1F5F9] text-[#64748B]'}`}
                  >
                    <Cpu className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate block group-hover:text-[#2B5FD9] dark:group-hover:text-[#6B8FEF] transition-colors">
                      {provider.name}
                    </span>
                    <span className="text-[11px] text-[#94A3B8]">
                      {FAMILY_LABELS[provider.family] ?? provider.family}
                    </span>
                    {runtime && (
                      <RuntimeTruthBadge status={runtime.status} reason={runtime.reason} />
                    )}
                  </div>
                </button>
              </div>

              {/* Model selector */}
              <div className="flex items-center justify-end">
                <ModelSelector
                  models={models}
                  selectedModelId={provider.selectedModel?.id ?? undefined}
                  onSelect={(modelId) => {
                    void handleModelSelect(provider.providerId, modelId);
                  }}
                  providerName={provider.name}
                  enabled={provider.enabled}
                />
              </div>

              {/* Availability */}
              <div className="flex items-center justify-end">
                <AvailabilityIndicator availability={provider.availability} />
              </div>

              {/* Enable/Disable toggle — disabled for catalog-only families
                  (no runtime adapter exists; enabling would be a lie). */}
              <div
                className="flex items-center justify-end"
                title={
                  catalogOnly
                    ? 'Catalog only — no runtime adapter exists for this provider.'
                    : undefined
                }
              >
                <Switch
                  checked={provider.enabled && !catalogOnly}
                  onCheckedChange={(checked) => {
                    void handleToggle(provider.providerId, checked);
                  }}
                  disabled={updatingProvider === provider.providerId || catalogOnly}
                  aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {providers.length === 0 && (
        <EmptyState
          icon={<Cpu className="h-8 w-8" />}
          title="No providers configured"
          description="Add an AI provider to start using VedMoulya's AI capabilities."
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Usage & Economics Detail View (Phase 17) ─────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function UsageDetailView({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}): React.JSX.Element {
  const { data, isLoading } = useProviderUsageDetail(userId);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loading label="Loading usage details..." size="lg" />
      </div>
    );
  }

  const { totals, byProvider, byModel, executions } = data;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
      >
        ← AI Providers
      </button>

      <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[#2B5FD9]" />
        AI Usage & Economics
      </h2>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'AI Calls',
            value: String(totals.aiCalls),
            icon: <Activity className="h-4 w-4 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE]',
          },
          {
            label: 'Tokens Total',
            value: fmtTokens(totals.tokensTotal),
            icon: <Server className="h-4 w-4 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF]',
          },
          {
            label: 'Cost (USD)',
            value: `$${totals.costUsd.toFixed(4)}`,
            icon: <CircleDollarSign className="h-4 w-4 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB]',
          },
          {
            label: 'Cache Hits',
            value: String(totals.cacheHits),
            icon: <TrendingUp className="h-4 w-4 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4]',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl p-3 ${stat.bg} dark:bg-transparent dark:border dark:border-[#334155]`}
          >
            <div className="flex items-center gap-2 mb-1">
              {stat.icon}
              <span className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                {stat.label}
              </span>
            </div>
            <span className="text-[18px] font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* By Provider */}
      {byProvider.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0] mb-2">
            By Provider
          </h3>
          <div className="space-y-1.5">
            {byProvider.map((p) => (
              <div key={p.provider} className="flex items-center gap-3 text-[12px]">
                <span className="w-28 truncate font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {p.provider}
                </span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">{p.calls} calls</span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">
                  {fmtTokens(p.tokensTotal)} tokens
                </span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">${p.costUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By Model */}
      {byModel.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0] mb-2">
            By Model
          </h3>
          <div className="space-y-1.5">
            {byModel.map((m) => (
              <div
                key={`${m.providerId}-${m.modelId}`}
                className="flex items-center gap-3 text-[12px]"
              >
                <span className="w-24 truncate font-medium text-[#374151] dark:text-[#E2E8F0]">
                  {m.providerId}
                </span>
                <span className="w-32 truncate text-[#64748B] dark:text-[#94A3B8]">
                  {m.modelId}
                </span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">{m.calls} calls</span>
                <span className="text-[#64748B] dark:text-[#94A3B8]">${m.costUsd.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent executions */}
      {executions.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0] mb-2">
            Recent Executions
          </h3>
          <div className="space-y-1">
            {executions.slice(0, 10).map((ex) => (
              <div
                key={ex.traceId}
                className="flex items-center gap-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
              >
                <span className="w-40 truncate">{ex.name}</span>
                <span className="text-[#374151] dark:text-[#E2E8F0]">
                  {fmtTokens(ex.tokensTotal)}
                </span>
                <span>${ex.costUsd.toFixed(4)}</span>
                <span>{ex.aiCalls} calls</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {executions.length === 0 && byProvider.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No usage data yet"
          description="Usage data appears here after you run AI workflows."
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Provider Marketplace (Advanced tab — registry discovery) ─────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ProviderMarketplace({ userId: _userId }: { userId: string }): React.JSX.Element {
  // Dynamic import — React.lazy won't work in Next.js pages; use the
  // existing marketplace code from the benchmark-view pattern.
  // For now, show a link to the registry.
  return (
    <div className="text-center py-8">
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        The full provider registry, benchmarks, and model inventory are available in the advanced
        tabs above.
      </p>
    </div>
  );
}
