// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeComparisonBuilder
// EPIC-017 § Phase 2 — FIND BETTER CAPABILITY.
//
// Compares CURRENT CONFIGURATION vs AVAILABLE ALTERNATIVES for a
// capability using the intelligence layer's quality-first evaluation.
// The comparison exposes STRUCTURED decision evidence (task fit,
// capability match, quality evidence, availability, cost class,
// security status, reason) — never hidden chain-of-thought.
//
// FREE never beats QUALITY; a paid option is never auto-selected; a
// GitHub repository is never trusted implicitly.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { TaskIntelligenceResult } from '@vedmoulya/ecosystem-intelligence';
import type { BridgeCandidate, BridgeComparison } from '../types/bridge-types.js';
import { BridgeCandidateAssembler } from './BridgeCandidateAssembler.js';

export interface ComparisonInput {
  capability: CapabilityId;
  /** Quality floor (0..100) derived from the task intent. */
  qualityFloor: number;
  /** The intelligence result for this capability. */
  result: TaskIntelligenceResult;
}

export class BridgeComparisonBuilder {
  private readonly assembler = new BridgeCandidateAssembler();

  build(input: ComparisonInput): BridgeComparison {
    const { result } = input;

    // Current = the configured option (usable now), never the hypothetical best.
    const currentOption = result.options.find((o) => o.kind === 'BEST_CONFIGURED');
    const usableNow = result.options.find((o) => o.kind === 'BEST_AVAILABLE_NOW');

    // The materially-better alternative = the recommended option when one exists.
    const bestOption = result.options.find((o) => o.kind === 'BEST_PAID') ?? result.options[0];

    const current: BridgeComparison['current'] = currentOption
      ? {
          name: currentOption.name,
          quality:
            currentOption.quality !== undefined ? Math.round(currentOption.quality) : undefined,
        }
      : usableNow
        ? {
            name: usableNow.name,
            quality: usableNow.quality !== undefined ? Math.round(usableNow.quality) : undefined,
          }
        : undefined;

    const notBetter = (): BridgeComparison => ({
      capability: input.capability,
      current,
      alternative: undefined,
      why: ['No materially better option requires activation.'],
      betterOptionAvailable: false,
      requiresApproval: false,
      materialImprovement: false,
    });

    if (!bestOption || !result.betterOptionAvailable) {
      return notBetter();
    }

    const alternative: BridgeCandidate = this.assembler.assemble({
      capability: input.capability,
      qualityFloor: input.qualityFloor,
      option: bestOption,
      configured: bestOption.kind === 'BEST_CONFIGURED' || bestOption.kind === 'BEST_AVAILABLE_NOW',
    });

    return {
      capability: input.capability,
      current,
      alternative,
      why: this.why(bestOption, current, alternative),
      betterOptionAvailable: true,
      requiresApproval: alternative.approvalRequired,
      materialImprovement: true,
    };
  }

  private why(
    best: NonNullable<TaskIntelligenceResult['options'][number]>,
    current: BridgeComparison['current'],
    alternative: BridgeCandidate,
  ): string[] {
    const reasons = [best.reason];
    if (alternative.quality !== undefined) {
      const currentQuality = current?.quality;
      if (currentQuality !== undefined && alternative.quality >= currentQuality) {
        reasons.push(
          `Quality ${alternative.quality} vs current ${currentQuality} — evidence-backed.`,
        );
      }
    }
    if (alternative.costClass === 'FREE_WITH_QUOTA' || alternative.costClass === 'FREE_API') {
      reasons.push(
        `Free-within-quota/free option at acceptable quality — preferred only when quality is sufficient.`,
      );
    }
    if (
      alternative.securityStatus !== 'UNKNOWN' &&
      alternative.securityStatus !== 'SECURITY_REVIEW_REQUIRED'
    ) {
      reasons.push(`Security: ${alternative.securityStatus}.`);
    }
    return reasons.slice(0, 4);
  }
}
