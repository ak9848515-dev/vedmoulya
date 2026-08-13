// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Context Explorer
// EPIC-004 / EI-003 — Enterprise Context Intelligence Engine
// Explore the Context Registry: what context exists, where it came from,
// how valuable it is, how many tokens it costs, and how to build the
// minimum useful context — without executing any AI.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Badge,
  Loading,
  TextField,
  Select,
  EmptyState,
  Tabs as TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  Search,
  Layers,
  Sparkles,
  Gauge,
  FileText,
  Brain,
  Filter,
  Shrink,
  Package,
  Target,
  Clock,
  Database,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Zap,
  FolderTree,
  Hash,
} from 'lucide-react';
import {
  useContextSummary,
  useContextSearch,
  useContextRank,
  useContextFilter,
  useContextCompress,
  useContextAssemble,
  useContextDiscover,
} from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import type {
  ContextItemDTO,
  ContextRegistrySummaryDTO,
  ContextScoreDTO,
  EnterpriseContextPackageDTO,
  CompressionStrategy,
} from '@vedmoulya/context';
import type { CapabilityType } from '@vedmoulya/ai';

// ── Label maps ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  conversation_memory: 'Conversation Memory',
  enterprise_memory: 'Enterprise Memory',
  knowledge_base: 'Knowledge Base',
  business_rules: 'Business Rules',
  client_data: 'Client Data',
  project_data: 'Project Data',
  capability_metadata: 'Capability Metadata',
  documents: 'Documents',
  prompt_templates: 'Prompt Templates',
  historical_success: 'Historical Success',
  benchmark_knowledge: 'Benchmark Knowledge',
};

const SOURCE_COLORS: Record<string, string> = {
  conversation_memory: 'bg-[#EFF4FE] text-[#2B5FD9] dark:bg-[#1E3A8A]/40',
  enterprise_memory: 'bg-[#F5F3FF] text-[#7C3AED] dark:bg-[#4C1D95]/40',
  knowledge_base: 'bg-[#F0FDF4] text-[#22C55E] dark:bg-[#14532D]/40',
  business_rules: 'bg-[#FFFBEB] text-[#F59E0B] dark:bg-[#78350F]/40',
  client_data: 'bg-[#FEF2F2] text-[#EF4444] dark:bg-[#450A0A]/40',
  project_data: 'bg-[#F0F9FF] text-[#0EA5E9] dark:bg-[#0C4A6E]/40',
  capability_metadata: 'bg-[#FDF4FF] text-[#D946EF] dark:bg-[#701A75]/40',
  documents: 'bg-[#ECFEFF] text-[#06B6D4] dark:bg-[#164E63]/40',
  prompt_templates: 'bg-[#FFF7ED] text-[#EA580C] dark:bg-[#7C2D12]/40',
  historical_success: 'bg-[#FAF5FF] text-[#8B5CF6] dark:bg-[#3B0764]/40',
  benchmark_knowledge: 'bg-[#F8FAFC] text-[#475569] dark:bg-[#1E293B]/40',
};

const CATEGORY_LABELS: Record<string, string> = {
  user_profile: 'User Profile',
  conversation: 'Conversation',
  memory: 'Memory',
  knowledge: 'Knowledge',
  business: 'Business',
  client: 'Client',
  project: 'Project',
  capability: 'Capability',
  document: 'Document',
  prompt: 'Prompt',
  strategy: 'Strategy',
  brand: 'Brand',
  market: 'Market',
  system: 'System',
};

const PRIORITY_BADGE: Record<
  string,
  { variant: 'danger' | 'warning' | 'default' | 'info' | 'success' | 'archived'; label: string }
> = {
  critical: { variant: 'danger', label: 'Critical' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'default', label: 'Medium' },
  low: { variant: 'info', label: 'Low' },
  background: { variant: 'archived', label: 'Background' },
};

const CAPABILITY_LABELS: Record<string, string> = {
  reasoning: 'Reasoning',
  coding: 'Coding',
  vision: 'Vision',
  embeddings: 'Embeddings',
  summarization: 'Summarization',
  classification: 'Classification',
  translation: 'Translation',
  speech: 'Speech',
  image_understanding: 'Image Understanding',
  general_conversation: 'General Chat',
  content_generation: 'Content Generation',
};

