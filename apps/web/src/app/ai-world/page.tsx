// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence
//
// The full discovery experience: today's digest, the bounded refresh control
// (never an uncontrolled crawler), and every discovery with evidence,
// GitHub intelligence, recommendation and actions. Quality over volume —
// the user understands WHAT happened, WHY it matters, and WHAT to do in a
// few seconds. "Configure Provider" links into the EXISTING provider
// configuration — nothing is duplicated.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Loading, EmptyState } from '@vedmoulya/ui';
import {
  Radar,
  RefreshCw,
  CheckCheck,
  Loader2,
  Flame,
  Star,
  Puzzle,
  Newspaper,
  Layers,
  Cpu,
  AppWindow,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  useAIWorldWorld,
  useAIWorldDigest,
  useAIWorldList,
  useAIWorldMarkRead,
  useAIWorldMarkAllRead,
  useAIWorldSetAction,
  useAIWorldRunDiscovery,
  useAIWorldSchedulerStatus,
  useAIWorldSchedulerPolicies,
  useAIWorldSchedulerSetSchedule,
  useAIWorldSchedulerRunNow,
  useAIWorldSchedulerRuntimeStatus,
} from '../../lib/api-client.js';
import type { DiscoveryItem, DiscoveryItemAction } from '@vedmoulya/ai-world';
import type { DiscoveryJobCategory, ScheduleFrequency } from '@vedmoulya/ai-world-scheduler';
import { DiscoveryItemCard } from '../../components/ai-world/DiscoveryItemCard.js';
import { DiscoverySchedulePanel } from '../../components/ai-world/DiscoverySchedulePanel.js';

type TabId =
  | 'all'
  | 'important'
  | 'recommended'
  | 'github'
  | 'updates'
  | 'models'
  | 'providers'
  | 'applications';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'important', label: 'Important', icon: <Flame className="h-3.5 w-3.5" /> },
  { id: 'recommended', label: 'Recommended', icon: <Star className="h-3.5 w-3.5" /> },
  { id: 'github', label: 'GitHub', icon: <Puzzle className="h-3.5 w-3.5" /> },
  { id: 'updates', label: 'AI Updates', icon: <Newspaper className="h-3.5 w-3.5" /> },
  { id: 'models', label: 'Models', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'providers', label: 'Providers', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'applications', label: 'Applications', icon: <AppWindow className="h-3.5 w-3.5" /> },
];

