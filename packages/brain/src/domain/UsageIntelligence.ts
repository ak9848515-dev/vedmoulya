// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · UsageIntelligence
// EPIC-020 §3/§5 — Token / cost / quota intelligence + failure
// classification.
//
// Provider limits are NEVER fabricated: every field is KNOWN /
// UNKNOWN / ESTIMATED. The Brain derives budget estimates ONLY from
// evidence (provider adapters via BrainUsagePort, or the registry-
// backed candidate facts). Failure classification is keyword +
// evidence driven, never guessed.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { ProviderCandidateFact } from '@vedmoulya/capability-marketplace';
import type {
  FailureClass,
  ProviderUsageFact,
  UsageEvidenceSummary,
} from '../types/continuous-types.js';

const FREE_TIERS = new Set(['free', 'free_with_quota', 'local']);

export class UsageIntelligence {
  /**
   * Registry-backed facts derived from the capability candidate port.
   * Only fields the registry actually declares become KNOWN — everything
   * else stays UNKNOWN (quota/rate limits are never invented here).
   */
  deriveFactsFromCandidates(
    candidates: ProviderCandidateFact[],
    capturedAt: string,
  ): ProviderUsageFact[] {
    const facts: ProviderUsageFact[] = [];
    for (const candidate of candidates) {
      const fact: ProviderUsageFact = { providerId: candidate.providerId, capturedAt };
      if (candidate.modelId) fact.modelId = candidate.modelId;
      if (candidate.estimatedCostUsd !== undefined) {
        fact.estimatedCostUsd = {
          value: candidate.estimatedCostUsd,
          status: 'ESTIMATED',
        };
      }
      fact.freeTierStatus = {
        // costTier is always declared on ProviderCandidateFact; 'free' maps to
        // the free tier, low/medium/high are paid tiers.
        value: candidate.costTier === 'free' ? 'free' : 'paid',
        status: 'KNOWN',
      };
      if (typeof candidate.availability === 'number') {
        fact.availability = { value: candidate.availability, status: 'KNOWN' };
      }
      facts.push(fact);
    }
    return facts;
  }

  /** Per-provider summary: which fields are KNOWN / UNKNOWN / ESTIMATED. */
  summarizeFacts(facts: ProviderUsageFact[]): UsageEvidenceSummary[] {
    const byProvider = new Map<string, ProviderUsageFact[]>();
    for (const fact of facts) {
      const list = byProvider.get(fact.providerId) ?? [];
      list.push(fact);
      byProvider.set(fact.providerId, list);
    }
    const summaries: UsageEvidenceSummary[] = [];
    for (const [providerId, list] of byProvider) {
      const known: string[] = [];
      const unknown: string[] = [];
      const estimated: string[] = [];
      let costEstimateUsd: number | undefined;
      let remainingQuota: number | undefined;
      let quotaKnown = false;

      for (const fact of list) {
        for (const [field, datum] of Object.entries(fact)) {
          if (!datum || typeof datum !== 'object' || !('status' in datum)) continue;
          const status = (datum as { status: string }).status;
          if (status === 'KNOWN') known.push(field);
          else if (status === 'ESTIMATED') estimated.push(field);
          else unknown.push(field);
          if (field === 'estimatedCostUsd' && status !== 'UNKNOWN') {
            costEstimateUsd = (datum as { value: number }).value;
          }
          if (field === 'remainingQuota') {
            quotaKnown = status === 'KNOWN';
            remainingQuota = (datum as { value: number }).value;
          }
        }
      }
      summaries.push({
        providerId,
        knownFields: [...new Set(known)],
        unknownFields: [...new Set(unknown)],
        estimatedFields: [...new Set(estimated)],
        quotaExhausted: quotaKnown && (remainingQuota ?? 0) <= 0,
        costEstimateUsd,
      });
    }
    return summaries;
  }

  /**
   * Evidence-gated cost estimate: sums KNOWN/ESTIMATED per-provider cost.
   * Returns undefined when NO evidence exists (UNKNOWN stays UNKNOWN —
   * the budget gate then passes and the Brain records the estimate as
   * absent rather than fabricating one).
   */
  estimateTotalCost(facts: ProviderUsageFact[]): number | undefined {
    const estimates = facts
      .map((f) => f.estimatedCostUsd)
      .filter(
        (d): d is { value: number; status: 'KNOWN' | 'ESTIMATED' } =>
          d !== undefined && d.status !== 'UNKNOWN',
      );
    if (estimates.length === 0) return undefined;
    return estimates.reduce((sum, d) => sum + d.value, 0);
  }

  /** True only when remainingQuota is KNOWN and exhausted. */
  quotaExhausted(facts: ProviderUsageFact[]): boolean {
    return facts.some((f) => f.remainingQuota?.status === 'KNOWN' && f.remainingQuota.value <= 0);
  }

  /** Whether the provider is free or local per evidence (quality is decided elsewhere). */
  isFreeOrLocal(facts: ProviderUsageFact[]): boolean {
    return facts.some(
      (f) => f.freeTierStatus?.status === 'KNOWN' && FREE_TIERS.has(f.freeTierStatus.value),
    );
  }

  /**
   * Classify a provider failure. Keyword evidence from the error plus
   * quota evidence from the usage port — never guessed, never masked
   * as another class. UNKNOWN_FAILURE stays UNKNOWN_FAILURE.
   */
  classifyFailure(error: unknown, facts: ProviderUsageFact[]): FailureClass {
    const message = error instanceof Error ? error.message : String(error);
    const low = message.toLowerCase();

    if (this.quotaExhausted(facts)) return 'QUOTA_EXHAUSTED';
    if (/quota|rate\s*limit|429|too\s*many\s*requests|exhausted|limit\s*reached/.test(low)) {
      return 'QUOTA_EXHAUSTED';
    }
    if (
      /subscription|billing|payment|plan\s*(upgrade|required)|403|insufficient\s*quota/.test(low)
    ) {
      return 'SUBSCRIPTION_UNAVAILABLE';
    }
    if (/unavailable|503|502|down|timeout|timed\s*out|econn|eai_again|temporar/.test(low)) {
      return 'PROVIDER_UNAVAILABLE';
    }
    if (/degraded|overloaded|slow|capacity|busy/.test(low)) {
      return 'MODEL_DEGRADED';
    }
    return 'UNKNOWN_FAILURE';
  }

  /** Evidence note for a capability's usage facts (used in decisions/UI). */
  describeCapabilityUsage(
    providerId: string,
    capability: CapabilityId,
    facts: ProviderUsageFact[],
  ): string {
    const summary = this.summarizeFacts(facts).find((s) => s.providerId === providerId);
    if (!summary) return `${providerId}: usage evidence unavailable (UNKNOWN).`;
    const known = summary.knownFields.length;
    const total =
      summary.knownFields.length + summary.unknownFields.length + summary.estimatedFields.length;
    return `${providerId}: ${known}/${total} usage fields evidenced; ${
      summary.costEstimateUsd !== undefined
        ? `estimated cost $${summary.costEstimateUsd.toFixed(4)}`
        : 'cost UNKNOWN'
    }.`;
  }
}
