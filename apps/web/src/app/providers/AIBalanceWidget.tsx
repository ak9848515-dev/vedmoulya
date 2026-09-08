// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Balance widget (compact command-center card)
//
// ONE aggregated balance only, shown at the top of AI Providers. It answers
// at a glance: "how much AI balance do I have left this period?"
//
// Data honesty (non-negotiable, mirrors the usage widget):
//   - the balance is REAL and measured: it derives from the user's monthly
//     token budget preference (monthlyTokenBudget) minus the tokens the
//     execution ledger has actually measured (tokensUsed). It is a USER-SET
//     budget — never a provider account balance, never a free-tier limit,
//     never a registry quota estimate.
//   - when NO budget is configured there is no truthful denominator, so the
//     card says "Balance unavailable — set a monthly budget to track it"
//     instead of inventing a number.
//   - the progress bar always carries readable % + X/Y text (colour is never
//     the only signal), and there is NO provider breakdown on this card.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Wallet, ArrowRight } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AIBalanceData {
  /** Measured tokens used this period (from the execution ledger). */
  tokensUsed: number;
  /** User-set monthly token budget (the honest denominator). */
  tokenBudget: number;
  /** Whether the user has actually configured a monthly budget. */
  budgetConfigured: boolean;
}

export interface AIBalanceWidgetProps {
  balance: AIBalanceData;
  onViewAll?: () => void;
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtTokensLong(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} billion`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} thousand`;
  return String(n);
}

// ── Component ───────────────────────────────────────────────────────────────

export function AIBalanceWidget({ balance, onViewAll }: AIBalanceWidgetProps): React.JSX.Element {
  const { tokensUsed, tokenBudget, budgetConfigured } = balance;

  // Honest math: remaining = budget − measured usage, clamped to ≥ 0. This is
  // only ever shown when a budget actually exists — no fabricated denominator.
  const available = Math.max(0, tokenBudget - tokensUsed);
  const percentRemaining =
    budgetConfigured && tokenBudget > 0 ? Math.round((available / tokenBudget) * 100) : 0;

  // Colour is never the only signal — % and X/Y text always accompany it.
  const barTone =
    percentRemaining >= 40
      ? 'bg-emerald-500'
      : percentRemaining >= 15
        ? 'bg-amber-500'
        : 'bg-rose-500';
  const textTone =
    percentRemaining >= 40
      ? 'text-emerald-600 dark:text-emerald-400'
      : percentRemaining >= 15
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="h-4 w-4 text-[#2B5FD9]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">AI Balance</h2>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
          >
            View all
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {!budgetConfigured || tokenBudget <= 0 ? (
        <div className="flex items-center gap-2 py-2 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
          <span
            className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600"
            aria-hidden="true"
          />
          Balance unavailable — set a monthly token budget to track it.
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
              {fmtTokensLong(available)}
            </span>
            <span className="text-[13px] text-[#64748B] dark:text-[#94A3B8]">
              tokens available this month
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span className={`text-[13px] font-semibold tabular-nums ${textTone}`}>
              {percentRemaining}% remaining
            </span>
            <span className="text-[11px] text-[#94A3B8] dark:text-[#64748B]">
              of your monthly token budget
            </span>
          </div>

          {/* Progress bar — readable % + X/Y always accompany it. */}
          <div
            role="progressbar"
            aria-label="Monthly token budget remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentRemaining}
            className="mt-2 h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#334155]"
          >
            <div
              className={`h-2 rounded-full ${barTone} transition-all duration-500`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>

          <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
            {fmtTokens(available)} / {fmtTokens(tokenBudget)} tokens remaining
          </p>
        </div>
      )}
    </div>
  );
}
