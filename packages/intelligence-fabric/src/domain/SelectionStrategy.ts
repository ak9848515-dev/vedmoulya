// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · SelectionStrategy
// SPRINT-030 — G-4 · deterministic, explainable provider ranking.
//
// ADVISORY ONLY. This policy ranks candidates by an explicit strategy and
// explains WHY. The actual provider selection + execution stays in the frozen
// routing authority (ProviderRoutingAdvisor / QualityFirstSelector / the AI
// runtime). Rules that always hold regardless of strategy:
//   • a candidate that does not match the capability is never eligible
//   • an OBSERVED UNAVAILABLE/MISCONFIGURED provider is excluded (health wins)
//   • PRIVATE overrides cost: a PRIVATE task only ranks candidates whose
//     privacy class is acceptable (PRIVATE/INTERNAL/local/approved-enterprise)
//   • the newest/most expensive model is never assumed best — quality/cost/
//     latency come from evidence only
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PrivacyClass,
  SelectionStrategyKind,
  StrategyCandidate,
  StrategySelection,
} from '../types/fabric-types.js';

export interface StrategyInput {
  strategy: SelectionStrategyKind;
  taskPrivacy: PrivacyClass;
  candidates: StrategyCandidate[];
}

const ACCEPTABLE_FOR_PRIVATE: readonly PrivacyClass[] = ['PRIVATE', 'INTERNAL'];

export class SelectionStrategy {
  rank(input: StrategyInput): StrategySelection {
    const reasons: string[] = [];

    // 1. Capability match is non-negotiable.
    const capable = input.candidates.filter((c) => c.capabilityMatched);
    if (capable.length !== input.candidates.length) {
      reasons.push(
        `${input.candidates.length - capable.length} candidate(s) excluded — no capability match.`,
      );
    }

    // 2. Observed health exclusion (never route to something we OBSERVED down).
    const healthy = capable.filter(
      (c) => c.healthState !== 'UNAVAILABLE' && c.healthState !== 'MISCONFIGURED',
    );
    if (healthy.length !== capable.length) {
      reasons.push(
        `${capable.length - healthy.length} candidate(s) excluded — observed UNAVAILABLE/MISCONFIGURED.`,
      );
    }

    // 3. PRIVATE tasks: privacy overrides cost.
    let pool = healthy;
    if (input.taskPrivacy === 'PRIVATE' || input.taskPrivacy === 'SENSITIVE') {
      const privateSafe = healthy.filter((c) => {
        if (c.privacyClass === undefined) return c.localAvailability === 'yes';
        return ACCEPTABLE_FOR_PRIVATE.includes(c.privacyClass) || c.localAvailability === 'yes';
      });
      if (privateSafe.length > 0) {
        pool = privateSafe;
        reasons.push(
          `Task classified ${input.taskPrivacy} — privacy overrides cost: only local/private/approved-enterprise candidates are eligible.`,
        );
      } else {
        reasons.push(
          `Task classified ${input.taskPrivacy} but no privacy-safe candidate exists — selection stays within the eligible pool (privacy is never bypassed for cost).`,
        );
      }
    }

    if (pool.length === 0) {
      return {
        strategy: input.strategy,
        selected: undefined,
        ranked: [],
        reasons: [...reasons, 'No eligible candidate.'].slice(0, 6),
      };
    }

    const ranked = [...pool].sort((a, b) => this.compare(a, b, input.strategy));
    const selected = ranked[0];
    if (selected) {
      reasons.push(this.explain(selected, input));
    }
    return { strategy: input.strategy, selected, ranked, reasons: reasons.slice(0, 8) };
  }

  private compare(
    a: StrategyCandidate,
    b: StrategyCandidate,
    strategy: SelectionStrategyKind,
  ): number {
    switch (strategy) {
      case 'CHEAP': {
        // Local > free > free-with-quota > lowest cost. Never below capability
        // match (already filtered) and never a UNAVAILABLE health state (filtered).
        const ar = this.costRank(a);
        const br = this.costRank(b);
        if (ar !== br) return br - ar;
        return this.knownCost(a) - this.knownCost(b);
      }
      case 'FAST': {
        const al = a.latencyMs ?? Number.POSITIVE_INFINITY;
        const bl = b.latencyMs ?? Number.POSITIVE_INFINITY;
        if (al !== bl) return al - bl;
        return this.knownCost(a) - this.knownCost(b);
      }
      case 'QUALITY': {
        const aq = a.quality ?? 0;
        const bq = b.quality ?? 0;
        if (aq !== bq) return bq - aq;
        return (a.availability ?? 0) - (b.availability ?? 0);
      }
      case 'PRIVATE': {
        // Already privacy-filtered; prefer local, then quality.
        const al = a.localAvailability === 'yes' ? 1 : 0;
        const bl = b.localAvailability === 'yes' ? 1 : 0;
        if (al !== bl) return bl - al;
        return (b.quality ?? 0) - (a.quality ?? 0);
      }
      case 'BALANCED': {
        // quality 40% + availability 25% + cost 20% + latency 15% (normalized).
        return this.balancedScore(b) - this.balancedScore(a);
      }
    }
  }

  private balancedScore(c: StrategyCandidate): number {
    const quality = c.quality ?? 0;
    const availability = c.availability ?? 0;
    const cost = c.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
    const latency = c.latencyMs ?? Number.POSITIVE_INFINITY;
    // Normalize cost/latency into 0..1 (lower is better); unknown → 0.
    const costScore = Number.isFinite(cost) ? Math.max(0, 1 - cost / 10) : 0;
    const latencyScore = Number.isFinite(latency) ? Math.max(0, 1 - latency / 5000) : 0;
    return quality * 0.4 + availability * 0.25 + costScore * 0.2 + latencyScore * 0.15;
  }

  private costRank(c: StrategyCandidate): number {
    if (c.localAvailability === 'yes') return 4;
    if (c.freeAvailability === 'FREE') return 3;
    if (c.freeAvailability === 'FREE_WITH_QUOTA') return 2;
    return 1;
  }

  private knownCost(c: StrategyCandidate): number {
    return c.estimatedCostUsd ?? Number.POSITIVE_INFINITY;
  }

  private explain(selected: StrategyCandidate, input: StrategyInput): string {
    const base = `Selected ${selected.name}`;
    switch (input.strategy) {
      case 'CHEAP':
        return selected.localAvailability === 'yes'
          ? `${base} because it is local (task cost minimized).`
          : `${base} because it is the lowest-cost eligible candidate.`;
      case 'FAST':
        return selected.latencyMs !== undefined
          ? `${base} because it has the lowest observed latency (${Math.round(selected.latencyMs)}ms).`
          : `${base} — lowest cost among candidates with unknown latency.`;
      case 'QUALITY':
        return selected.quality !== undefined
          ? `${base} because it has the highest quality evidence (${Math.round(selected.quality * 100)}%).`
          : `${base} — highest availability among candidates with unknown quality.`;
      case 'PRIVATE':
        return selected.localAvailability === 'yes'
          ? `${base} because the task was classified ${input.taskPrivacy} and this is a local model.`
          : `${base} because the task was classified ${input.taskPrivacy} and this candidate is privacy-safe.`;
      case 'BALANCED':
        return `${base} because it maximizes the balanced score (quality 40% + availability 25% + cost 20% + latency 15%).`;
    }
  }
}
