// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers
// EPIC-012A — Premium Experience Refinement (Phases 1–6 / 17)
// PRIMARY VIEW: premium AI Providers overview — compact operational rows
// (provider → status → model → enable → Configure) with an inline model
// selector. All technical configuration lives in the dedicated per-provider
// Provider Configuration view (EPIC-012B), opened via the Configure action.
// SECONDARY: registry tabs (marketplace/benchmarks/model registry) are behind
// "Advanced" — never removed, just moved to progressive disclosure.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Loading,
  Switch,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@vedmoulya/ui';
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
  TrendingUp,
  Star,
  AlertCircle,
  Settings2,
  HelpCircle,
  CheckCircle2,
  Layers,
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
import { AddProviderPanel } from './AddProviderPanel.js';
import { OpenAIOrgUsagePanel } from './OpenAIOrgUsagePanel.js';
import { AIBalanceWidget } from './AIBalanceWidget.js';
import {
  UsageAvailabilityWidget,
  ReadinessLegend,
  type UsageWidgetRow,
} from './UsageAvailabilityWidget.js';
import {
  providerReadiness,
  type ProviderReadiness,
  type ReadinessKey,
} from './provider-readiness.js';

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
  custom: 'bg-[#F59E0B]/15 text-[#F59E0B]',
};

const FAMILY_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google (Gemini)',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
  mock: 'Mock (Test)',
  custom: 'Custom Provider',
};

// ── Readiness indicator ────────────────────────────────────────────────────
// ONE indicator per provider (red/orange/green), derived from REAL runtime
// state + user enable preference (see providerReadiness). Colour is never the
// only signal — a readable label always accompanies the dot. The three colours
// are explained once in the ReadinessLegend below the usage widget.

const READINESS_TONES: Record<ReadinessKey, { dot: string; text: string }> = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  orange: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  red: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
};

