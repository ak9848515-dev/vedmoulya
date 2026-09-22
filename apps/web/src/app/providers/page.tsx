// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers
// AI PROVIDER UX SIMPLIFICATION — "Expose decisions. Hide infrastructure."
//
// PRIMARY VIEWS (progressive disclosure):
//   /providers              → AI Providers: VedMoulya's AI + Other AI, + Add AI
//   /providers?provider=…   → Configure AI (connection, model, usage, advanced)
//   usage detail            → measured usage & economics (from Advanced)
//   provider details        → the existing full registry-intelligence view
// ADVANCED (collapsed): usage & availability, plus the registry tabs
// (providers / benchmarks / model registry) — nothing removed, just disclosed.
//
// Everything technical (endpoint, protocol, capability routing, fallback,
// context, tools, orchestration) stays in the existing provider/orchestrator
// layers; this screen only ever requests connectProvider / discoverModels /
// setActiveProvider through the existing gateway contracts.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Loading,
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
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Layers,
  Plus,
} from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { AIContextBar } from '../ai/_components/AIContextBar.js';
import {
  useProviderExperience,
  useProviderRuntimeStatus,
  useSetProviderEnabled,
  useSetProviderPreferences,
  useProviderUsageDetail,
} from '../../lib/api-client.js';
import dynamic from 'next/dynamic';
import { ProvidersOverview } from './ProvidersOverview.js';
import { SimpleProviderConfig } from './SimpleProviderConfig.js';
import { OpenAIOrgUsagePanel } from './OpenAIOrgUsagePanel.js';
import { AIBalanceWidget } from './AIBalanceWidget.js';
import {
  UsageAvailabilityWidget,
  ReadinessLegend,
  type UsageWidgetRow,
} from './UsageAvailabilityWidget.js';
import { providerReadiness, type ProviderReadiness } from './provider-readiness.js';
import { configureExperienceFor, providerIdentity } from './provider-ux.js';

// ── Lazy-loaded views (progressive disclosure + a lean first load) ──────────
// The provider list is what opens first. The configuration experience, the
// registry-intelligence detail and the registry tabs load on demand — the same
// pattern the registry tabs already used, so the initial /providers bundle
// carries only the list and its cards.
const BenchmarkDatasetsView = dynamic(
  () => import('./benchmark-view.js').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
);
const ModelRegistryView = dynamic(
  () => import('./model-registry-view.js').then((m) => ({ default: m.default })),
  { ssr: false, loading: () => null },
);
const ProviderConfigScreen = dynamic(
  () => import('./ProviderConfigScreen.js').then((m) => ({ default: m.ProviderConfigScreen })),
  { ssr: false, loading: () => <CenteredLoading label="Loading this AI..." /> },
);
const ProviderDetailView = dynamic(
  () => import('./ProviderDetailView.js').then((m) => ({ default: m.ProviderDetailView })),
  { ssr: false, loading: () => <CenteredLoading label="Loading provider intelligence..." /> },
);

// ── Shared loading shell ────────────────────────────────────────────────────

