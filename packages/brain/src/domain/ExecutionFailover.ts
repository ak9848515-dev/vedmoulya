// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · ExecutionFailover
// EPIC-020 §5 — Provider failure / fallback orchestration.
//
// If a provider fails the Brain does NOT fail the whole task:
//   detect failure → classify → remove/deprioritize candidate →
//   select alternative → continue within budget.
// Retries are bounded (the caller enforces BrainBudgetGuard
// iterations); no retry loop runs indefinitely. Fallback selection
// reuses the SAME quality-first semantics as ProviderRoleAssigner —
// free/local never beats a materially better provider when quality
// is required; paid never wins merely for being paid.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId, ProviderCandidateFact } from '@vedmoulya/capability-marketplace';
import type { BrainMode, ProviderRole, ProviderRoleAssignment } from '../types/brain-types.js';
import { CAPABILITY_DEFAULT_ROLE } from './ProviderRoleAssigner.js';
import type { ProviderUsageFact } from '../types/continuous-types.js';
import { UsageIntelligence } from './UsageIntelligence.js';

const LOCAL_FAMILIES = new Set(['ollama', 'lmstudio', 'lm-studio', 'local']);

export interface FallbackSelectionOptions {
  mode: BrainMode;
  qualityTarget: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** How many fallbacks have already been attempted for this capability. */
  attempts: number;
  /** Hard bound on fallbacks per capability (never infinite). */
  maxAttempts: number;
}

/**
 * Selects the next best candidate for a failed capability, mirroring the
 * frozen ProviderRoleAssigner selection semantics (quality-first, free/
 * local when quality is sufficient, user pick respected once).
 */
export class FallbackSelector {
  private readonly usage = new UsageIntelligence();

  select(
    capability: CapabilityId,
    failedProviderId: string,
    candidates: ProviderCandidateFact[],
    usageFacts: ProviderUsageFact[],
    opts: FallbackSelectionOptions,
  ): ProviderRoleAssignment | undefined {
    if (opts.attempts >= opts.maxAttempts) return undefined;

    const remaining = candidates.filter((c) => c.providerId !== failedProviderId && c.configured);
    if (remaining.length === 0) return undefined;

    // Never re-pick the failed provider — rank only the remainder.
    const ranked = this.rank(remaining, usageFacts, opts);
    const next = ranked[0];
    if (!next) return undefined;

    const role = this.roleFor(capability, opts);

    return {
      capability,
      role,
      providerId: next.providerId,
      providerName: next.name,
      modelId: next.modelId,
      quality: next.quality,
      reason: `Failover from ${failedProviderId} — ${this.reasonFor(next, opts)}`,
      evidence: next.evidence.map((e) => e.claim),
    };
  }

  /** Quality-first ranking with free/local preference when quality is sufficient. */
  private rank(
    candidates: ProviderCandidateFact[],
    usageFacts: ProviderUsageFact[],
    opts: FallbackSelectionOptions,
  ): ProviderCandidateFact[] {
    const sorted = [...candidates].sort((a, b) => {
      const qa = a.quality ?? 0;
      const qb = b.quality ?? 0;
      if (qb !== qa) return qb - qa;
      return b.availability - a.availability;
    });
    const needsQuality = opts.qualityTarget === 'HIGH' && opts.mode !== 'COST_SENSITIVE';
    if (!needsQuality) {
      const factsByProvider = new Map<string, ProviderUsageFact[]>();
      for (const fact of usageFacts) {
        const list = factsByProvider.get(fact.providerId) ?? [];
        list.push(fact);
        factsByProvider.set(fact.providerId, list);
      }
      const freeLocal = sorted.find((c) => {
        const facts = factsByProvider.get(c.providerId) ?? [];
        return (
          c.costTier === 'free' ||
          this.usage.isFreeOrLocal(facts) ||
          LOCAL_FAMILIES.has(c.family.toLowerCase())
        );
      });
      if (freeLocal) {
        return [freeLocal, ...sorted.filter((c) => c.providerId !== freeLocal.providerId)];
      }
    }
    return sorted;
  }

  private roleFor(capability: CapabilityId, opts: FallbackSelectionOptions): ProviderRole {
    if (opts.attempts > 0) return 'CRITIC';
    // eslint-disable-next-line security/detect-object-injection -- Closed CAPABILITY_DEFAULT_ROLE record keyed by the capability union.
    return CAPABILITY_DEFAULT_ROLE[capability] ?? 'SPECIALIST';
  }

  private reasonFor(candidate: ProviderCandidateFact, _opts: FallbackSelectionOptions): string {
    const parts: string[] = [];
    if (candidate.quality !== undefined)
      parts.push(`measured quality ${candidate.quality.toFixed(2)}`);
    parts.push(`${candidate.costTier} cost tier`);
    if (LOCAL_FAMILIES.has(candidate.family.toLowerCase())) parts.push('runs locally');
    return `selected ${candidate.providerId} — ${parts.join(', ')}.`;
  }
}
