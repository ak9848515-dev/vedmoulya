// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Capability Marketplace
// EPIC-004 / EI-001 — Enterprise Capability Registry & Marketplace
// Browse, search, and discover reusable platform capabilities consumed by
// every business module (Content Agency, Learning, Career, Marketing).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useState } from 'react';
import { Card, Badge, Loading, TextField, Select, EmptyState } from '@vedmoulya/ui';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
  Search,
  Boxes,
  GitBranch,
  Layers,
  Users,
  ArrowRight,
  Zap,
  CircleDollarSign,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { useCapabilityMarketplace } from '../../lib/api-client.js';
import { useNavigationStore } from '../../stores/navigation-store.js';
import { useAuthStore, useAuthHydrated } from '../../stores/auth-store.js';
import { SignInRedirect } from '../../components/SignInRedirect.js';
import type {
  CapabilityDTO,
  CapabilityCategory,
  CapabilityStatusValue,
  BusinessModule,
} from '@vedmoulya/capabilities';

// ── Status → Badge variant + label ──────────────────────────────────────────

const STATUS_BADGE: Record<
  CapabilityDTO['status'],
  {
    variant:
      | 'default'
      | 'success'
      | 'warning'
      | 'info'
      | 'ai'
      | 'premium'
      | 'draft'
      | 'published'
      | 'archived'
      | 'beta'
      | 'new';
    label: string;
  }
> = {
  design: { variant: 'beta', label: 'Design' },
  draft: { variant: 'draft', label: 'Draft' },
  testing: { variant: 'warning', label: 'Testing' },
  active: { variant: 'success', label: 'Active' },
  deprecated: { variant: 'default', label: 'Deprecated' },
  archived: { variant: 'archived', label: 'Archived' },
};

const MODULE_LABELS: Record<string, string> = {
  'content-agency': 'Content Agency',
  learning: 'Learning',
  career: 'Career',
  marketing: 'Marketing',
  business: 'Business',
  platform: 'Platform',
};

