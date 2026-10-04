// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — AI Control Center (the honest usage board)
// Replaces the old single "AI Balance" card. Two INDEPENDENT visual concepts:
//   1. PROVIDER QUOTA — per provider; when the provider reports nothing the row
//      reads "Unknown" and shows NO bar. There is no universal token pool.
//   2. USER BUDGET   — only rendered when a real limit exists, and labelled
//      "your budget" vs "VedMoulya allowance" so a platform default is never
//      mistaken for the user's own spending limit.
//
// LOCAL AI is always shown separately and is explicitly excluded from cloud
// quota/budget maths. Colour is never the only signal — every bar carries text.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Cpu, HardDrive, Wallet, AlertTriangle } from 'lucide-react';
import type { AiControlCenterDTO, AiProviderBoardRowDTO } from './ai-control-center-types.js';

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatUsd(usd: number, known: boolean): string {
  if (!known) return 'Cost: Unknown';
  if (usd === 0) return '$0.00';
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

const CARD =
  'rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-4 shadow-sm';

const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]';

function barToneClass(percentRemaining: number): string {
  if (percentRemaining >= 40) return 'bg-emerald-500';
  if (percentRemaining >= 15) return 'bg-amber-500';
  return 'bg-rose-500';
}

/**
 * The honest readiness sentence for one provider.
 *
 * A configured provider that is NOT executable (quota exhausted, bad credential,
 * rate limited) must NOT read "Connected — Ready to use". Every state names what
 * is true and whether a generation would actually work right now.
 */
export function readinessLabel(row: AiProviderBoardRowDTO): string {
  const state = row.readiness.state;
  if (state === 'READY' || state === 'EXECUTING') return 'Available';
  if (state === 'QUOTA_EXHAUSTED') return 'Quota exhausted — not available';
  if (state === 'RATE_LIMITED') return 'Rate limited — not available now';
  if (state === 'AUTH_REQUIRED') return 'Credential rejected — reconnect';
  if (state === 'UNAVAILABLE') return 'Unavailable just now';
  if (state === 'FAILED') return 'Last run failed';
  if (state === 'DEGRADED') return 'Available, but degraded';
  if (state === 'DISABLED') return 'Turned off';
  if (state === 'NOT_CONFIGURED') return 'Not configured';
  return state.replace(/_/g, ' ').toLowerCase();
}

/**
 * ONE provider row. Three independent facts, never merged into one bar:
 *   usage (measured) · quota (provider-reported or UNKNOWN) · cost (known/unknown)
 */
