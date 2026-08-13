// ──────────────────────────────────────────────────────────────────
// VedMoulya — Quality-First Selector
// EPIC-013 — selection priority:
//   CAPABILITY → QUALITY → PRECISION → ACCURACY → EVIDENCE →
//   RELIABILITY → AVAILABILITY → USER PREFERENCE → FREE/LOCAL →
//   COST → LATENCY
// The cheapest tool NEVER wins when it produces inferior output.
// Free availability is a tiebreaker at the END of the chain — never
// the driver (same rule as provider routing: FREE MUST NOT BEAT
// QUALITY).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityCandidate } from '../types/capability-types.js';

export interface SelectionResult {
  selected: CapabilityCandidate | undefined;
  /** Every candidate considered, best first, with why. */
  ranked: CapabilityCandidate[];
  reasons: string[];
}

export class QualityFirstSelector {
  /**
   * Rank candidates for a capability. Candidates that cannot perform
   * the capability are never eligible regardless of price/free.
   */
  select(
    candidates: CapabilityCandidate[],
    userPreference?: { family?: string; modelId?: string },
  ): SelectionResult {
    const eligible = candidates.filter(
      (c) => c.classification !== 'UNAVAILABLE' && c.classification !== 'UNKNOWN',
    );
    const reasons: string[] = [];

    const ranked = [...eligible].sort((a, b) => this.compare(a, b, userPreference));

    if (ranked.length === 0) {
      return {
        selected: undefined,
        ranked: [],
        reasons: ['No eligible candidate — this capability is unavailable.'],
      };
    }

    const selected = ranked[0];
    if (selected) {
      reasons.push(
        `${selected.name} selected — capability ✓` +
          (selected.quality !== undefined
            ? `, quality ${Math.round(selected.quality * 100)}%`
            : ', quality unknown') +
          (selected.freeAvailability === 'FREE' ? ' (free)' : ''),
      );
    }
    return { selected, ranked, reasons };
  }

  private compare(
    a: CapabilityCandidate,
    b: CapabilityCandidate,
    userPreference?: { family?: string; modelId?: string },
  ): number {
    // 1. Capability fit — already filtered; both eligible here.
    // 2. Quality — the primary differentiator when evidence exists.
    const aq = a.quality ?? 0;
    const bq = b.quality ?? 0;
    if (aq !== bq) return bq - aq;

    // 3. Evidence confidence (VERIFIED > PROVIDER_DECLARED > INFERRED).
    const ae = this.evidenceRank(a);
    const be = this.evidenceRank(b);
    if (ae !== be) return be - ae;

    // 4. Reliability: configured/ready beats configure-first.
    const ac = this.readyRank(a.classification);
    const bc = this.readyRank(b.classification);
    if (ac !== bc) return bc - ac;

    // 5. Availability.
    if (a.availability !== b.availability) return (b.availability ?? 0) - (a.availability ?? 0);

    // 6. User preference — configured family is a preference, not quality.
    if (userPreference?.family) {
      const af = a.providerFamily === userPreference.family ? 1 : 0;
      const bf = b.providerFamily === userPreference.family ? 1 : 0;
      if (af !== bf) return bf - af;
    }

    // 7. Free/local — tiebreaker only.
    const afree = this.freeRank(a);
    const bfree = this.freeRank(b);
    if (afree !== bfree) return bfree - afree;

    // 8. Cost — last.
    return (
      (a.estimatedCostUsd ?? Number.POSITIVE_INFINITY) -
      (b.estimatedCostUsd ?? Number.POSITIVE_INFINITY)
    );
  }

  private evidenceRank(c: CapabilityCandidate): number {
    if (c.evidence.length === 0) return 0;
    const best = Math.max(...c.evidence.map((e) => this.confidenceScore(e.confidence)));
    return best;
  }

  private confidenceScore(c: string): number {
    switch (c) {
      case 'VERIFIED':
        return 5;
      case 'MEASURED':
        return 4;
      case 'PROVIDER_DECLARED':
        return 3;
      case 'INFERRED':
        return 2;
      default:
        return 1;
    }
  }

  private readyRank(c: string): number {
    return c === 'READY' ? 2 : c === 'CONFIGURE' ? 1 : 0;
  }

  private freeRank(c: CapabilityCandidate): number {
    if (c.localAvailability === 'yes') return 3;
    if (c.freeAvailability === 'FREE') return 2;
    if (c.freeAvailability === 'FREE_WITH_QUOTA') return 1;
    return 0;
  }
}
