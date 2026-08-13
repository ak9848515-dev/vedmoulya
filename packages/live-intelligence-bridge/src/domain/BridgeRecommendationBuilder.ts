// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeRecommendationBuilder
// EPIC-017 § Phase 4/6 — the premium "better option found" card.
//
// Assembles a BridgeRecommendation ONLY when a materially better
// option exists and evidence supports it. Every recommendation
// answers: WHY · WHAT evidence · WHEN verified · WHAT risks · WHAT
// permissions · WHAT cost · WHAT free/local alternative · WHAT if the
// user declines. Paid/github/external activation ALWAYS requires
// approval — the bridge never auto-activates.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { IntelligenceOption } from '@vedmoulya/ecosystem-intelligence';
import { AcquisitionClassifier } from './AcquisitionClassifier.js';
import type { BridgeRecommendation } from '../types/bridge-types.js';

export interface RecommendationInput {
  capability: CapabilityId;
  /** The current configured option (what the user has now). */
  current?: { name: string; quality?: number };
  /** The materially-better alternative. */
  best: IntelligenceOption;
  /** Free alternative name (when evidenced). */
  freeAlternative?: string;
  /** Local alternative name (when evidenced). */
  localAlternative?: string;
  now: string;
}

export class BridgeRecommendationBuilder {
  private readonly classifier = new AcquisitionClassifier();

  build(input: RecommendationInput): BridgeRecommendation {
    const { acquisition, reasons } = this.classifier.classify(input.best);
    const approvalRequired = this.approvalRequired(input.best, acquisition);
    const kind =
      acquisition === 'GITHUB_PROJECT' || acquisition === 'OPEN_SOURCE'
        ? 'USEFUL_OPEN_SOURCE_FOUND'
        : acquisition === 'LOCAL_MODEL'
          ? 'FREE_LOCAL_MODEL_AVAILABLE'
          : acquisition === 'PAID'
            ? 'HIGHER_QUALITY_OPTION'
            : 'BETTER_CAPABILITY_FOUND';

    const id = hashId(`${input.capability}|${input.best.name}|${input.now}`);

    return {
      id,
      kind,
      title:
        acquisition === 'PAID'
          ? `Higher-quality option available: ${input.best.name}`
          : acquisition === 'GITHUB_PROJECT' || acquisition === 'OPEN_SOURCE'
            ? `Useful open-source capability found: ${input.best.name}`
            : `Better capability found: ${input.best.name}`,
      capability: input.capability,
      current: input.current,
      recommended: {
        name: input.best.name,
        quality: input.best.quality !== undefined ? Math.round(input.best.quality) : undefined,
        costUsd: input.best.costUsd,
        why: [input.best.reason, ...reasons],
      },
      acquisition,
      security:
        input.best.evidence.some((e) => /github\.com/i.test(e)) ||
        input.best.providerId?.startsWith('discovery:')
          ? 'SECURITY_REVIEW_REQUIRED'
          : input.best.evidence.length > 0
            ? 'TRUSTED_WITH_REVIEW'
            : 'UNKNOWN',
      requires: input.best.requires,
      cost:
        input.best.costUsd !== undefined
          ? {
              amountUsd: input.best.costUsd,
              cadence: input.best.requires.includes('subscription') ? 'monthly' : 'per_use',
            }
          : undefined,
      freeAlternative: input.freeAlternative,
      localAlternative: input.localAlternative,
      approvalRequired,
      state: 'PENDING',
      createdAt: input.now,
    };
  }

  private approvalRequired(best: IntelligenceOption, acquisition: string): boolean {
    // Paid, github, external, download/local install and additional
    // permission all require explicit user approval — never silent.
    if (acquisition === 'PAID') return true;
    if (acquisition === 'GITHUB_PROJECT' || acquisition === 'OPEN_SOURCE') return true;
    if (acquisition === 'EXTERNAL_APPLICATION') return true;
    if (best.requires.includes('additional_permission')) return true;
    if (best.requires.includes('download') || best.requires.includes('local_install')) return true;
    return false;
  }
}

/** Deterministic portable recommendation id (no Node builtins). */
function hashId(seed: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + code) >>> 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
