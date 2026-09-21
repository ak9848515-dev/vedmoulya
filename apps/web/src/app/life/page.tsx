// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Life Landing (UX-05)
//
// "Where am I in my life?"
//
// The unified human-facing hub for Career, Learning, and Business.
// Answers: What areas exist? What is active? What needs attention?
// What should I do next?
//
// All data from the certified Life OS snapshot — never fabricated.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Loading } from '@vedmoulya/ui';
import {
  Briefcase,
  BookOpen,
  BarChart3,
  ArrowRight,
  Target,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Store,
} from 'lucide-react';
import { useLifeOSSnapshot } from '../../lib/api-client.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import { LifeAreaCard } from './LifeAreaCard.js';
import type { ModuleKey, ModuleSummary, Priority, IdentitySummary } from '../sections/types.js';
import { statusDotColors } from '../sections/types.js';

// ── Life Areas ──────────────────────────────────────────────────────────────

interface LifeArea {
  key: 'career' | 'learning' | 'business' | 'marketplace';
  label: string;
  route: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

const LIFE_AREAS: readonly LifeArea[] = [
  {
    key: 'career',
    label: 'Career',
    route: '/career',
    description: 'Your career goals, skills and the work you are building.',
    icon: Briefcase,
  },
  {
    key: 'learning',
    label: 'Learning',
    route: '/learning',
    description: 'What you are learning next and how far you have come.',
    icon: BookOpen,
  },
  {
    key: 'business',
    label: 'Business',
    route: '/business',
    description: 'Ventures, clients, opportunities and the results they produce.',
    icon: BarChart3,
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    route: '/marketplace',
    description: 'Capabilities and skills you can add to your toolkit.',
    icon: Store,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function moduleSummary(value: unknown, module: string): ModuleSummary {
  const raw = asRecord(value);
  return {
    module,
    status:
      raw.status === 'available' || raw.status === 'degraded' || raw.status === 'unavailable'
        ? raw.status
        : 'unavailable',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    metrics: {},
    lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : '',
    hasNotifications: raw.hasNotifications === true,
    notificationCount: typeof raw.notificationCount === 'number' ? raw.notificationCount : 0,
  };
}

function safeObj<T>(val: unknown, defaults: T): T {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return { ...defaults, ...val };
  }
  return defaults;
}

function safeArr<TVal>(val: unknown): TVal[] {
  return Array.isArray(val) ? (val as TVal[]) : [];
}

const defaultIdentity: IdentitySummary = {
  displayName: 'User',
  email: '',
  role: '',
  purpose: '',
  primaryGoal: '',
  currentJourney: '',
  greeting: 'Hello',
};

// ── Page ────────────────────────────────────────────────────────────────────

export default function LifePage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading } = useLifeOSSnapshot(userId);

