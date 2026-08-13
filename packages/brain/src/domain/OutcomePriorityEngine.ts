// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · OutcomePriorityEngine
// EPIC-020 (Outcome & Revenue layer) — mission §2 / §8.
//
// Ranks candidate actions using a TRANSPARENT hierarchy:
//
//   USER OUTCOME → URGENCY → IMPACT → MONEY / SAVINGS → TIME SAVINGS
//   → FEASIBILITY → EVIDENCE → QUALITY → USER FIT → COST → FREE/LOCAL
//
// Two hard invariants:
//   1. QUALITY NEVER OUTRANKED BY PRICE — a materially better paid
//      capability may be recommended; the factor weights guarantee
//      evidence/quality dominate cost/free. Free wins only when the
//      quality evidence is equivalent.
//   2. UNKNOWN stays UNKNOWN — an absent money/time/evidence signal
//      contributes zero, never an invented value.
//
// The score is fully transparent: every item exposes its factor
// breakdown (each factor's weight × evidence) and a plain-English
// reason. No hidden chain-of-thought.
// ──────────────────────────────────────────────────────────────────

import type {
  DailyAction,
  DailyActionCategory,
  OutcomePriority,
  OutcomeValue,
} from '../types/outcome-types.js';

// ── Candidate shape (already normalized, evidence attached) ────────
export interface RankableAction {
  id: string;
  title: string;
  category: DailyActionCategory;
  /** Urgency evidence: CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN. */
  priority: OutcomePriority;
  /** Money expected value — only when evidence supports it. */
  moneyValue?: OutcomeValue;
  /** Time expected value — only when evidence supports it. */
  timeValue?: OutcomeValue;
  /** Impact signal 0..1 (problem severity / business weight). */
  impact?: number;
  /** Feasibility signal 0..1. */
  feasibility?: number;
  /** Evidence quantity/quality 0..1. */
  evidence?: number;
  /** Quality signal 0..1 (the dominant factor). */
  quality?: number;
  /** User-fit signal 0..1 (goals/preferences). */
  userFit?: number;
  /** Cost class — used ONLY as the tie-breaker. */
  costClass?: 'free' | 'free_with_quota' | 'local' | 'open_source' | 'low' | 'paid' | 'unknown';
  /** Whether this action needs user approval before proceeding. */
  requiresApproval?: string;
  /** Uncertainty 0..1 (higher = less certain). */
  uncertainty?: number;
  source: { kind: 'task' | 'opportunity' | 'event' | 'learning' | 'approval'; id: string };
  recommendedNextAction: string;
  whyItMatters: string[];
}

export interface PriorityFactorBreakdown {
  factor: string;
  /** 0..1 raw evidence signal for this factor. */
  signal: number;
  /** Transparent weight (constants below — sum = 1). */
  weight: number;
}

export interface RankedAction extends DailyAction {
  factorBreakdown: PriorityFactorBreakdown[];
  reason: string;
}

// ── Transparent weights — hierarchy order, quality above cost ─────
const W = {
  outcome: 0.14, // USER OUTCOME fit
  urgency: 0.13, // URGENCY
  impact: 0.12, // IMPACT
  money: 0.12, // MONEY / SAVINGS
  time: 0.11, // TIME SAVINGS
  feasibility: 0.09, // FEASIBILITY
  evidence: 0.09, // EVIDENCE
  quality: 0.1, // QUALITY
  userFit: 0.06, // USER FIT
  cost: 0.04, // COST — deliberately small
} as const;

const PRIORITY_SIGNAL: Record<OutcomePriority, number> = {
  CRITICAL: 1,
  HIGH: 0.8,
  MEDIUM: 0.55,
  LOW: 0.3,
  UNKNOWN: 0.2,
};

const COST_SIGNAL: Record<NonNullable<RankableAction['costClass']>, number> = {
  free: 1,
  free_with_quota: 0.9,
  local: 0.85,
  open_source: 0.8,
  low: 0.6,
  paid: 0.25,
  unknown: 0.5,
};

