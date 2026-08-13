// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · CriticStrategy
// EPIC-016 §16 — Critic loop.
//
// EXECUTE → CRITIQUE → REFINE → VERIFY. The Brain decides whether
// critique is necessary. Simple task → minimal verification.
// High-risk task → strong verification. Complex task → multi-critic
// evaluation. Critics should be independent of the generator when
// possible.
// ──────────────────────────────────────────────────────────────────

import type { BrainMode, QualityTarget } from '../types/brain-types.js';

export interface CriticDecision {
  /** How many independent critics to run. */
  criticCount: number;
  /** Whether refinement is permitted after critique. */
  allowRefine: boolean;
  /** Max bounded refinement rounds (never endless). */
  maxRefineRounds: number;
  /** Human-readable reason. */
  reason: string;
}

export class CriticStrategy {
  decide(ctx: {
    mode: BrainMode;
    qualityTarget: QualityTarget;
    capabilityCount: number;
    privacyRequirement: 'PRIVATE' | 'STANDARD' | 'UNKNOWN';
    evidenceRequirement: 'NONE' | 'OPTIONAL' | 'REQUIRED' | 'STRONG_REQUIRED';
  }): CriticDecision {
    const { mode, qualityTarget, capabilityCount, evidenceRequirement } = ctx;

    // High-risk: publishable / irreversible outputs or strong evidence needs.
    if (evidenceRequirement === 'STRONG_REQUIRED') {
      return {
        criticCount: 2,
        allowRefine: true,
        maxRefineRounds: 2,
        reason: 'Strong evidence requirement — independent critics verify citations and claims.',
      };
    }

    if (mode === 'DEEP_RESEARCH' || mode === 'QUALITY') {
      return {
        criticCount: 2,
        allowRefine: true,
        maxRefineRounds: 2,
        reason: `${mode} mode — independent critic pair evaluates quality and consistency.`,
      };
    }

    if (qualityTarget === 'HIGH' && capabilityCount >= 3) {
      return {
        criticCount: 1,
        allowRefine: true,
        maxRefineRounds: 1,
        reason:
          'High quality target on a complex task — one independent critic with bounded refinement.',
      };
    }

    if (capabilityCount <= 2 && mode === 'FAST') {
      return {
        criticCount: 0,
        allowRefine: false,
        maxRefineRounds: 0,
        reason: 'Simple, fast task — minimal verification; critique would add no value.',
      };
    }

    return {
      criticCount: 1,
      allowRefine: false,
      maxRefineRounds: 0,
      reason: 'Standard task — single lightweight check; refinement not required.',
    };
  }
}