function CenteredLoading({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-[40vh]" role="status" aria-live="polite">
      <Loading label={label} size="lg" />
    </div>
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
      'Each provider keeps its own selected model — or “Automatic” to let VedMoulya route between the models you have enabled.',
  },
  {
    title: 'Independent configuration',
    description:
      'Authentication and settings are configured per provider and never overwrite another provider’s configuration.',
  },
  {
    title: 'VedMoulya handles the rest',
    description:
      'Connection details, capability routing, fallback and context are managed for you — there is no infrastructure to configure.',
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3 py-1.5 text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
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

// ── View routing (list / configure / details / usage) ────────────────────────

type ProvidersView =
  | { kind: 'list' }
  | { kind: 'configure'; providerId: string }
  | { kind: 'details'; providerId: string }
  | { kind: 'usage' };

export default function ProvidersPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const [view, setView] = useState<ProvidersView>({ kind: 'list' });
  const [addAIOpen, setAddAIOpen] = useState(false);

  // Deep link from AI World / capability marketplace: ?provider=<family>
  // opens the existing configuration experience directly (no duplicated
  // configuration logic). The Configure screen also recognises the OAuth
  // return marker (?oauth=google) it sets itself.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('provider');
    if (provider) {
      setView({ kind: 'configure', providerId: provider });
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
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
      {/* UX-01/UX-02/UX-06 — AI → Providers context + the rest of your AI */}
      <AIContextBar
        sectionId="providers"
        pageLabel="Providers"
        pathname="/providers"
        description="Providers are part of your AI. Connect the AI services VedMoulya is allowed to use."
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            AI Providers
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            Your AI ecosystem — the AI services VedMoulya can use.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setView({ kind: 'list' });
            setAddAIOpen(true);
          }}
          data-testid="add-ai-button"
          className="shrink-0 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2B5FD9] px-4 text-[13px] font-medium text-white hover:bg-[#1E4AA8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2 sm:w-auto transition-colors"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add AI
        </button>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <ErrorBoundary section="ai-providers">
        {view.kind === 'usage' ? (
          <UsageDetailView
            userId={userId}
            onBack={() => {
              setView({ kind: 'list' });
            }}
          />
        ) : view.kind === 'details' ? (
          <ProviderDetailView
            userId={userId}
            providerId={view.providerId}
            onBack={() => {
              setView({ kind: 'list' });
            }}
          />
        ) : view.kind === 'configure' ? (
          <ProviderConfigLoader
            userId={userId}
            providerId={view.providerId}
            onBack={() => {
              setView({ kind: 'list' });
            }}
            onOpenDetails={(providerId) => {
              setView({ kind: 'details', providerId });
            }}
          />
        ) : (
          <ProviderExperienceView
            userId={userId}
            addAIOpen={addAIOpen}
            onAddAIOpenChange={setAddAIOpen}
            onConfigure={(providerId) => {
              setView({ kind: 'configure', providerId });
            }}
            onOpenDetails={(providerId) => {
              setView({ kind: 'details', providerId });
            }}
            onUsageClick={() => {
              setView({ kind: 'usage' });
            }}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Configure AI loader ──────────────────────────────────────────────────────
// Resolves the provider row + preferences from the EXISTING experience view
// model so the configuration screen renders real registry data (never a
// second provider source).
// ═════════════════════════════════════════════════════════════════════════════

function ProviderConfigLoader({
  userId,
  providerId,
  onBack,
  onOpenDetails,
}: {
  userId: string;
  providerId: string;
  onBack: () => void;
  onOpenDetails: (providerId: string) => void;
}): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useProviderExperience(userId);
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const setEnabledMutation = useSetProviderEnabled();
  const setPrefsMutation = useSetProviderPreferences();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      void setEnabledMutation
        .mutateAsync({ userId, providerId: id, enabled })
        .then(() => {
          setActionError(null);
          void refetch();
        })
        .catch((error: unknown) => {
          // Server-enforced domain invariant reason (e.g. "VedMoulya requires
          // at least one active AI provider.") — surfaced verbatim.
          setActionError(error instanceof Error ? error.message : 'Unable to update this AI.');
        });
    },
    [userId, setEnabledMutation, refetch],
  );

  const handleSetPrimary = useCallback(
    (id: string) => {
      void setPrefsMutation
        .mutateAsync({
          userId,
          preferredProviderId: id,
          preferredModelId: null,
        })
        .then(() => {
          setActionError(null);
          void refetch();
        })
        .catch((error: unknown) => {
          setActionError(error instanceof Error ? error.message : 'Unable to set the primary AI.');
        });
    },
    [userId, setPrefsMutation, refetch],
  );

  if (isLoading || !data) {
    return <CenteredLoading label="Loading this AI..." />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Cpu className="h-8 w-8" />}
        title="Unable to load this AI"
        description="Please try again in a moment."
      />
    );
  }

  const provider = data.providers.find((entry) => entry.providerId === providerId);
  if (!provider) {
    return (
      <EmptyState
        icon={<Cpu className="h-8 w-8" />}
        title="This AI isn't in your provider registry"
        description="It may have been removed. Go back and choose another AI."
      />
    );
  }

  // PROVIDER-UX (Ollama) — a LOCAL provider needs its own flow: auto-detect the
  // local server, list the models it really has, choose one, Save & Enable. The
  // cloud-oriented ProviderConfigScreen cannot do that. Local presets therefore
  // open the existing SimpleProviderConfig (FINAL-02 Simple mode) — the same
  // component the provider detail view already uses — with the server address
  // kept behind "Change address". No new configuration logic is introduced.
  if (configureExperienceFor(provider.family) === 'simple-local') {
    return (
      <div className="space-y-4 animate-slide-up">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
        >
          ← AI Providers
        </button>
        <SimpleProviderConfig
          userId={userId}
          presetId={provider.family}
          variant="panel"
          onConfigured={() => {
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 dark:border-[#92400E] dark:bg-[#451A03]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309] dark:text-[#FBBF24]" />
          <p className="text-[13px] text-[#92400E] dark:text-[#FCD34D]">{actionError}</p>
        </div>
      ) : null}
      <ProviderConfigScreen
        userId={userId}
        provider={provider}
        preferences={data.preferences}
        runtime={(runtimeStatus.data?.providers ?? []).find((p) => p.family === provider.family)}
        onBack={onBack}
        onOpenDetails={onOpenDetails}
        onToggle={handleToggle}
        onSetPrimary={handleSetPrimary}
        onChanged={() => {
          void refetch();
        }}
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Providers list + Advanced disclosure ─────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ProviderExperienceView({
  userId,
  addAIOpen,
  onAddAIOpenChange,
  onConfigure,
  onOpenDetails,
  onUsageClick,
}: {
  userId: string;
  addAIOpen: boolean;
  onAddAIOpenChange: (open: boolean) => void;
  onConfigure: (providerId: string) => void;
  onOpenDetails: (providerId: string) => void;
  onUsageClick: () => void;
}): React.JSX.Element {
  const { data, isLoading, isError, refetch } = useProviderExperience(userId);
  const runtimeStatus = useProviderRuntimeStatus(userId);
  const setEnabledMutation = useSetProviderEnabled();
  const setPrefsMutation = useSetProviderPreferences();
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);
  // MANDATORY-PROVIDER INVARIANT (PART 8) — the server refuses unsafe
  // enable/disable transitions; its reason is surfaced here verbatim.
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('marketplace');
  // When the experience data last arrived — drives the usage widget's honest
  // "Updated X min ago".
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
        void refetch();
      } catch (error) {
        // Server-enforced invariant or a transient failure — show the reason.
        setToggleError(error instanceof Error ? error.message : 'Unable to update provider.');
      } finally {
        setUpdatingProvider(null);
      }
    },
    [userId, setEnabledMutation, refetch],
  );

  const handleSetPrimaryBrain = useCallback(
    async (providerId: string) => {
      setUpdatingProvider(providerId);
      try {
        await setPrefsMutation.mutateAsync({
          userId,
          preferredProviderId: providerId,
          preferredModelId: null,
        });
        setToggleError(null);
        void refetch();
      } catch (error) {
        setToggleError(error instanceof Error ? error.message : 'Unable to set the primary AI.');
      } finally {
        setUpdatingProvider(null);
      }
    },
    [userId, setPrefsMutation, refetch],
  );

  if (isLoading || !data) {
    return <CenteredLoading label="Loading AI providers..." />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Cpu className="h-8 w-8" />}
        title="Unable to load AI providers"
        description="Please try again in a moment."
      />
    );
  }

  const { providers, preferences } = data;

  // Readiness (single red/orange/green per provider) from REAL runtime state
  // + user preference — never fabricated. Used by the advanced usage widgets.
  const readinessOf = (p: (typeof providers)[number]): ProviderReadiness =>
    providerReadiness(runtimeByFamily.get(p.family)?.status, p.enabled);
  const summary = {
    ready: providers.filter((p) => readinessOf(p).key === 'green').length,
    attention: providers.filter((p) => readinessOf(p).key === 'orange').length,
    notConfigured: providers.filter((p) => readinessOf(p).key === 'red').length,
  };
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

  // AI Balance — ONE aggregated number over measured ledger usage.
  const balance = {
    tokensUsed: data.usage.tokensUsed,
    tokenBudget: data.usage.tokenBudget,
    budgetConfigured: Boolean(preferences.budgets.monthlyTokenBudget),
  };

  return (
    <div className="space-y-6">
      {/* ── Server-enforced invariant reason (PART 8) ──────────────────── */}
      {toggleError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 dark:border-[#92400E] dark:bg-[#451A03]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309] dark:text-[#FBBF24]" />
          <p className="text-[13px] text-[#92400E] dark:text-[#FCD34D]">{toggleError}</p>
        </div>
      ) : null}

      {/* ── Screen 1: VedMoulya's AI + Other AI ───────────────────────── */}
      <ProvidersOverview
        userId={userId}
        providers={providers}
        runtimeByFamily={runtimeByFamily}
        preferences={preferences}
        updatingProviderId={updatingProvider}
        onConfigure={onConfigure}
        onOpenDetails={onOpenDetails}
        onToggle={(providerId, enabled) => {
          void handleToggle(providerId, enabled);
        }}
        onSetPrimary={(providerId) => {
          void handleSetPrimaryBrain(providerId);
        }}
        onRefresh={() => {
          void refetch();
        }}
        addAIOpen={addAIOpen}
        onAddAIOpenChange={onAddAIOpenChange}
      />

      {/* ── Advanced: usage & availability + provider registry ─────────── */}
      <div className="border-t border-[#E2E8F0] dark:border-[#334155] pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowAdvanced(!showAdvanced);
            }}
            aria-expanded={showAdvanced}
            className="flex items-center gap-2 text-[13px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] rounded transition-colors"
          >
            {showAdvanced ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            Advanced
          </button>
          <HowItWorksButton />
        </div>
        {showAdvanced ? (
          <div className="mt-4 space-y-4">
            {/* Usage & availability (measured usage + readiness legend) */}
            <AIBalanceWidget balance={balance} onViewAll={onUsageClick} />
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
            <ReadinessLegend />

            {/* Provider registry tabs (providers / benchmarks / models) */}
            <div className="flex flex-wrap gap-2 pt-2">
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
                  type="button"
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
        ) : null}
      </div>
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
    return <CenteredLoading label="Loading usage details..." />;
  }

  const { totals, byProvider, byModel, executions } = data;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Back */}
      <button
        type="button"
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
                  {providerIdentity(p.provider).name}
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
  // The full registry inventory is available through the advanced tabs.
  return (
    <div className="text-center py-8">
      <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
        The full provider registry, benchmarks, and model inventory are available in the advanced
        tabs above.
      </p>
    </div>
  );
}