function ProviderRow({ row }: { row: AiProviderBoardRowDTO }): React.JSX.Element {
  const { quota } = row;
  return (
    <li className="border-t border-[#F1F5F9] dark:border-[#1E293B] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#111827] dark:text-[#F8FAFC]">
          {row.name}
          {row.local && (
            <span className="ml-2 text-[10px] uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
              local
            </span>
          )}
        </span>
        <span className="shrink-0 text-[12px] tabular-nums text-[#64748B] dark:text-[#94A3B8]">
          {row.monthTokens > 0 ? `${formatTokens(row.monthTokens)} tokens` : 'No usage yet'}
        </span>
      </div>

      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
        <div className="flex gap-1">
          <dt>Quota:</dt>
          <dd className="font-medium">
            {row.local
              ? 'Not metered'
              : quota.quotaKnown
                ? `${Math.round(quota.usedPercent ?? 0)}% used`
                : 'Unknown'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Remaining:</dt>
          <dd className="font-medium">
            {row.local
              ? 'n/a (local)'
              : quota.remainingTokens !== undefined
                ? formatTokens(quota.remainingTokens)
                : 'Unknown'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Cost:</dt>
          <dd className="font-medium">
            {row.monthCostKnown
              ? formatUsd(row.monthCostUsd, true)
              : row.monthExecutions > 0
                ? 'Unknown'
                : '$0.00'}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Status:</dt>
          <dd className="font-medium">{readinessLabel(row)}</dd>
        </div>
      </dl>

      {/* Provider quota bar ONLY when the provider reported a real quota. */}
      {quota.quotaKnown && !row.local && quota.usedPercent !== undefined && (
        <div className="mt-1.5">
          <div
            role="progressbar"
            aria-label={`${row.name} provider quota used`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(quota.usedPercent)}
            className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#334155]"
          >
            <div
              className="h-1.5 rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]"
              style={{ width: `${Math.min(100, Math.max(0, quota.usedPercent))}%` }}
            />
          </div>
        </div>
      )}
      {!quota.quotaKnown && !row.local && (
        <p className="mt-1 text-[10px] text-[#94A3B8]">
          This provider does not report quota to VedMoulya — remaining is unknown, not zero.
        </p>
      )}
    </li>
  );
}

/**
 * The USER BUDGET block. Rendered ONLY when a real limit exists, and always
 * labelled by provenance so a VedMoulya allowance is never read as a user budget.
 * When no limit exists the board says "Not configured" — it never falls back to
 * a fabricated 1M-token balance.
 */
function BudgetBlock({ board }: { board: AiControlCenterDTO }): React.JSX.Element {
  const { budget, remaining } = board;
  if (budget.source === 'NONE' || budget.amountTokens === undefined) {
    return (
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Budget</h2>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          Not configured — set a monthly budget to track your own usage.
        </p>
      </div>
    );
  }
  const isUser = budget.source === 'USER_CONFIGURED';
  const percentRemaining =
    remaining.limitTokens !== undefined && remaining.limitTokens > 0
      ? Math.round(((remaining.remainingTokens ?? 0) / remaining.limitTokens) * 100)
      : 0;
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {isUser ? 'Your monthly budget' : 'VedMoulya allowance'}
        </h2>
      </div>
      {!isUser && (
        <p className="mt-1 text-[10px] text-[#94A3B8]">
          This is a VedMoulya allowance — not a budget you set.
        </p>
      )}
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[20px] font-bold tabular-nums text-[#111827] dark:text-[#F8FAFC]">
          {formatTokens(remaining.remainingTokens ?? 0)}
        </span>
        <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
          of {formatTokens(remaining.limitTokens ?? 0)} tokens left this month
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`text-[12px] font-semibold tabular-nums ${barToneClass(percentRemaining) === 'bg-emerald-500' ? 'text-emerald-600 dark:text-emerald-400' : barToneClass(percentRemaining) === 'bg-amber-500' ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}
        >
          {percentRemaining}% remaining
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${isUser ? 'Your' : 'VedMoulya allowance'} monthly token budget remaining`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentRemaining}
        className="mt-1.5 h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#334155]"
      >
        <div
          className={`h-2 rounded-full ${barToneClass(percentRemaining)}`}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] text-[#94A3B8]">
        This bar tracks your budget only — it is not a provider quota. Provider limits are shown per
        provider above.
      </p>
    </div>
  );
}

export interface AiControlCenterBoardProps {
  board: AiControlCenterDTO;
}

/**
 * The AI Control Center: current cloud usage, today, this month, the budget,
 * per-provider usage/quota/status, and LOCAL AI kept explicitly separate.
 * Nothing here is derived client-side — every number comes from the ledger.
 */
export function AiControlCenterBoard({ board }: AiControlCenterBoardProps): React.JSX.Element {
  const { summary } = board;
  const cloudProviders = board.providers.filter((p) => !p.local);
  const localProviders = board.providers.filter((p) => p.local);

  return (
    <section aria-label="AI usage" className="space-y-3">
      {/* ── Summary ─────────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
          <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Your AI usage
          </h2>
          <span className="ml-auto text-[11px] text-[#94A3B8]">{board.timezone}</span>
        </div>

        <p className="mt-2 text-[13px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
          {summary.activeCloudAis} active cloud {summary.activeCloudAis === 1 ? 'AI' : 'AIs'}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className={SECTION_TITLE}>Today</p>
            <p className="text-[18px] font-bold tabular-nums text-[#111827] dark:text-[#F8FAFC]">
              {formatTokens(summary.todayCloudTokens)}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {summary.todayCloudExecutions} execution
              {summary.todayCloudExecutions === 1 ? '' : 's'} ·{' '}
              {formatUsd(summary.todayCloudCostUsd, summary.todayCloudCostKnown)}
            </p>
          </div>
          <div>
            <p className={SECTION_TITLE}>This month</p>
            <p className="text-[18px] font-bold tabular-nums text-[#111827] dark:text-[#F8FAFC]">
              {formatTokens(summary.monthCloudTokens)}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              {summary.monthCloudExecutions} execution
              {summary.monthCloudExecutions === 1 ? '' : 's'} ·{' '}
              {formatUsd(summary.monthCloudCostUsd, summary.monthCloudCostKnown)}
            </p>
          </div>
        </div>

        {summary.localAis > 0 && (
          <div className="mt-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
              <HardDrive className="h-3 w-3" aria-hidden="true" />
              Local AI — {formatTokens(summary.localMonthTokens)} tokens this month
            </p>
            <p className="text-[10px] text-[#94A3B8]">
              Runs on your own machine. No VedMoulya cloud token charge and not counted against any
              provider quota.
            </p>
          </div>
        )}
      </div>

      {/* ── Budget (never a fabricated balance) ──────────────────────── */}
      <BudgetBlock board={board} />

      {/* ── Per-provider cloud usage + quota ─────────────────────────── */}
      <div className={`${CARD} p-0`}>
        <div className="flex items-center gap-2 px-4 py-3">
          <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">Cloud AI</h2>
          <span className="text-[11px] text-[#94A3B8]">
            usage · quota · cost — measured separately per provider
          </span>
        </div>
        <ul>
          {cloudProviders.length === 0 ? (
            <li className="border-t border-[#F1F5F9] dark:border-[#1E293B] px-4 py-3 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              No cloud AI configured yet.
            </li>
          ) : (
            cloudProviders.map((row) => <ProviderRow key={row.providerId} row={row} />)
          )}
        </ul>
      </div>

      {/* ── Local AI — always separate ───────────────────────────────── */}
      {localProviders.length > 0 && (
        <div className={`${CARD} p-0`}>
          <div className="flex items-center gap-2 px-4 py-3">
            <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Local AI
            </h2>
            <span className="text-[11px] text-[#94A3B8]">
              observable — excluded from cloud quota and budgets
            </span>
          </div>
          <ul>
            {localProviders.map((row) => (
              <ProviderRow key={row.providerId} row={row} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