const STRATEGY_LABELS: Record<string, string> = {
  extractive: 'Extractive',
  abstractive: 'Abstractive',
  summary: 'Summary',
  top_k: 'Top-K',
  threshold: 'Threshold',
  hybrid: 'Hybrid',
};

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ContextPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();
  const [activeTab, setActiveTab] = useState('registry');

  useEffect(() => {
    setActiveSection('context');
    setBreadcrumbs([{ label: 'Context Intelligence', href: '/context' }, { label: 'Explore' }]);
  }, [setActiveSection, setBreadcrumbs]);

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Context Intelligence..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[26px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              Context Intelligence
            </h1>
            <Badge variant="ai" size="sm">
              EI-003
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
            Before ANY AI request, VedMoulya automatically determines WHAT information, HOW MUCH,
            WHICH, and IN WHAT ORDER to send. This explorer surfaces the intelligence layer — no
            execution decisions are made here.
          </p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <TabsRoot value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="registry">
            <Database className="h-4 w-4 mr-1.5" /> Context Registry
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <Brain className="h-4 w-4 mr-1.5" /> Intelligence Pipeline
          </TabsTrigger>
          <TabsTrigger value="compression">
            <Shrink className="h-4 w-4 mr-1.5" /> Compression Lab
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry">
          <ErrorBoundary section="context-registry">
            <ContextRegistryView userId={userId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="pipeline">
          <ErrorBoundary section="context-pipeline">
            <PipelineView userId={userId} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="compression">
          <ErrorBoundary section="context-compression">
            <CompressionView userId={userId} />
          </ErrorBoundary>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── TAB 1: Context Registry ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ContextRegistryView({ userId }: { userId: string }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const { data: summary, isLoading: summaryLoading } = useContextSummary(userId);
  const {
    data: searchData,
    isLoading,
    isError,
  } = useContextSearch(userId, {
    ...(source !== 'all' ? { sources: [source] as ContextItemDTO['source'][] } : {}),
    ...(priority !== 'all' ? { priorities: [priority] as ContextItemDTO['priority'][] } : {}),
  });

  if (isLoading || !searchData || summaryLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Loading Context Registry..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the context registry
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
        </Card>
      </div>
    );
  }

  const { items } = searchData;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) =>
        `${i.content} ${i.tags.join(' ')} ${i.business.join(' ')} ${i.source} ${i.category}`
          .toLowerCase()
          .includes(q),
      )
    : items;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Context Items',
            value: String(summary.total),
            icon: <Layers className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Estimated Tokens',
            value: formatContext(summary.totalTokens),
            icon: <Hash className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Sources',
            value: String(Object.entries(summary.countBySource).filter(([, v]) => v > 0).length),
            icon: <FolderTree className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
          },
          {
            label: 'Categories',
            value: String(Object.entries(summary.countByCategory).filter(([, v]) => v > 0).length),
            icon: <BarChart3 className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            variant="standard"
            padding="md"
            className="dark:bg-[#1E293B] dark:border-[#334155]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
                  {stat.label}
                </p>
                <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Search + Filters ───────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <TextField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search context content, tags, business modules…"
              aria-label="Search context"
              leftIcon={<Search className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:w-auto">
            <Select
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
              }}
              aria-label="Filter by source"
              options={[
                { value: 'all', label: 'All Sources' },
                ...Object.keys(summary.countBySource)
                  .filter(
                    (s) =>
                      summary.countBySource[s as keyof ContextRegistrySummaryDTO['countBySource']] >
                      0,
                  )
                  .sort()
                  .map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s })),
              ]}
            />
            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
              }}
              aria-label="Filter by priority"
              options={[
                { value: 'all', label: 'All Priorities' },
                ...Object.keys(summary.countByPriority)
                  .filter(
                    (p) =>
                      summary.countByPriority[
                        p as keyof ContextRegistrySummaryDTO['countByPriority']
                      ] > 0,
                  )
                  .map((p) => ({ value: p, label: PRIORITY_BADGE[p]?.label ?? p })),
              ]}
            />
          </div>
        </div>
      </Card>

      {/* ── Results count ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Showing{' '}
          <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {filtered.length}
          </span>{' '}
          of {searchData.total} context items
        </p>
        <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> Intelligence only — no AI execution
        </Badge>
      </div>

      {/* ── Context Cards ──────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-8 w-8" />}
          title="No context items found"
          description="Try adjusting your search or clearing the filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <ContextItemCard key={item.contextId} item={item} />
          ))}
        </div>
      )}

      {/* ── Source breakdown ───────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-[#2B5FD9]" /> Registry Composition
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              By Source
            </p>
            <div className="space-y-1.5">
              {Object.entries(summary.countBySource)
                .filter(([, v]) => v > 0)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([src, count]) => (
                  <div key={src} className="flex items-center gap-2 text-[12px]">
                    <span className="w-44 truncate text-[#64748B] dark:text-[#94A3B8]">
                      {SOURCE_LABELS[src] ?? src}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]"
                        style={{
                          width: `${String((count / maxCount(Object.values(summary.countBySource))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
              By Priority
            </p>
            <div className="space-y-1.5">
              {Object.entries(summary.countByPriority)
                .filter(([, v]) => v > 0)
                .map(([p, count]) => (
                  <div key={p} className="flex items-center gap-2 text-[12px]">
                    <span className="w-44 truncate text-[#64748B] dark:text-[#94A3B8]">
                      {PRIORITY_BADGE[p]?.label ?? p}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#7C3AED] dark:bg-[#A78BFA]"
                        style={{
                          width: `${String((count / maxCount(Object.values(summary.countByPriority))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── TAB 2: Intelligence Pipeline ────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function PipelineView({ userId }: { userId: string }): React.JSX.Element {
  const [capability, setCapability] = useState<CapabilityType>('content_generation');
  const [business, setBusiness] = useState('platform');
  const [goal, setGoal] = useState('Generate a client status report');
  const [prompt, setPrompt] = useState(
    'Write a concise, professional status report using the provided context. Highlight progress, risks, and next steps.',
  );

  const { data: rankData, isLoading: rankLoading } = useContextRank(userId, {
    capability,
    businessContext: business ? [business] : undefined,
    maxResults: 8,
  });
  const { data: filterData, isLoading: filterLoading } = useContextFilter(userId, {
    sources: ['knowledge_base', 'conversation_memory', 'business_rules'],
  });
  const { data: discoverData, isLoading: discoverLoading } = useContextDiscover(userId, {
    capability,
    businessContext: business ? [business] : undefined,
  });
  const {
    data: assembleData,
    isLoading: assembleLoading,
    refetch: assembleRefetch,
  } = useContextAssemble(userId, {
    goal,
    capability,
    prompt,
    businessContext: business ? [business] : undefined,
    targetTokens: 6000,
  });

  if (rankLoading || filterLoading || discoverLoading || assembleLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Running Context Intelligence Pipeline..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Request Capability
            </label>
            <Select
              value={capability}
              onChange={(e) => {
                setCapability(e.target.value as CapabilityType);
              }}
              aria-label="Request capability"
              options={Object.entries(CAPABILITY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Business Context
            </label>
            <TextField
              value={business}
              onChange={(e) => {
                setBusiness(e.target.value);
              }}
              placeholder="e.g. platform, content-agency"
              aria-label="Business context"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Assembly Goal
            </label>
            <TextField
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
              }}
              placeholder="Describe the goal"
              aria-label="Assembly goal"
            />
          </div>
        </div>
        <div className="mt-3">
          <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
            Prompt Template
          </label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
            }}
            rows={2}
            className="w-full rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] px-3 py-2 text-[13px] text-[#111827] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2B5FD9]/40 resize-y"
            aria-label="Prompt template"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Badge variant="ai" size="sm" className="flex items-center gap-1.5">
            <Brain className="h-3 w-3" /> Ranking → Filtering → Assembly
          </Badge>
          <button
            onClick={() => {
              void assembleRefetch();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
          >
            <Zap className="h-3.5 w-3.5" /> Re-run Assembly
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* ── Ranking panel ───────────────────────────────────────────── */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#2B5FD9]" /> Context Ranking
            <span className="text-[11px] font-normal text-[#94A3B8]">
              top {rankData?.ranked.length ?? 0} for {CAPABILITY_LABELS[capability] ?? capability}
            </span>
          </h3>
          <div className="space-y-2">
            {rankData?.ranked.map((item, idx) => {
              const score = rankData.scores[item.contextId];
              return (
                <RankedItemRow key={item.contextId} item={item} score={score} rank={idx + 1} />
              );
            })}
          </div>
        </Card>

        {/* ── Discovery panel ─────────────────────────────────────────── */}
        <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
            <Search className="h-4 w-4 text-[#7C3AED]" /> Context Discovery
            <span className="text-[11px] font-normal text-[#94A3B8]">
              {discoverData?.total ?? 0} items
            </span>
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {discoverData?.items.map((item) => {
              const score = discoverData.scores[item.contextId];
              return (
                <div
                  key={item.contextId}
                  className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant={PRIORITY_BADGE[item.priority]?.variant ?? 'default'}
                        size="sm"
                      >
                        {PRIORITY_BADGE[item.priority]?.label ?? item.priority}
                      </Badge>
                      <span className="text-[11px] text-[#94A3B8]">{item.estimatedTokens} tok</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                    {item.content}
                  </p>
                  {score && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#22C55E]"
                          style={{
                            width: `${String(Math.round(score.finalScore * 100))}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                        {Math.round(score.finalScore * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Filtering summary ─────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#F59E0B]" /> Filtering Summary
          <span className="text-[11px] font-normal text-[#94A3B8]">
            sources: knowledge_base, conversation_memory, business_rules · min confidence 0.7
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Retained',
              value: String(filterData?.retained.length ?? 0),
              color: 'text-[#22C55E]',
            },
            {
              label: 'Removed',
              value: String(filterData?.removed.length ?? 0),
              color: 'text-[#EF4444]',
            },
            {
              label: 'Retained Tokens',
              value: formatContext(
                filterData?.retained.reduce((s, i) => s + i.estimatedTokens, 0) ?? 0,
              ),
              color: 'text-[#2B5FD9]',
            },
            {
              label: 'Duplicate Removed',
              value: String(
                filterData?.removed.filter((r) => r.reason.includes('Duplicate')).length ?? 0,
              ),
              color: 'text-[#7C3AED]',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
            >
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">
                {stat.label}
              </p>
              <p className={`text-[18px] font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Assembled package ─────────────────────────────────────────── */}
      {assembleData && <AssembledPackageView pkg={assembleData} />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── TAB 3: Compression Lab ──────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function CompressionView({ userId }: { userId: string }): React.JSX.Element {
  const [targetTokens, setTargetTokens] = useState(6000);
  const [strategy, setStrategy] = useState<CompressionStrategy>('extractive');
  const [preserveCritical, setPreserveCritical] = useState(true);

  const { data, isLoading, isError, refetch } = useContextCompress(userId, {
    targetTokens,
    strategy,
    preserveCritical,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loading label="Running Compression Pipeline..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center dark:bg-[#1E293B]">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to run compression
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Target Tokens: {targetTokens.toLocaleString()}
            </label>
            <input
              type="range"
              min={2000}
              max={20000}
              step={500}
              value={targetTokens}
              onChange={(e) => {
                setTargetTokens(Number(e.target.value));
              }}
              className="w-full accent-[#2B5FD9]"
              aria-label="Target tokens"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1.5">
              Compression Strategy
            </label>
            <Select
              value={strategy}
              onChange={(e) => {
                setStrategy(e.target.value as CompressionStrategy);
              }}
              aria-label="Compression strategy"
              options={Object.entries(STRATEGY_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="preserve-critical"
              checked={preserveCritical}
              onChange={(e) => {
                setPreserveCritical(e.target.checked);
              }}
              className="h-4 w-4 accent-[#2B5FD9]"
            />
            <label
              htmlFor="preserve-critical"
              className="text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8]"
            >
              Preserve critical items
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => {
              void refetch();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#2B5FD9] text-white hover:bg-[#2450C4] transition-colors"
          >
            <Zap className="h-3.5 w-3.5" /> Run Compression
          </button>
        </div>
      </Card>

      {/* ── Token metrics ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Original Tokens',
            value: data.originalTokens.toLocaleString(),
            icon: <FileText className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Compressed Tokens',
            value: data.compressedTokens.toLocaleString(),
            icon: <Shrink className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
          },
          {
            label: 'Reduction',
            value: `${data.reductionPercent.toFixed(1)}%`,
            icon: <TrendingDownIcon className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Retention Confidence',
            value: `${String(Math.round(data.confidence * 100))}%`,
            icon: <ShieldCheck className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            variant="standard"
            padding="md"
            className="dark:bg-[#1E293B] dark:border-[#334155]"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>{stat.icon}</div>
              <div className="min-w-0">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
                  {stat.label}
                </p>
                <p className="text-[20px] font-bold text-[#111827] dark:text-[#F8FAFC]">
                  {stat.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Reduction visual ──────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {STRATEGY_LABELS[data.strategy] ?? data.strategy} strategy
          </h3>
          <span className="text-[12px] text-[#94A3B8]">
            {data.items.length} items kept · {data.chunksRemoved} removed · {data.chunksMerged}{' '}
            merged · {data.compressionTimeMs}ms
          </span>
        </div>
        <div className="relative h-6 rounded-lg overflow-hidden bg-[#F1F5F9] dark:bg-[#334155]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2B5FD9] to-[#22C55E] transition-all duration-500"
            style={{ width: `${String(Math.max(0, Math.min(100, 100 - data.reductionPercent)))}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-white drop-shadow">
            {data.reductionPercent.toFixed(1)}% reduction
          </div>
        </div>
        {/* Steps */}
        <div className="mt-4 space-y-2">
          {data.steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-3 text-[12px]">
              <span className="w-24 shrink-0 font-medium text-[#64748B] dark:text-[#94A3B8]">
                {STRATEGY_LABELS[step.strategy] ?? step.strategy}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#7C3AED] dark:bg-[#A78BFA]"
                  style={{
                    width: `${String((step.tokensAfter / Math.max(1, step.tokensBefore)) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-44 text-right text-[#94A3B8] truncate">
                {step.itemsBefore} → {step.itemsAfter} items · {step.tokensBefore.toLocaleString()}{' '}
                → {step.tokensAfter.toLocaleString()} tok
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Kept items ────────────────────────────────────────────────── */}
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#22C55E]" /> Retained Context Items
          <span className="text-[11px] font-normal text-[#94A3B8]">{data.items.length} items</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
          {data.items.map((item) => (
            <div
              key={item.contextId}
              className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                  {SOURCE_LABELS[item.source] ?? item.source}
                </span>
                <span className="text-[11px] text-[#94A3B8] shrink-0">
                  {item.estimatedTokens} tok
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                {item.content}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ── Shared Components ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ContextItemCard({ item }: { item: ContextItemDTO }): React.JSX.Element {
  const sourceColor = SOURCE_COLORS[item.source] ?? 'bg-[#F1F5F9] text-[#64748B]';
  const priorityInfo = PRIORITY_BADGE[item.priority] ?? {
    variant: 'default' as const,
    label: item.priority,
  };

  return (
    <Card
      variant="standard"
      padding="md"
      className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${sourceColor}`}>
            <FolderTree className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
              {SOURCE_LABELS[item.source] ?? item.source}
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              {CATEGORY_LABELS[item.category] ?? item.category} · v{item.version}
            </p>
          </div>
        </div>
        <Badge variant={priorityInfo.variant} size="sm" className="shrink-0">
          {priorityInfo.label}
        </Badge>
      </div>

      {/* Content */}
      <p className="text-[13px] leading-relaxed text-[#64748B] dark:text-[#94A3B8] line-clamp-3 flex-1">
        {item.content}
      </p>

      {/* Metrics */}
      <div className="mt-3 space-y-1.5 text-[12px]">
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Hash className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <strong className="text-[#111827] dark:text-[#F8FAFC]">{item.estimatedTokens}</strong>{' '}
            estimated tokens · confidence{' '}
            <strong className="text-[#111827] dark:text-[#F8FAFC]">
              {Math.round(item.confidence * 100)}%
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Tags + capabilities */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {item.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#93C5FD]"
          >
            {tag}
          </span>
        ))}
        {item.capability.slice(0, 2).map((cap) => (
          <span
            key={cap}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] dark:bg-[#4C1D95]/40 text-[#7C3AED] dark:text-[#C4B5FD]"
          >
            {CAPABILITY_LABELS[cap] ?? cap}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between">
        <span className="text-[11px] text-[#94A3B8] truncate">{item.sourceId}</span>
        <Badge variant="ai" size="sm" className="flex items-center gap-1 shrink-0">
          <Sparkles className="h-3 w-3" /> Scored: {Math.round(item.freshness * 100)}% fresh
        </Badge>
      </div>
    </Card>
  );
}

function RankedItemRow({
  item,
  score,
  rank,
}: {
  item: ContextItemDTO;
  score?: ContextScoreDTO;
  rank: number;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]">
      <span className="w-6 h-6 shrink-0 rounded-full bg-[#2B5FD9] text-white text-[11px] font-bold flex items-center justify-center">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
            {SOURCE_LABELS[item.source] ?? item.source}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={PRIORITY_BADGE[item.priority]?.variant ?? 'default'} size="sm">
              {PRIORITY_BADGE[item.priority]?.label ?? item.priority}
            </Badge>
            <span className="text-[11px] font-bold text-[#2B5FD9] dark:text-[#93C5FD]">
              {score ? Math.round(score.finalScore * 100) : 0}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-[#F1F5F9] dark:bg-[#334155] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF] transition-all duration-300"
              style={{ width: `${String(score ? Math.round(score.finalScore * 100) : 0)}%` }}
            />
          </div>
          <span className="text-[10px] text-[#94A3B8] w-20 text-right truncate">
            {item.estimatedTokens} tok
          </span>
        </div>
      </div>
    </div>
  );
}

function AssembledPackageView({ pkg }: { pkg: EnterpriseContextPackageDTO }): React.JSX.Element {
  const sections: Array<{
    key: string;
    label: string;
    items: ContextItemDTO[];
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      key: 'memory',
      label: 'Memory',
      items: pkg.memory,
      icon: <Brain className="h-4 w-4" />,
      color: 'text-[#7C3AED] bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
    },
    {
      key: 'knowledge',
      label: 'Knowledge',
      items: pkg.knowledge,
      icon: <BookOpen className="h-4 w-4" />,
      color: 'text-[#22C55E] bg-[#F0FDF4] dark:bg-[#14532D]/40',
    },
    {
      key: 'business',
      label: 'Business',
      items: pkg.business,
      icon: <BarChart3 className="h-4 w-4" />,
      color: 'text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#78350F]/40',
    },
    {
      key: 'client',
      label: 'Client',
      items: pkg.client,
      icon: <Target className="h-4 w-4" />,
      color: 'text-[#EF4444] bg-[#FEF2F2] dark:bg-[#450A0A]/40',
    },
    {
      key: 'documents',
      label: 'Documents',
      items: pkg.documents,
      icon: <FileText className="h-4 w-4" />,
      color: 'text-[#0EA5E9] bg-[#F0F9FF] dark:bg-[#0C4A6E]/40',
    },
  ];

  return (
    <Card variant="standard" padding="md" className="dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] flex items-center gap-2">
          <Package className="h-4 w-4 text-[#22C55E]" /> Enterprise Context Package
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            {pkg.metadata.totalItems} items
          </Badge>
          <Badge variant="warning" size="sm">
            ~{pkg.metadata.estimatedTokens.toLocaleString()} tokens
          </Badge>
          <Badge variant="ai" size="sm">
            {Math.round(pkg.metadata.confidence * 100)}% confidence
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {sections.map((section) => (
          <div
            key={section.key}
            className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded ${section.color}`}>{section.icon}</div>
              <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                {section.label}
              </span>
              <span className="text-[11px] text-[#94A3B8] ml-auto">{section.items.length}</span>
            </div>
            {section.items.length === 0 ? (
              <p className="text-[11px] text-[#CBD5E1]">No items</p>
            ) : (
              <ul className="space-y-1">
                {section.items.slice(0, 3).map((item) => (
                  <li
                    key={item.contextId}
                    className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate"
                  >
                    · {item.content.slice(0, 60)}…
                  </li>
                ))}
                {section.items.length > 3 && (
                  <li className="text-[11px] text-[#94A3B8]">+{section.items.length - 3} more</li>
                )}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Assembled prompt */}
      <div>
        <p className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide mb-2">
          Assembled Prompt (preview)
        </p>
        <pre className="p-3 rounded-lg bg-[#0F172A] text-[#CBD5E1] text-[11px] leading-relaxed overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap font-mono">
          {pkg.assembledPrompt.slice(0, 1200)}
          {pkg.assembledPrompt.length > 1200 ? '\n… (truncated)' : ''}
        </pre>
      </div>
    </Card>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function TrendingDownIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 17-8.5-8.5-5 5L2 7" />
      <path d="M16 17h6v-6" />
    </svg>
  );
}

function maxCount(values: number[]): number {
  const max = Math.max(...values);
  return max > 0 ? max : 1;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}
