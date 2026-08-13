// ──────────────────────────────────────────────────────────────────
// VedMoulya — Live Intelligence Bridge · BridgeCandidateAssembler
// EPIC-017 § Phase 1 — the structured candidate view model.
//
// Normalizes EXISTING intelligence facts (TaskIntelligenceResult
// options + capability candidates) into the bridge's structured
// BridgeCandidate shape:
//   candidate · capability · provider · model · integrationType ·
//   qualityEvidence · taskFit · securityStatus · availability ·
//   costClass · freeTierStatus · localAvailability · confidence ·
//   recommendation · approvalRequired
//
// NOTHING is fabricated: fields derive only from evidence present in
// the option; missing evidence → UNKNOWN. Approval requirements are
// derived deterministically (paid / github / external / irreversible).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { IntelligenceOption } from '@vedmoulya/ecosystem-intelligence';
import type { AcquisitionClass, BridgeCandidate } from '../types/bridge-types.js';
import { AcquisitionClassifier } from './AcquisitionClassifier.js';

const APPROVAL_REQUIRING_CLASSES: ReadonlySet<AcquisitionClass> = new Set([
  'PAID',
  'GITHUB_PROJECT',
  'EXTERNAL_APPLICATION',
  'OPEN_SOURCE',
]);

export interface AssemblyOptions {
  capability: CapabilityId;
  /** 0..100 quality floor for the task (from the intent). */
  qualityFloor: number;
  /** The intelligence option to normalize (untrusted input). */
  option: IntelligenceOption;
  /** True when the option is already configured (usable now). */
  configured?: boolean;
}

export class BridgeCandidateAssembler {
  private readonly classifier = new AcquisitionClassifier();

  assemble(input: AssemblyOptions): BridgeCandidate {
    const { acquisition } = this.classifier.classify(input.option);
    const quality =
      input.option.quality !== undefined ? Math.round(input.option.quality) : undefined;

    const recommendation: BridgeCandidate['recommendation'] =
      quality !== undefined && quality < input.qualityFloor
        ? 'IGNORE'
        : input.option.kind === 'BEST_CONFIGURED' || input.option.kind === 'BEST_AVAILABLE_NOW'
          ? 'CONSIDER'
          : 'RECOMMEND';

    return {
      candidate: input.option.name,
      capability: input.capability,
      provider: input.option.providerId,
      model: input.option.name,
      integrationType: this.integrationTypeOf(input.option, acquisition),
      quality,
      qualityEvidence: input.option.evidence,
      taskFit: input.option.reason,
      securityStatus: this.securityStatusOf(input.option),
      availability:
        input.option.requires.length === 0 || input.configured
          ? 'AVAILABLE'
          : acquisition === 'PAID' ||
              acquisition === 'GITHUB_PROJECT' ||
              acquisition === 'EXTERNAL_APPLICATION'
            ? 'CONFIGURE'
            : 'AVAILABLE',
      costClass: acquisition,
      freeTierStatus: this.freeTierStatusOf(input.option),
      localAvailability: input.option.localAvailability ?? 'UNKNOWN',
      confidence: this.confidenceOf(input.option),
      recommendation,
      approvalRequired: input.configured
        ? false
        : APPROVAL_REQUIRING_CLASSES.has(acquisition) ||
          input.option.requires.includes('additional_permission'),
      source: this.sourceOf(input.option, input.configured),
    };
  }

  private integrationTypeOf(option: IntelligenceOption, acquisition: AcquisitionClass): string {
    if (acquisition === 'EXTERNAL_APPLICATION') return 'EXTERNAL_APPLICATION';
    if (acquisition === 'GITHUB_PROJECT' || acquisition === 'OPEN_SOURCE') return 'OPEN_SOURCE';
    if (acquisition === 'LOCAL_MODEL') return 'LOCAL_MODEL';
    if (option.localAvailability === 'yes') return 'LOCAL_MODEL';
    if (option.requires.includes('external_application')) return 'EXTERNAL_APPLICATION';
    if (option.providerId) return 'DIRECT_PROVIDER';
    return 'UNKNOWN';
  }

  private securityStatusOf(option: IntelligenceOption): string {
    // GitHub/open-source candidates are UNTRUSTED until security review.
    if (
      option.providerId?.startsWith('discovery:') ||
      option.evidence.some((e) => /github\.com/i.test(e))
    ) {
      return 'SECURITY_REVIEW_REQUIRED';
    }
    if (option.requires.includes('external_application')) {
      return 'REVIEW_EXTERNAL_TOOL';
    }
    return option.evidence.length > 0 ? 'TRUSTED_WITH_REVIEW' : 'UNKNOWN';
  }

  private freeTierStatusOf(option: IntelligenceOption): BridgeCandidate['freeTierStatus'] {
    if (option.freeClass === 'FREE_API' || option.freeClass === 'OPEN_WEIGHTS') return 'FREE';
    if (option.freeClass === 'FREE_WITH_QUOTA') return 'FREE_WITH_QUOTA';
    if (option.costUsd !== undefined) return 'PAID';
    if (option.requires.includes('subscription') || option.requires.includes('api_key'))
      return 'PAID';
    return 'UNKNOWN';
  }

  private confidenceOf(option: IntelligenceOption): BridgeCandidate['confidence'] {
    if (option.evidence.length >= 2) return 'VERIFIED';
    if (option.evidence.length === 1) return 'MEASURED';
    return 'UNKNOWN';
  }

  private sourceOf(option: IntelligenceOption, configured?: boolean): BridgeCandidate['source'] {
    if (configured) return 'configured';
    if (option.providerId?.startsWith('discovery:')) return 'ai-world';
    if (option.localAvailability === 'yes') return 'local-model';
    if (option.providerId) return 'provider-intelligence';
    if (option.requires.includes('external_application')) return 'external';
    return 'UNKNOWN';
  }
}