export default function CapabilitiesPage(): React.JSX.Element {
  const hydrated = useAuthHydrated();
  const { user, sessionReady } = useAuthStore();
  const userId = user?.userId ?? '';
  const { data, isLoading, isError } = useCapabilityMarketplace(userId);
  const { setActiveSection, setBreadcrumbs } = useNavigationStore();

  // ── Local filter state ───────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CapabilityCategory | 'all'>('all');
  const [status, setStatus] = useState<CapabilityStatusValue | 'all'>('all');
  const [module, setModule] = useState<BusinessModule | 'all'>('all');
  const [showCompositionsOnly, setShowCompositionsOnly] = useState(false);

  useEffect(() => {
    setActiveSection('capabilities');
    setBreadcrumbs([
      { label: 'Capability Registry', href: '/capabilities' },
      { label: 'Marketplace' },
    ]);
  }, [setActiveSection, setBreadcrumbs]);

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!hydrated || !sessionReady) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Capability Marketplace..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <SignInRedirect />;
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loading label="Loading Capability Marketplace..." size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card variant="standard" padding="lg" className="max-w-md text-center">
          <h2 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Unable to load the capability registry
          </h2>
          <p className="mt-2 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
            Please try again in a moment.
          </p>
        </Card>
      </div>
    );
  }

  const {
    capabilities,
    total,
    activeCount,
    compositionCount,
    countByCategory,
    countByStatus,
    countByBusinessModule,
  } = data;

  // ── Filtered cards (client-side for instant UX) ──────────────────────────
  // Plain pure function (not a hook) so it stays behind the early-return
  // guards without violating the rules of hooks; the catalog is tiny so
  // memoization is unnecessary.
  const filtered = filterCapabilities(capabilities, {
    query,
    category,
    status,
    module,
    showCompositionsOnly,
  });

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[26px] md:text-[28px] font-heading font-bold text-[#111827] dark:text-[#F8FAFC]">
              Capability Marketplace
            </h1>
            <Badge variant="ai" size="sm">
              EI-001
            </Badge>
          </div>
          <p className="text-[14px] md:text-[15px] text-[#64748B] dark:text-[#94A3B8] max-w-2xl">
            Reusable capabilities consumed by every business module — one capability, many
            businesses. No module talks to an AI provider directly; they all consume the registry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="md" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> {activeCount} Active
          </Badge>
          <Badge variant="info" size="md" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> {compositionCount} Compositions
          </Badge>
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Capabilities',
            value: String(total),
            icon: <Boxes className="h-5 w-5 text-[#2B5FD9]" />,
            bg: 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40',
          },
          {
            label: 'Active',
            value: String(activeCount),
            icon: <ShieldCheck className="h-5 w-5 text-[#22C55E]" />,
            bg: 'bg-[#F0FDF4] dark:bg-[#14532D]/40',
          },
          {
            label: 'Compositions',
            value: String(compositionCount),
            icon: <Layers className="h-5 w-5 text-[#7C3AED]" />,
            bg: 'bg-[#F5F3FF] dark:bg-[#4C1D95]/40',
          },
          {
            label: 'Business Modules',
            value: String(
              Object.keys(countByBusinessModule).filter(
                (m) => countByBusinessModule[m as BusinessModule] > 0,
              ).length,
            ),
            icon: <Users className="h-5 w-5 text-[#F59E0B]" />,
            bg: 'bg-[#FFFBEB] dark:bg-[#78350F]/40',
          },
        ].map((stat) => (
          <Card key={stat.label} variant="standard" padding="md" className="dark:bg-[#1E293B]">
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
      <Card variant="standard" padding="md" className="dark:bg-[#1E293B]">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex-1 min-w-0">
            <TextField
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search capabilities, tags, descriptions…"
              aria-label="Search capabilities"
              leftIcon={<Search className="h-4 w-4 text-[#94A3B8]" />}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:w-auto">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as CapabilityCategory | 'all');
              }}
              aria-label="Filter by category"
              options={[
                { value: 'all', label: 'All Categories' },
                ...Object.keys(countByCategory)
                  .sort()
                  .map((c) => ({
                    value: c,
                    label: c.charAt(0).toUpperCase() + c.slice(1),
                  })),
              ]}
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CapabilityStatusValue | 'all');
              }}
              aria-label="Filter by status"
              options={[
                { value: 'all', label: 'All Statuses' },
                ...Object.keys(countByStatus)
                  .filter((s) => countByStatus[s as CapabilityStatusValue] > 0)
                  .map((s) => ({
                    value: s,
                    label: s.charAt(0).toUpperCase() + s.slice(1),
                  })),
              ]}
            />
            <Select
              value={module}
              onChange={(e) => {
                setModule(e.target.value as BusinessModule | 'all');
              }}
              aria-label="Filter by business module"
              options={[
                { value: 'all', label: 'All Modules' },
                ...Object.keys(countByBusinessModule)
                  .filter((m) => countByBusinessModule[m as BusinessModule] > 0)
                  .map((m) => ({
                    value: m,
                    // eslint-disable-next-line security/detect-object-injection -- closed-union BusinessModule keys
                    label: MODULE_LABELS[m] ?? m,
                  })),
              ]}
            />
            <button
              onClick={() => {
                setShowCompositionsOnly((v) => !v);
              }}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                showCompositionsOnly
                  ? 'bg-[#2B5FD9] text-white border-[#2B5FD9]'
                  : 'bg-white dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#334155] hover:border-[#2B5FD9]'
              }`}
            >
              <Layers className="h-4 w-4" /> Compositions
            </button>
          </div>
        </div>
      </Card>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          Showing{' '}
          <span className="font-semibold text-[#111827] dark:text-[#F8FAFC]">
            {filtered.length}
          </span>{' '}
          of {total} capabilities
        </p>
        {showCompositionsOnly && (
          <Badge variant="ai" size="sm">
            Compositions only
          </Badge>
        )}
      </div>

      <ErrorBoundary section="capability-marketplace">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-8 w-8" />}
            title="No capabilities found"
            description="Try adjusting your search or clearing the filters."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((cap) => (
              <CapabilityCard key={cap.id} capability={cap} />
            ))}
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}

// ── Filtering helper (pure function — see call site) ────────────────────────

function filterCapabilities(
  capabilities: CapabilityDTO[],
  filters: {
    query: string;
    category: CapabilityCategory | 'all';
    status: CapabilityStatusValue | 'all';
    module: BusinessModule | 'all';
    showCompositionsOnly: boolean;
  },
): CapabilityDTO[] {
  const q = filters.query.trim().toLowerCase();
  return capabilities.filter((cap) => {
    if (filters.category !== 'all' && cap.category !== filters.category) return false;
    if (filters.status !== 'all' && cap.status !== filters.status) return false;
    if (filters.module !== 'all' && !cap.businessModules.includes(filters.module)) return false;
    if (filters.showCompositionsOnly && !cap.isComposition) return false;
    if (q) {
      const haystack = `${cap.name} ${cap.description} ${cap.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

// ── Capability card ────────────────────────────────────────────────────────

function CapabilityCard({ capability }: { capability: CapabilityDTO }): React.JSX.Element {
  const statusInfo = STATUS_BADGE[capability.status];

  return (
    <Card
      variant="standard"
      padding="md"
      className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:bg-[#1E293B] dark:border-[#334155] flex flex-col"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 shrink-0">
            <Boxes className="h-4 w-4 text-[#2B5FD9]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
              {capability.name}
            </h3>
            <p className="text-[11px] text-[#94A3B8]">
              v{capability.version} · {capability.owner}
            </p>
          </div>
        </div>
        <Badge variant={statusInfo.variant} size="sm" className="shrink-0">
          {statusInfo.label}
        </Badge>
      </div>

      {/* Description */}
      <p className="mt-3 text-[13px] leading-relaxed text-[#64748B] dark:text-[#94A3B8] line-clamp-3 flex-1">
        {capability.description}
      </p>

      {/* Tags */}
      {capability.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {capability.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata rows */}
      <div className="mt-4 space-y-1.5 text-[12px]">
        {capability.isComposition ? (
          <div className="flex items-center gap-1.5 text-[#7C3AED] dark:text-[#A78BFA]">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Composes: {capability.composition.map((c) => c.slot ?? c.id).join(' + ')}
            </span>
          </div>
        ) : (
          capability.dependencies.length > 0 && (
            <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Depends on: {capability.dependencies.join(', ')}</span>
            </div>
          )
        )}
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <Users className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Used by:{' '}
            {/* eslint-disable-next-line security/detect-object-injection -- closed-union BusinessModule keys */}
            {capability.businessModules.map((m) => MODULE_LABELS[m] ?? m).join(', ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
          <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            ~${capability.estimatedCostUsd.toFixed(4)}/call ·{' '}
            {capability.estimatedInputTokens + capability.estimatedOutputTokens} tokens ·{' '}
            {capability.p50Ms}ms
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#F1F5F9] dark:border-[#334155] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
          <FileText className="h-3.5 w-3.5" />
          <span>
            Quality {Math.round(capability.qualityTarget * 100)}% · Confidence{' '}
            {Math.round(capability.confidence * 100)}%
          </span>
        </div>
        {capability.documentationUrl && (
          <a
            href={capability.documentationUrl}
            className="flex items-center gap-1 text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
          >
            Docs <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
