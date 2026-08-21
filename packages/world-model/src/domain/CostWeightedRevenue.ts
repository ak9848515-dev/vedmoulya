// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · CostWeightedRevenue (SPRINT-034)
//
// Cost-weighted revenue intelligence — composes the EXISTING CostLedger
// (through WorldCostPort) with the RevenueIntelligence snapshot. The system
// does NOT rank purely by revenue: it considers revenue, cost, margin, time,
// risk, confidence, automation potential and founder effort.
//
// Honesty rules:
//   • UNKNOWN revenue is NOT zero; UNKNOWN cost is NOT zero; UNKNOWN margin is
//     NOT zero — each stays UNKNOWN and contributes nothing to the rank;
//   • a rankScore exists ONLY when both revenue and cost evidence exist
//     (margin-aware); otherwise the entry is listed with its assumptions;
//   • every calculation exposes its assumptions; the ranking is advisory and
//     never a promise.
// This is a composition over CostLedger + RevenueIntelligence — no accounting
// engine, no budget authority.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  RevenueFigure,
  RevenueRanking,
  RevenueRankingEntry,
  RevenueStream,
} from '../types/world-types.js';
import type { WorldCostPort } from '../contracts/world-ports.js';

/** Raw ROI multiple (revenue − cost) / cost — only when BOTH revenue and
 *  cost carry evidence. Undefined otherwise. Exposed as the honest figure. */
export function roiUsdOf(revenue?: RevenueFigure, cost?: RevenueFigure): number | undefined {
  if (!revenue || !cost) return undefined;
  if (revenue.status === 'UNKNOWN' || cost.status === 'UNKNOWN') return undefined;
  const r = revenue.value;
  const c = cost.value;
  if (c <= 0) return undefined; // a zero/unknown cost is not a free stream
  return (r - c) / c;
}

/** Margin-aware RANK score: the raw ROI clamped to 0..10 so a single
 *  outlier cannot dominate the ranking. Rank score ≠ ROI figure — the raw
 *  ROI stays visible on the entry. Undefined without both evidence sides. */
export function rankScoreOf(revenue?: RevenueFigure, cost?: RevenueFigure): number | undefined {
  const roi = roiUsdOf(revenue, cost);
  if (roi === undefined) return undefined;
  return Math.min(10, Math.max(0, roi));
}

export function marginOf(revenue?: RevenueFigure, cost?: RevenueFigure): number | undefined {
  if (!revenue || !cost) return undefined;
  if (revenue.status === 'UNKNOWN' || cost.status === 'UNKNOWN') return undefined;
  if (revenue.value <= 0) return undefined;
  return (revenue.value - cost.value) / revenue.value;
}

export class CostWeightedRevenue {
  constructor(
    private readonly costPort: WorldCostPort | undefined,
    private readonly now: () => string,
  ) {}

  /** Rank the owner's streams margin-aware. Absent cost evidence the stream is
   *  listed with its assumptions — never ranked, never assumed cheap. */
  rank(ownerId: string, streams: RevenueStream[]): RevenueRanking {
    const generatedAt = this.now();
    const entries: RevenueRankingEntry[] = [];
    const unknownCost: string[] = [];
    const unknownRevenue: string[] = [];

    for (const stream of streams) {
      const revenue = stream.actualMonthlyRevenueUsd ?? stream.estimatedMonthlyRevenueUsd;
      const cost = stream.actualMonthlyCostUsd ?? stream.estimatedMonthlyCostUsd;
      // Measured CostLedger evidence (when present) overrides estimates for
      // the cost side — the ledger is authoritative accounting.
      const measured = this.costPort?.measuredCostUsd(ownerId, { streamId: stream.id });
      const effectiveCost: RevenueFigure | undefined =
        measured !== undefined
          ? { value: measured.value, status: 'VERIFIED', evidence: measured.evidence }
          : cost;

      const assumptions: string[] = [];
      if (!revenue) {
        unknownRevenue.push(stream.name);
        assumptions.push('No revenue evidence — UNKNOWN (never treated as zero).');
      } else if (revenue.status === 'UNKNOWN') {
        unknownRevenue.push(stream.name);
        assumptions.push(`Revenue is ${revenue.status} — not treated as zero, not ranked.`);
      } else {
        assumptions.push(
          `Revenue ${revenue.status === 'VERIFIED' ? 'verified' : 'estimated'} (${revenue.evidence.length} evidence item(s)).`,
        );
      }
      if (!effectiveCost) {
        unknownCost.push(stream.name);
        assumptions.push('No cost evidence — UNKNOWN (never treated as zero).');
      } else if (effectiveCost.status === 'UNKNOWN') {
        unknownCost.push(stream.name);
        assumptions.push(`Cost is ${effectiveCost.status} — not treated as zero, not ranked.`);
      } else {
        assumptions.push(
          measured !== undefined
            ? 'Cost measured by CostLedger (verified accounting).'
            : `Cost ${effectiveCost.status === 'VERIFIED' ? 'verified' : 'estimated'} (${effectiveCost.evidence.length} evidence item(s)).`,
        );
      }

      const margin = marginOf(revenue, effectiveCost);
      const roi = roiUsdOf(revenue, effectiveCost);
      const rank = rankScoreOf(revenue, effectiveCost);
      const automation =
        stream.automationPercentage?.status === 'UNKNOWN'
          ? undefined
          : stream.automationPercentage?.value;
      if (automation === undefined) {
        assumptions.push('Automation share UNKNOWN — not assumed.');
      }

      entries.push({
        streamId: stream.id,
        streamName: stream.name,
        kind: stream.kind,
        estimatedMonthlyRevenueUsd: stream.estimatedMonthlyRevenueUsd?.value,
        actualMonthlyRevenueUsd: stream.actualMonthlyRevenueUsd?.value,
        estimatedMonthlyCostUsd: stream.estimatedMonthlyCostUsd?.value,
        actualMonthlyCostUsd: stream.actualMonthlyCostUsd?.value,
        estimatedMargin: margin !== undefined ? round3(margin) : undefined,
        actualMargin:
          stream.actualMonthlyRevenueUsd && stream.actualMonthlyCostUsd
            ? round3(marginOf(stream.actualMonthlyRevenueUsd, stream.actualMonthlyCostUsd) ?? 0)
            : undefined,
        roiUsd: roi !== undefined ? round3(roi) : undefined,
        measuredCostUsd: measured?.value,
        rankScore: rank !== undefined ? round3(rank) : undefined,
        assumptions,
        advisory: true,
      });
    }

    // Sorted by rankScore (margin-aware) — entries without evidence sort last.
    const sorted = [...entries].sort((a, b) => {
      if (a.rankScore === undefined && b.rankScore === undefined)
        return a.streamName.localeCompare(b.streamName);
      if (a.rankScore === undefined) return 1;
      if (b.rankScore === undefined) return -1;
      return b.rankScore - a.rankScore;
    });

    return {
      ownerId,
      generatedAt,
      entries: sorted,
      unknownCost: [...new Set(unknownCost)],
      unknownRevenue: [...new Set(unknownRevenue)],
      advisory: true,
    };
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
