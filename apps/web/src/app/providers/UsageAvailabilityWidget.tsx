// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Usage & Availability widget
// EPIC-012A — Premium Experience Refinement
//
// A COMPACT command-center card shown above the provider list. It answers,
// at a glance: how many AI resources are ready, which need attention, and
// what each provider reports about its quota. It is NOT a billing dashboard.
//
// Data honesty (non-negotiable):
//   - every percentage is derived from the REAL registry health snapshot
//     (quotaUsedPercent); when a provider reports no quota the row says
//     "Usage unavailable" / "Not configured" — nothing is ever invented.
//   - provider readiness (red/orange/green) and usage availability are two
//     independent concepts and are rendered as such.
//   - one provider's missing/failed usage signal never breaks the widget.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Activity, RefreshCw, ArrowRight, Gauge } from 'lucide-react';
import {
  PROVIDER_QUOTA_DISCLAIMER,
  READINESS_LEGEND,
  deriveProviderUsage,
  type ProviderReadiness,
  type ProviderUsageDisplay,
  type ReadinessKey,
  type UsageTone,
} from './provider-readiness.js';

// ── Tone → class mapping (never colour-only: text always accompanies dots) ──

const USAGE_TONE_CLASSES: Record<UsageTone, { dot: string; text: string }> = {
  emerald: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  rose: {
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  slate: {
    dot: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-500 dark:text-slate-400',
  },
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface UsageWidgetRow {
  providerId: string;
  name: string;
  readiness: ProviderReadiness;
  /** Registry health snapshot quota (0 = provider reports none). */
  quotaUsedPercent: number;
  /** Local provider (ollama / lm-studio / local) — no metered quota. */
  local?: boolean;
  /** Deterministic mock runtime active — no metered quota. */
  mock?: boolean;
}

export interface UsageWidgetSummary {
  ready: number;
  attention: number;
  notConfigured: number;
}

export interface UsageAvailabilityWidgetProps {
  rows: UsageWidgetRow[];
  summary: UsageWidgetSummary;
  /** When the underlying provider/usage data was last fetched. */
  updatedAt: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onViewDetails?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function usageDisplay(row: UsageWidgetRow): ProviderUsageDisplay {
  try {
    return deriveProviderUsage({
      readiness: row.readiness,
      quotaUsedPercent: row.quotaUsedPercent,
      local: row.local,
      mock: row.mock,
    });
  } catch {
    // A single provider's derivation failure must never break the widget.
    return {
      state: 'UNAVAILABLE',
      label: 'Usage unavailable',
      detail: 'Usage information could not be read for this provider.',
      tone: 'slate',
    };
  }
}

function updatedAgo(updatedAt: Date | null): string {
  if (!updatedAt) return 'Not refreshed yet';
  const ms = Date.now() - updatedAt.getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'Updated just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

function summaryText(summary: UsageWidgetSummary): string {
  return `${summary.ready} ready · ${summary.attention} need attention · ${summary.notConfigured} not configured`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function UsageAvailabilityWidget({
  rows,
  summary,
  updatedAt,
  refreshing = false,
  onRefresh,
  onViewDetails,
}: UsageAvailabilityWidgetProps): React.JSX.Element {
  // Derive every row once: a failing provider never breaks its siblings, and
  // we can tell whether any provider-level percentage is being displayed.
  const displays: Array<{ row: UsageWidgetRow; usage: ProviderUsageDisplay }> = rows.map((row) => ({
    row,
    usage: usageDisplay(row),
  }));
  const showsProviderLevelNumbers = displays.some(
    (d) =>
      d.usage.state === 'AVAILABLE' || d.usage.state === 'WARNING' || d.usage.state === 'LIMITED',
  );

  return (
    <section
      aria-label="AI Usage & Availability"
      className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="p-1.5 rounded-lg bg-[#EFF4FE] dark:bg-[#1E3A8A]/40">
          <Gauge className="h-4 w-4 text-[#2B5FD9] dark:text-[#6B8FEF]" aria-hidden="true" />
        </div>
        <h2 className="text-[13px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
          AI Usage &amp; Availability
        </h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh usage"
            title="Refresh usage"
            className="ml-auto p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Per-provider usage rows */}
      {displays.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
          No provider usage information is available yet.
        </div>
      ) : (
        <ul className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
          {displays.map(({ row, usage }) => {
            const tone = USAGE_TONE_CLASSES[usage.tone];
            return (
              <li key={row.providerId} className="flex items-center gap-3 px-4 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#374151] dark:text-[#E2E8F0]">
                  {row.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium shrink-0 ${tone.text}`}
                  title={usage.detail ?? usage.label}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                  {/* Screen readers get the state words, not just a dot. */}
                  <span className="sr-only">Usage state:</span>
                  {usage.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Honest source note — shown whenever provider-level percentages appear,
          so a registry health percentage is never read as a personal balance. */}
      {showsProviderLevelNumbers && (
        <div className="border-t border-[#F1F5F9] dark:border-[#1E293B] px-4 py-1.5">
          <p className="text-[10px] leading-snug text-[#94A3B8]">{PROVIDER_QUOTA_DISCLAIMER}</p>
        </div>
      )}

      {/* Footer: honest summary + refresh recency + details */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1.5 border-t border-[#F1F5F9] dark:border-[#1E293B] px-4 py-2.5">
        <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]" aria-live="polite">
          <Activity className="h-3 w-3 inline mr-1 -mt-px text-[#94A3B8]" aria-hidden="true" />
          {summaryText(summary)}
        </p>
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-[11px] text-[#94A3B8]">{updatedAgo(updatedAt)}</span>
          {onViewDetails && (
            <button
              type="button"
              onClick={onViewDetails}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              View details
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Readiness legend (section 14: ONE colour per provider, explained here) ──

const LEGEND_TONE: Record<ReadinessKey, { dot: string; text: string }> = {
  red: { dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  orange: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  green: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};

export function ReadinessLegend(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
        Readiness
      </span>
      {READINESS_LEGEND.map((item) => {
        const tone = LEGEND_TONE[item.key];
        return (
          <span
            key={item.key}
            className="inline-flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]"
          >
            <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
            <span className={`font-medium ${tone.text}`}>{item.label}</span>
            <span className="text-[#94A3B8]">— {item.hint}</span>
          </span>
        );
      })}
    </div>
  );
}