  if (!hydrated || !sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loading label="Loading your life..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-4 w-72 skeleton rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Extract real data ────────────────────────────────────────────────
  const raw = asRecord(data?.data);
  const identity: IdentitySummary = safeObj(raw.identity, defaultIdentity);
  const career: ModuleSummary = moduleSummary(raw.career, 'career');
  const learning: ModuleSummary = moduleSummary(raw.learning, 'learning');
  const business: ModuleSummary = moduleSummary(raw.business, 'business');
  const marketplace: ModuleSummary = moduleSummary(raw.marketplace, 'marketplace');
  const priorities: Priority[] = safeArr<Priority>(raw.priorities);

  const modules: Record<ModuleKey, ModuleSummary> = { career, learning, business, marketplace };

  // ── Derived state ────────────────────────────────────────────────────
  const attentionAreas = LIFE_AREAS.filter(
    (area) => modules[area.key].status === 'degraded' || modules[area.key].status === 'unavailable',
  );
  const activeAreas = LIFE_AREAS.filter((area) => modules[area.key].status === 'available');
  const hasFocus = Boolean(identity.primaryGoal || identity.currentJourney);
  const displayName = identity.displayName || 'User';

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — orientation
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-header">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2B5FD9] dark:text-[#6B8FEF]">
            Life
          </p>
          <h1 className="mt-1 text-[28px] md:text-[34px] leading-tight font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {hasFocus ? `${displayName}'s areas of growth` : 'The areas you are growing'}
          </h1>
          <p className="mt-2 text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
            Career, learning and business — three parts of one life, connected by your goals and
            powered by your missions.
          </p>
        </header>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          ATTENTION — areas needing focus
          ═══════════════════════════════════════════════════════════════════ */}
      {attentionAreas.length > 0 && (
        <ErrorBoundary section="life-attention">
          <div className="rounded-2xl border border-[#FDE68A] dark:border-[#78350F] bg-[#FFFBEB] dark:bg-[#451A03] p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
              <p className="text-[13px] font-semibold text-[#92400E] dark:text-[#FDE68A]">
                Needs attention
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {attentionAreas.map((area) => {
                const mod = modules[area.key];
                const Icon = area.icon;
                return (
                  <Link
                    key={area.key}
                    href={area.route}
                    className="inline-flex items-center gap-2 rounded-full border border-[#FDE68A] dark:border-[#78350F] bg-white dark:bg-[#1E293B] px-3 py-1.5 text-[13px] font-medium text-[#92400E] dark:text-[#FDE68A] hover:bg-[#FEF3C7] dark:hover:bg-[#291704] transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {area.label}
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${statusDotColors[mod.status] ?? 'bg-[#94A3B8]'}`}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AREA CARDS — the core of Life
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-areas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LIFE_AREAS.map((area) => (
            <LifeAreaCard key={area.key} area={area} summary={modules[area.key]} />
          ))}
        </div>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          ACTIVE GOALS — what matters now
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-goals">
        {priorities.length > 0 ? (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3]">
                Active Goals
              </h2>
              <Link
                href="/goals"
                className="text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {priorities.slice(0, 3).map((p) => (
                <Link
                  key={p.id}
                  href="/goals"
                  className="flex items-center gap-3 rounded-xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-3 transition-colors hover:border-[#2B5FD9]/30"
                >
                  <Target
                    className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF] shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                      {p.title}
                    </p>
                    <p className="text-[12px] text-[#94A3B8]">{p.source}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#CBD5E1]" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3] mb-3">
              Active Goals
            </h2>
            <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 text-center">
              <p className="text-[13px] text-[#94A3B8]">
                No active goals yet — set a goal to start building momentum.
              </p>
              <Link
                href="/goals"
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
              >
                Create a goal <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>
        )}
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          LIFE MOMENTUM — progress across areas
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-momentum">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0EA5A9] dark:text-[#66D0D3]">
              Life Momentum
            </h2>
            <Link
              href="/progress"
              className="text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              View progress
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {LIFE_AREAS.map((area) => {
              const mod = modules[area.key];
              const Icon = area.icon;
              return (
                <Link
                  key={area.key}
                  href={area.route}
                  className="flex items-center gap-3 rounded-xl border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-3 transition-colors hover:border-[#2B5FD9]/30"
                >
                  <span className="p-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
                    <Icon
                      className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC] truncate">
                      {area.label}
                    </p>
                    <div className="flex items-center gap-1">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusDotColors[mod.status] ?? 'bg-[#94A3B8]'}`}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] text-[#94A3B8]">
                        {mod.status === 'available'
                          ? 'Active'
                          : mod.status === 'degraded'
                            ? 'Attention'
                            : '—'}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          INTELLIGENCE — what VedMoulya notices
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-intelligence">
        {activeAreas.length > 0 ? (
          <Card className="dark:bg-[#1E293B] dark:border-[#334155]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              <p className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                What VedMoulya notices
              </p>
            </div>
            <div className="space-y-2">
              {activeAreas.map((area) => {
                const mod = modules[area.key];
                if (!mod.summary.trim()) return null;
                return (
                  <div
                    key={area.key}
                    className="flex items-start gap-2 text-[13px] text-[#64748B] dark:text-[#94A3B8]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mt-1.5 shrink-0" />
                    <span>
                      <span className="font-medium text-[#374151] dark:text-[#E2E8F0]">
                        {area.label}:
                      </span>{' '}
                      {mod.summary}
                    </span>
                  </div>
                );
              })}
              {activeAreas.every((area) => !modules[area.key].summary.trim()) && (
                <p className="text-[13px] text-[#94A3B8]">
                  Ask VedMoulya about your life areas for personalized insights.
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="dark:bg-[#1E293B] dark:border-[#334155]">
            <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
              <Sparkles className="h-4 w-4" />
              <p className="text-[13px]">
                Ask VedMoulya about your life areas for personalized insights.
              </p>
            </div>
          </Card>
        )}
      </ErrorBoundary>

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK LINKS — navigation to related areas
          ═══════════════════════════════════════════════════════════════════ */}
      <ErrorBoundary section="life-links">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/progress"
            className="inline-flex items-center gap-2 rounded-full border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/30 transition-colors"
          >
            <TrendingUp className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
            Progress
          </Link>
          <Link
            href="/goals"
            className="inline-flex items-center gap-2 rounded-full border border-[#E8EDF5] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-2 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/30 transition-colors"
          >
            <Target className="h-4 w-4 text-[#7C3AED]" aria-hidden="true" />
            Goals
          </Link>
        </div>
      </ErrorBoundary>
    </div>
  );
}
