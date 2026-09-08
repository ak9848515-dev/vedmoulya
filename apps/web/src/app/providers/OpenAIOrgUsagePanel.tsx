// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OpenAI Organization Usage panel (usage details view)
// OpenAI-reported token usage of the platform's OWN organization key from
// /v1/organization/usage/completions, with REAL UTC windows per period
// (Today / This week / This month). This is distinct from VedMoulya's
// measured per-user ledger: it answers "what has the organization key spent
// this period, per model?" and requires an Organization admin-scope key.
// Every unavailable state is honest — never fabricated. No period is offered
// unless the endpoint window exists for it.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Loading } from '@vedmoulya/ui';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { useOpenAIOrgUsage, type OpenAIOrgPeriod } from '../../lib/api-client.js';

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ORG_PERIOD_LABELS: Array<{ id: OpenAIOrgPeriod; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
];

export function OpenAIOrgUsagePanel({ userId }: { userId: string }): React.JSX.Element {
  const [period, setPeriod] = useState<OpenAIOrgPeriod>('month');
  const { data, isLoading, isFetching, refetch } = useOpenAIOrgUsage(userId, period);

  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="mr-auto">
          <h3 className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
            OpenAI Organization Usage
          </h3>
          <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] max-w-xl">
            Token usage reported by OpenAI for the organization key — not VedMoulya&rsquo;s measured
            per-user ledger. Requires an Organization admin-scope key.
          </p>
        </div>
        <div
          className="flex items-center gap-0.5 rounded-lg bg-[#F1F5F9] dark:bg-[#1E293B] p-0.5"
          role="group"
          aria-label="Usage period"
        >
          {ORG_PERIOD_LABELS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setPeriod(option.id);
              }}
              aria-pressed={period === option.id}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                period === option.id
                  ? 'bg-white dark:bg-[#334155] text-[#2B5FD9] dark:text-[#6B8FEF] shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#374151] dark:hover:text-[#E2E8F0]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="py-6">
          <Loading label="Loading organization usage..." size="sm" />
        </div>
      )}

      {!isLoading && data && !data.available && (
        <div className="flex items-start gap-2 rounded-lg bg-[#FFFBEB] dark:bg-transparent dark:border dark:border-[#334155] px-3 py-2.5">
          <AlertCircle
            className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="text-[12px] font-medium text-[#92400E] dark:text-[#FBBF24]">
              Usage unavailable
            </p>
            <p className="text-[11px] text-[#92704B] dark:text-[#94A3B8]">{data.message}</p>
          </div>
        </div>
      )}

      {!isLoading && data && data.available && (
        <div>
          {data.rows.length === 0 ? (
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] py-2">
              No {ORG_PERIOD_LABELS.find((o) => o.id === period)?.label.toLowerCase()} usage
              reported by OpenAI{isFetching ? ' · refreshing…' : ''}.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8] dark:text-[#64748B] px-2">
                <span>Model</span>
                <span className="w-20 text-right tabular-nums">Input</span>
                <span className="w-20 text-right tabular-nums">Cached</span>
                <span className="w-20 text-right tabular-nums">Output</span>
              </div>
              {data.rows.map((row) => (
                <div
                  key={row.model}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center rounded-lg px-2 py-1.5 text-[12px] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
                >
                  <span
                    className="truncate font-medium text-[#374151] dark:text-[#E2E8F0]"
                    title={row.model}
                  >
                    {row.model}
                  </span>
                  <span className="w-20 text-right tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {fmtTokens(row.inputTokens)}
                  </span>
                  <span className="w-20 text-right tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {fmtTokens(row.cachedInputTokens)}
                  </span>
                  <span className="w-20 text-right tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                    {fmtTokens(row.outputTokens)}
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center rounded-lg bg-[#EFF4FE] dark:bg-[#1E293B] px-2 py-1.5 text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                <span>Total</span>
                <span className="w-20 text-right tabular-nums">
                  {fmtTokens(data.totals.inputTokens)}
                </span>
                <span className="w-20 text-right tabular-nums">
                  {fmtTokens(data.totals.cachedInputTokens)}
                </span>
                <span className="w-20 text-right tabular-nums">
                  {fmtTokens(data.totals.outputTokens)}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
            <p className="text-[10px] text-[#94A3B8] dark:text-[#64748B]">
              {data.message}
              {data.hasMore
                ? ' · More pages exist beyond the first 1,000 buckets — totals reflect this read only.'
                : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                void refetch();
              }}
              disabled={isFetching}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline disabled:opacity-60"
            >
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
