// ──────────────────────────────────────────────────────────────────
// VedMoulya — Hardware Compatibility Service
// EPIC-012A — AI Provider Intelligence (Phase 11)
//
// Hardware-aware local model selection. Given a hardware spec (RAM,
// VRAM, GPU, CPU, storage — each optional) and a model size estimate,
// classify the fit:
//   SAFE            — comfortably within RAM/storage; GPU fast path when present.
//   POSSIBLE_SLOW   — runs but likely slow (CPU-only or near memory limits).
//   NOT_RECOMMENDED — runs with difficulty / heavy swap.
//   UNSUPPORTED     — cannot run (insufficient memory or storage).
//   UNKNOWN         — hardware not reported; never guess.
//
// A model is never recommended solely because it is free — fit is a
// hard gate, not a scoring bonus.
// ──────────────────────────────────────────────────────────────────

import type {
  HardwareCompatibilityProfile,
  HardwareFitAssessment,
  HardwareSpec,
} from '../../types/intelligence-types.js';

export interface HardwareFitFacts {
  modelId: string;
  name: string;
  /** Estimated weight size in GB (registry/declared). 0 = unknown. */
  estimatedSizeGb: number;
  /** Quantization factor (4-bit ≈ 0.55, 8-bit ≈ 1.0, fp16 ≈ 2.0). */
  quantizationFactor?: number;
}

/** Approximate RAM overhead (OS + runtime + KV cache) in GB. */
const SYSTEM_OVERHEAD_GB = 4;
/** Minimum comfortable free RAM beyond the model. */
const COMFORT_MARGIN_GB = 2;

export class HardwareCompatibilityService {
  /**
   * Assess local fit for a list of models against one hardware spec.
   * Deterministic; every verdict carries human-readable reasons.
   */
  assess(hardware: HardwareSpec, models: HardwareFitFacts[]): HardwareCompatibilityProfile {
    const hardwareKnown =
      hardware.ramGb !== undefined ||
      hardware.storageGb !== undefined ||
      hardware.vramGb !== undefined;

    const assessments = models.map((model) => this.assessOne(hardware, model, hardwareKnown));

    const summary = {
      safe: assessments.filter((a) => a.verdict === 'SAFE').length,
      possibleSlow: assessments.filter((a) => a.verdict === 'POSSIBLE_SLOW').length,
      notRecommended: assessments.filter((a) => a.verdict === 'NOT_RECOMMENDED').length,
      unsupported: assessments.filter((a) => a.verdict === 'UNSUPPORTED').length,
      unknown: assessments.filter((a) => a.verdict === 'UNKNOWN').length,
    };

    return { hardware, hardwareKnown, assessments, summary };
  }

  private assessOne(
    hardware: HardwareSpec,
    model: HardwareFitFacts,
    hardwareKnown: boolean,
  ): HardwareFitAssessment {
    const reasons: string[] = [];
    if (model.estimatedSizeGb <= 0) {
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'UNKNOWN',
        reasons: ['model size not reported — cannot assess fit without guessing'],
      };
    }
    if (!hardwareKnown) {
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'UNKNOWN',
        reasons: ['hardware not reported — fit cannot be verified (never guessed)'],
      };
    }

    const factor = model.quantizationFactor ?? 1;
    const effectiveGb = model.estimatedSizeGb * factor;

    // Storage gate first — a model that does not fit on disk is UNSUPPORTED.
    if (hardware.storageGb !== undefined && effectiveGb > hardware.storageGb) {
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'UNSUPPORTED',
        reasons: [
          `requires ~${effectiveGb.toFixed(1)} GB storage but only ${hardware.storageGb} GB available`,
        ],
      };
    }

    // GPU fast path: fits in VRAM → SAFE.
    if (hardware.vramGb !== undefined && effectiveGb <= hardware.vramGb) {
      reasons.push(`fits in ${hardware.vramGb} GB VRAM (fast GPU path)`);
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'SAFE',
        reasons,
      };
    }

    // CPU path: model must fit in system RAM minus overhead + comfort margin.
    const ramAvailable =
      hardware.ramGb !== undefined ? hardware.ramGb - SYSTEM_OVERHEAD_GB : undefined;
    if (ramAvailable === undefined) {
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'UNKNOWN',
        reasons: ['system RAM not reported — CPU fit cannot be verified'],
      };
    }

    if (effectiveGb > ramAvailable) {
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'UNSUPPORTED',
        reasons: [
          `requires ~${effectiveGb.toFixed(1)} GB RAM but only ~${ramAvailable.toFixed(1)} GB available after system overhead`,
        ],
      };
    }

    if (effectiveGb + COMFORT_MARGIN_GB <= ramAvailable && hardware.hasGpu !== true) {
      reasons.push(`fits in ${ramAvailable.toFixed(1)} GB usable RAM (CPU path)`);
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'SAFE',
        reasons,
      };
    }

    if (effectiveGb + COMFORT_MARGIN_GB <= ramAvailable && hardware.hasGpu === true) {
      reasons.push(
        `does not fit in VRAM (${hardware.vramGb ?? 'unknown'} GB) but fits in ${ramAvailable.toFixed(1)} GB usable RAM — CPU fallback, slower than GPU`,
      );
      return {
        modelId: model.modelId,
        name: model.name,
        estimatedSizeGb: model.estimatedSizeGb,
        verdict: 'POSSIBLE_SLOW',
        reasons,
      };
    }

    reasons.push(
      `tight fit: ~${effectiveGb.toFixed(1)} GB against ~${ramAvailable.toFixed(1)} GB usable RAM — expect slow performance or heavy swap`,
    );
    return {
      modelId: model.modelId,
      name: model.name,
      estimatedSizeGb: model.estimatedSizeGb,
      verdict: 'NOT_RECOMMENDED',
      reasons,
    };
  }
}