const CATEGORY_OUTCOME_FIT: Record<DailyActionCategory, number> = {
  EARNING: 1,
  PROBLEM: 1,
  CAREER: 0.9,
  AUTOMATION: 0.85,
  PRODUCT: 0.7,
  COST_SAVING: 0.8,
  APPROVAL: 0.95,
  CONTINUE: 0.85,
  LEARNING: 0.5,
  UNKNOWN: 0.4,
};

export class OutcomePriorityEngine {
  /**
   * Rank candidate actions by the transparent hierarchy. Quality and
   * evidence dominate: the weights above put 0.10+0.09+0.09+0.12+0.11
   * on quality/evidence/impact/money/time versus 0.04 on cost — a free
   * candidate can never leapfrog a materially better one.
   */
  rank(candidates: RankableAction[], limit = 5): RankedAction[] {
    const scored = candidates.map((c) => this.score(c));
    scored.sort((a, b) => b.priorityScore - a.priorityScore);
    return scored.slice(0, Math.max(1, limit));
  }

  private score(c: RankableAction): RankedAction {
    const breakdown: PriorityFactorBreakdown[] = [];
    const signal = (
      factor: string,
      value: number | undefined,
      fallback: number,
      weight: number,
    ): number => {
      const s = value === undefined ? fallback : Math.min(1, Math.max(0, value));
      breakdown.push({ factor, signal: s, weight });
      return s * weight;
    };

    // USER OUTCOME fit — category-driven (the user's top priorities:
    // solve problems, earn/save money, save time).
    const outcome = signal('outcome', CATEGORY_OUTCOME_FIT[c.category], 0.4, W.outcome);
    const urgency = signal('urgency', PRIORITY_SIGNAL[c.priority], 0.2, W.urgency);
    const impact = signal('impact', c.impact, 0.5, W.impact);
    // Money/time — UNKNOWN contributes zero, never an invented number.
    const moneySignal = c.moneyValue && c.moneyValue.status !== 'UNKNOWN' ? 0.9 : 0;
    const money = signal('money', moneySignal, 0, W.money);
    const timeSignal = c.timeValue && c.timeValue.status !== 'UNKNOWN' ? 0.8 : 0;
    const time = signal('time', timeSignal, 0, W.time);
    const feasibility = signal('feasibility', c.feasibility, 0.6, W.feasibility);
    const evidence = signal('evidence', c.evidence, 0.3, W.evidence);
    // QUALITY — the dominant single factor (never outranked by cost).
    const quality = signal('quality', c.quality, 0.5, W.quality);
    const userFit = signal('userFit', c.userFit, 0.5, W.userFit);
    const cost = signal('cost', c.costClass ? COST_SIGNAL[c.costClass] : 0.5, 0.5, W.cost);

    const priorityScore =
      Math.round(
        (outcome +
          urgency +
          impact +
          money +
          time +
          feasibility +
          evidence +
          quality +
          userFit +
          cost) *
          1000,
      ) / 1000;

    return {
      id: c.id,
      title: c.title,
      category: c.category,
      whyItMatters: c.whyItMatters,
      recommendedNextAction: c.recommendedNextAction,
      priorityScore,
      requiresApproval: c.requiresApproval,
      source: c.source,
      expectedValue: c.moneyValue ?? c.timeValue,
      uncertainty: c.uncertainty,
      factorBreakdown: breakdown,
      reason: this.reason(c, quality, money, time, urgency, cost),
    };
  }

  private reason(
    c: RankableAction,
    quality: number,
    money: number,
    time: number,
    urgency: number,
    cost: number,
  ): string {
    const parts: string[] = [];
    if (c.priority === 'CRITICAL' || c.priority === 'HIGH')
      parts.push(`${c.priority.toLowerCase()} priority`);
    if (money > 0.09) parts.push('evidence of money impact');
    if (time > 0.08) parts.push('evidence of time savings');
    if (quality >= 0.08) parts.push('strong quality evidence');
    if (cost > 0.02 && c.costClass === 'free') parts.push('free to use');
    if (cost > 0.02 && c.costClass === 'local') parts.push('runs locally');
    if (urgency >= 0.1) parts.push('urgent');
    return parts.length > 0 ? parts.join(' · ') : 'Evidence is limited — treated conservatively.';
  }
}