export default function AIWorldPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const router = useRouter();
  const { setBreadcrumbs } = useNavigationStore();
  const [tab, setTab] = useState<TabId>('all');

  const world = useAIWorldWorld(userId);
  const digest = useAIWorldDigest(userId);
  const list = useAIWorldList(userId);
  const markRead = useAIWorldMarkRead();
  const markAllRead = useAIWorldMarkAllRead();
  const setAction = useAIWorldSetAction();
  const runDiscovery = useAIWorldRunDiscovery();
  const schedulerStatus = useAIWorldSchedulerStatus(userId);
  const schedulerPolicies = useAIWorldSchedulerPolicies(userId);
  const schedulerRuntime = useAIWorldSchedulerRuntimeStatus(userId);
  const setSchedule = useAIWorldSchedulerSetSchedule();
  const runNow = useAIWorldSchedulerRunNow();
  const [refreshing, setRefreshing] = useState(false);
  const [schedulerBusy, setSchedulerBusy] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: 'AI World', href: '/ai-world' }]);
  }, [setBreadcrumbs]);

  // ── Derived view model ────────────────────────────────────────────────
  // NOTE: hooks (useMemo below) must be called BEFORE the early-return
  // guards below — React requires every hook on every render, so any hook
  // after `return <Loading…/>` / `return <SignInRedirect />` would throw
  // "Rendered more hooks than during the previous render" on hydration.
  const views = list.data ?? [];
  const readByItem = useMemo(() => new Map(views.map((v) => [v.item.id, v.read])), [views]);

  // ── Guards ────────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Exploring the AI world..." size="lg" />
      </div>
    );
  }
  if (!user) {
    return <SignInRedirect />;
  }
  const worldSection = (items: DiscoveryItem[]): Array<{ item: DiscoveryItem; read: boolean }> =>
    items.map((item) => ({ item, read: readByItem.get(item.id) ?? false }));

  const visible = ((): Array<{ item: DiscoveryItem; read: boolean }> => {
    switch (tab) {
      case 'important':
        return worldSection(world.data?.world.important ?? []);
      case 'recommended':
        return worldSection(world.data?.world.recommended ?? []);
      case 'github':
        return worldSection(world.data?.world.github ?? []);
      case 'updates':
        return worldSection(world.data?.world.updates ?? []);
      case 'models':
        return views.filter((v) => v.item.category === 'model');
      case 'providers':
        return views.filter((v) => v.item.category === 'provider');
      case 'applications':
        return views.filter((v) => v.item.category === 'application');
      case 'all':
      default:
        return views;
    }
  })();

  // ── Actions ───────────────────────────────────────────────────────────
  async function refreshAll(): Promise<void> {
    await Promise.all([world.refetch(), digest.refetch(), list.refetch()]);
  }

  async function handleRunDiscovery(): Promise<void> {
    setRefreshing(true);
    try {
      await runDiscovery.mutateAsync({ userId });
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    await markAllRead.mutateAsync({ userId });
    await refreshAll();
  }

  // ── EPIC-018 — Discovery Activity controls ────────────────────────
  // Enable/disable, frequency and Run now all flow through the scheduler's
  // SAME bounded safety path (budgets, source policies, rate limits,
  // cooldowns, security, dedup, store) — no privileged manual shortcut.
  async function refreshScheduler(): Promise<void> {
    await Promise.all([schedulerStatus.refetch(), schedulerPolicies.refetch()]);
  }

  async function handleSchedulerToggle(
    jobCategory: DiscoveryJobCategory,
    enabled: boolean,
  ): Promise<void> {
    setSchedulerBusy(true);
    try {
      await setSchedule.mutateAsync({ userId, jobCategory, enabled });
      await refreshScheduler();
    } finally {
      setSchedulerBusy(false);
    }
  }

  async function handleSchedulerFrequency(
    jobCategory: DiscoveryJobCategory,
    frequency: ScheduleFrequency,
  ): Promise<void> {
    setSchedulerBusy(true);
    try {
      await setSchedule.mutateAsync({ userId, jobCategory, frequency });
      await refreshScheduler();
    } finally {
      setSchedulerBusy(false);
    }
  }

  async function handleSchedulerRunNow(jobCategory: DiscoveryJobCategory): Promise<void> {
    setSchedulerBusy(true);
    try {
      await runNow.mutateAsync({ userId, jobCategory });
      await refreshAll();
      await refreshScheduler();
    } finally {
      setSchedulerBusy(false);
    }
  }

  async function handleMarkRead(itemId: string): Promise<void> {
    await markRead.mutateAsync({ userId, itemId });
    await refreshAll();
  }

  async function handleAction(itemId: string, action: DiscoveryItemAction): Promise<void> {
    await setAction.mutateAsync({ userId, itemId, action });
    await refreshAll();
  }

  function handleConfigure(item: DiscoveryItem): void {
    const family = item.modelFacts?.suggestedFamily;
    // router.push returns void in the App Router — no Promise to discard.
    router.push(family ? `/providers?provider=${encodeURIComponent(family)}` : '/providers');
  }

  const unread = world.data?.world.unreadCount ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-[#F5F3FF] dark:bg-[#4C1D95]/30">
          <Radar className="h-5 w-5 text-[#7C3AED]" />
        </div>
        <div>
          <h1 className="text-[24px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
            AI World
          </h1>
          <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
            What changed in AI — what is useful, free, local, and worth configuring
          </p>
        </div>
      </div>

      {/* ── Digest + refresh control ───────────────────────────────────── */}
      <ErrorBoundary section="ai-world-digest">
        <div className="grid md:grid-cols-3 gap-4">
          <Card variant="standard" padding="lg" className="md:col-span-2 dark:bg-[#1E293B]">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
                AI World — Today
              </h2>
              {unread > 0 && (
                <button
                  onClick={() => {
                    void handleMarkAllRead();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            <p className="mt-1 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              {digest.data?.summary ?? 'Loading today’s digest…'}
            </p>
            {digest.data && digest.data.entries.length > 0 && (
              <ul className="mt-3 space-y-2">
                {digest.data.entries.slice(0, 5).map((entry) => (
                  <li key={entry.item.id} className="flex items-start gap-2 text-[12px]">
                    <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]" />
                    <span className="text-[#374151] dark:text-[#E2E8F0]">
                      <span className="font-medium">{entry.item.title}</span>
                      <span className="text-[#94A3B8]"> — {entry.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
            <h2 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Discovery
            </h2>
            <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Bounded, evidence-first discovery — never an uncontrolled crawler.
            </p>
            <div className="mt-3 space-y-1 text-[11px] text-[#94A3B8]">
              {world.data?.lastRunAt && (
                <p>Last run · {new Date(world.data.lastRunAt).toLocaleString()}</p>
              )}
              {world.data?.runAvailableAt && (
                <p>Next refresh · {new Date(world.data.runAvailableAt).toLocaleTimeString()}</p>
              )}
            </div>
            <button
              onClick={() => {
                void handleRunDiscovery();
              }}
              disabled={refreshing || Boolean(world.data?.runAvailableAt)}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#2B5FD9] text-white text-[12px] font-semibold hover:bg-[#1E4BB8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {world.data?.runAvailableAt ? 'Scheduled' : 'Run discovery'}
            </button>
          </Card>
        </div>
      </ErrorBoundary>

      {/* ── EPIC-018 — Discovery Activity / Schedule ──────────────────── */}
      <ErrorBoundary section="ai-world-discovery-schedule">
        <DiscoverySchedulePanel
          status={schedulerStatus.data}
          policies={schedulerPolicies.data}
          runtime={schedulerRuntime.data}
          busy={schedulerBusy}
          onToggle={(jobCategory, enabled) => {
            void handleSchedulerToggle(jobCategory, enabled);
          }}
          onFrequency={(jobCategory, frequency) => {
            void handleSchedulerFrequency(jobCategory, frequency);
          }}
          onRunNow={(jobCategory) => {
            void handleSchedulerRunNow(jobCategory);
          }}
        />
      </ErrorBoundary>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-[#2B5FD9] text-white'
                : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Discovery items ────────────────────────────────────────────── */}
      <ErrorBoundary section="ai-world-items">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-8 w-8" />}
            title="Nothing here yet"
            description="No discoveries in this view. Discovery runs on a bounded schedule — check back after the next refresh."
          />
        ) : (
          <div className="space-y-3">
            {visible.map(({ item, read }) => (
              <DiscoveryItemCard
                key={item.id}
                item={item}
                variant="full"
                read={read}
                onMarkRead={() => {
                  void handleMarkRead(item.id);
                }}
                onSetAction={(action) => {
                  void handleAction(item.id, action);
                }}
                onConfigure={() => {
                  handleConfigure(item);
                }}
              />
            ))}
            <button
              onClick={() => {
                router.push('/providers');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] text-[12px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:border-[#2B5FD9] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors"
            >
              Manage AI Providers
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