function ReadinessIndicator({
  readiness,
  className = '',
}: {
  readiness: ProviderReadiness;
  className?: string;
}): React.JSX.Element {
  const tone = READINESS_TONES[readiness.key];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] ${className}`}
      title={readiness.hint}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} aria-hidden="true" />
      <span className={`font-medium ${tone.text}`}>{readiness.label}</span>
    </span>
  );
}

// ── Usage formatting helpers ────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── "How it works?" helper ─────────────────────────────────────────────────
// Explains, in simple terms, that VedMoulya is an orchestration system that
// can use MANY AI providers: several can be enabled at once, each keeps its
// own independent configuration, and the orchestration fabric chooses the
// appropriate AI/model for each task.

const HOW_IT_WORKS_POINTS: Array<{ title: string; description: string }> = [
  {
    title: 'Many providers, one orchestration',
    description:
      'VedMoulya is not tied to a single AI model — it can draw on several AI providers at the same time.',
  },
  {
    title: 'Enable several providers',
    description:
      'More than one provider can be switched on. VedMoulya then chooses the best available AI for each task.',
  },
  {
    title: 'Pick a model per provider',
    description:
      'Each provider keeps its own selected model — or “Auto” to let VedMoulya route between the models you have enabled.',
  },
  {
    title: 'Independent configuration',
    description:
      'Authentication and settings are configured per provider and never overwrite another provider’s configuration.',
  },
  {
    title: 'Ready states',
    description:
      'Green means ready to use, orange means configured but turned off, red means it still needs configuration.',
  },
];

function HowItWorksButton(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3 py-1.5 text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
        aria-haspopup="dialog"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        How it works?
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>How AI Providers work</DialogTitle>
            <DialogDescription>
              VedMoulya is an orchestration system powered by many AIs — one intelligence.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {HOW_IT_WORKS_POINTS.map((point, idx) => (
              <li key={point.title} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex items-center justify-center rounded-md bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 p-1 shrink-0">
                  {idx === 0 ? (
                    <Layers className="h-3.5 w-3.5 text-[#2B5FD9] dark:text-[#6B8FEF]" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#2B5FD9] dark:text-[#6B8FEF]" />
                  )}
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                    {point.title}
                  </p>
                  <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">
                    {point.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              variant="primary"
              onClick={() => {
                setOpen(false);
              }}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
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
            Configure and manage your AI providers. Enable multiple providers and let VedMoulya
            choose the best AI for each task.
          </p>
        </div>
        <HowItWorksButton />
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

      {/* ── SPRINT-049: Add AI Provider (always available) ───────────── */}
      <ErrorBoundary section="add-provider">
        <AddProviderPanel
          onProviderAdded={() => {
            // Re-fetch providers to show the new custom provider.
            window.location.reload();
          }}
        />
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
  // MANDATORY-PROVIDER INVARIANT (PART 8) — the server refuses unsafe
  // enable/disable transitions; its reason is surfaced here verbatim.
  const [toggleError, setToggleError] = useState<string | null>(null);
  // When the experience data last arrived — drives the usage widget's honest
  // "Updated X min ago" (this view model carries no per-provider snapshot
  // timestamps, so the timestamp reflects when the view last refreshed).
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [refreshingUsage, setRefreshingUsage] = useState(false);

  useEffect(() => {
    if (data && !isLoading && !isError) {
      setFetchedAt(new Date());
    }
  }, [data, isLoading, isError]);

  const handleRefreshUsage = useCallback(async () => {
    setRefreshingUsage(true);
    try {
      await refetch();
      setFetchedAt(new Date());
    } finally {
      setRefreshingUsage(false);
    }
  }, [refetch]);

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
        setToggleError(null);
        // Re-fetch to update the view.
        void refetch();
      } catch (error) {
        // Server-enforced invariant (e.g. "VedMoulya requires at least one
        // active AI provider.") or a transient failure — show the reason.
        setToggleError(error instanceof Error ? error.message : 'Unable to update provider.');
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
        setToggleError(null);
        void refetch();
      } catch (error) {
        setToggleError(error instanceof Error ? error.message : 'Unable to update preferences.');
      }
    },
    [userId, setPrefsMutation, refetch],
  );

  // PART 8 — change Primary Brain. The server enforces that the new Primary
  // Brain must be enabled; an action on a disabled provider is refused.
  const handleSetPrimaryBrain = useCallback(
    async (providerId: string) => {
      try {
        await setPrefsMutation.mutateAsync({
          userId,
          preferredProviderId: providerId,
          preferredModelId: null,
        });
        setToggleError(null);
        void refetch();
      } catch (error) {
        setToggleError(error instanceof Error ? error.message : 'Unable to set Primary Brain.');
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

  const { providers, preferences } = data;

  // Readiness (single red/orange/green per provider) from REAL runtime state
  // + user preference — never fabricated. The usage widget summary counts
  // are computed from the same source.
  const readinessOf = (p: (typeof providers)[number]): ProviderReadiness =>
    providerReadiness(runtimeByFamily.get(p.family)?.status, p.enabled);
  const summary = {
    ready: providers.filter((p) => readinessOf(p).key === 'green').length,
    attention: providers.filter((p) => readinessOf(p).key === 'orange').length,
    notConfigured: providers.filter((p) => readinessOf(p).key === 'red').length,
  };
  // Widget rows carry the REAL registry health quota (0 = provider reports
  // none → the widget says "Usage unavailable", never an invented percent).
  const usageRows: UsageWidgetRow[] = providers.map((p) => {
    const runtime = runtimeByFamily.get(p.family);
    return {
      providerId: p.providerId,
      name: p.name,
      readiness: readinessOf(p),
      quotaUsedPercent: p.health.quotaUsedPercent,
      local: p.availability === 'LOCAL',
      mock: runtime?.status === 'MOCK',
    };
  });

  // AI Balance — ONE aggregated number. The denominator is the REAL
  // user-set monthly token budget (budgetConfigured checks the raw
  // preference, so the server-side 1M fallback default is never presented
  // as a real budget); the numerator is measured ledger usage. No provider
  // breakdown, no fabricated balances. "View all" opens the usage detail.
  const balance = {
    tokensUsed: data.usage.tokensUsed,
    tokenBudget: data.usage.tokenBudget,
    budgetConfigured: Boolean(preferences.budgets.monthlyTokenBudget),
  };

  return (
    <div className="space-y-4">
      {/* ── AI Balance (compact command center — one number only) ──────── */}
      <AIBalanceWidget balance={balance} onViewAll={onUsageClick} />

      {/* ── AI Usage & Availability (compact command center) ───────────── */}
      <UsageAvailabilityWidget
        rows={usageRows}
        summary={summary}
        updatedAt={fetchedAt}
        refreshing={refreshingUsage}
        onRefresh={() => {
          void handleRefreshUsage();
        }}
        onViewDetails={onUsageClick}
      />

      {/* ── Readiness legend — the ONE indicator per provider, explained ── */}
      <ReadinessLegend />

      {/* ── Server-enforced invariant reason (PART 8) ──────────────────── */}
      {toggleError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 dark:border-[#92400E] dark:bg-[#451A03]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309] dark:text-[#FBBF24]" />
          <p className="text-[13px] text-[#92400E] dark:text-[#FCD34D]">{toggleError}</p>
        </div>
      )}

      {/* ── Provider rows ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_200px_auto_auto_auto] gap-4 px-4 py-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Provider
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Status
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Model
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            Enable
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
            <span className="sr-only">Actions</span>
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

          // ONE readiness indicator per provider (section 15). A provider may
          // only reach GREEN when it is truly configured AND enabled — red
          // rows cannot be switched on from here (go Configure instead).
          const readiness = readinessOf(provider);
          const canToggle = readiness.key !== 'red';

          return (
            <div
              key={provider.providerId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors md:grid md:grid-cols-[minmax(0,1fr)_200px_auto_auto_auto] md:gap-4"
            >
              {/* Provider — clicking the name opens the dedicated per-provider
                  configuration view (EPIC-012B); Configure below does the same. */}
              <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
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
                    {/* PART 7 — Primary Brain indicator (user state, never a
                        global default). Assigned automatically to Google
                        Gemini for new accounts; changeable here. */}
                    {preferences.preferredProviderId === provider.providerId ? (
                      <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#B45309] dark:bg-[#422006] dark:text-[#FBBF24]">
                        <Star className="h-3 w-3" aria-hidden="true" />
                        Primary Brain
                      </span>
                    ) : provider.enabled && canToggle ? (
                      <button
                        type="button"
                        onClick={() => void handleSetPrimaryBrain(provider.providerId)}
                        disabled={updatingProvider === provider.providerId}
                        className="ml-1.5 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#2B5FD9] hover:bg-[#DBEAFE] dark:bg-[#1E3A8A]/30 dark:text-[#6B8FEF] transition-colors"
                        title="Set as Primary Brain"
                      >
                        Set as Primary
                      </button>
                    ) : null}
                  </div>
                </button>
              </div>

              {/* Status — single indicator with readable text */}
              <div className="flex items-center shrink-0">
                <ReadinessIndicator readiness={readiness} />
              </div>

              {/* Model selector (disabled until the provider is configured) */}
              <div className="flex items-center shrink-0">
                <ModelSelector
                  models={models}
                  selectedModelId={provider.selectedModel?.id ?? undefined}
                  onSelect={(modelId) => {
                    void handleModelSelect(provider.providerId, modelId);
                  }}
                  providerName={provider.name}
                  enabled={provider.enabled && canToggle}
                />
              </div>

              {/* Enable/Disable — server-enforced mandatory-provider invariant
                  reasons are shown as the tooltip; red (not configured / no
                  runtime) providers cannot be switched on from the overview. */}
              <div
                className="flex items-center shrink-0"
                title={provider.switchDisabledReason ?? (canToggle ? undefined : readiness.hint)}
              >
                <Switch
                  checked={provider.enabled && canToggle}
                  onCheckedChange={(checked) => {
                    void handleToggle(provider.providerId, checked);
                  }}
                  disabled={
                    updatingProvider === provider.providerId ||
                    !canToggle ||
                    Boolean(provider.switchDisabledReason)
                  }
                  aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.name}`}
                />
              </div>

              {/* Configure — opens the dedicated configuration experience */}
              <div className="ml-auto md:ml-0 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onProviderClick(provider.providerId);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-2.5 py-1.5 text-[12px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
                  aria-label={`Configure ${provider.name}`}
                >
                  <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Configure
                </button>
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

      {/* OpenAI ORGANIZATION usage — real per-model numbers from OpenAI for
          the platform's own key (see OpenAIOrgUsagePanel); shown before the
          measured per-user ledger so the two sources are never conflated. */}
      <OpenAIOrgUsagePanel userId={userId} />

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
