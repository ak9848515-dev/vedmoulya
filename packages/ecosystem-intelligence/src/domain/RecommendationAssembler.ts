// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// RecommendationAssembler — EPIC-015
//
// Builds the premium, simple approval recommendation:
//   • BETTER_CAPABILITY_FOUND     — better provider/API for this task
//   • USEFUL_OPEN_SOURCE_FOUND    — GitHub project worth review
//   • FREE_LOCAL_MODEL_AVAILABLE  — free local model for this hardware
// Cost stays UNKNOWN unless evidenced. Downloading, installing and
// paid subscriptions ALWAYS require explicit approval.
// ──────────────────────────────────────────────────────────────────

import type { IntelligenceRecommendation } from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';
import type { ProviderCandidateFact } from '@vedmoulya/capability-marketplace';
import type {
  LicenseIntelligence,
  RepositorySecurityAssessment,
} from '../types/intelligence-types.js';

export interface BetterCapabilityInput {
  current?: { name: string; quality?: number };
  recommended: { name: string; quality?: number; costUsd?: number };
  why: string[];
  requires: string[];
  risks: string[];
  /**
   * Optional stable id: the application service reuses a pending
   * recommendation's id so refetches never accumulate duplicate PENDING
   * records and a dismissed suggestion is not silently re-offered.
   */
  id?: string;
}

export interface OpenSourceInput {
  repository: string;
  purpose: string;
  license?: LicenseIntelligence;
  security?: RepositorySecurityAssessment;
  capabilities: string[];
  evidence: string[];
  risks: string[];
}

export interface LocalModelInput {
  name: string;
  sizeGb?: number;
  ramGb?: number;
  vramGb?: number;
  capabilities: string[];
  qualityEvidence: string[];
  privacyBenefit: string;
}

export class RecommendationAssembler {
  private sequence = 0;

  constructor(private readonly clock: ClockPort) {}

  betterCapability(input: BetterCapabilityInput): IntelligenceRecommendation {
    const id = input.id ?? this.nextId('better');
    return {
      id,
      kind: 'BETTER_CAPABILITY_FOUND',
      title: 'Better capability found',
      current: input.current,
      recommended: {
        name: input.recommended.name,
        quality: input.recommended.quality,
        costUsd: input.recommended.costUsd,
        why: input.why,
      },
      requires: input.requires,
      risks: input.risks,
      actions: ['use_recommended', 'continue_with_current', 'review_details', 'dont_suggest_again'],
      cost:
        input.recommended.costUsd !== undefined
          ? { amountUsd: input.recommended.costUsd, cadence: 'per_use' }
          : { cadence: 'UNKNOWN' },
      createdAt: this.clock.now(),
    };
  }

  openSource(input: OpenSourceInput): IntelligenceRecommendation {
    const id = this.nextId('oss');
    const licenseNote = input.license
      ? input.license.verdict === 'LICENSE_UNKNOWN'
        ? 'License could not be established — not auto-approved for commercial factory use.'
        : `License: ${input.license.license ?? input.license.software.verdict}`
      : 'License: UNKNOWN';
    const securityNote = input.security
      ? input.security.classification === 'BLOCKED'
        ? 'Security: BLOCKED — this repository must never be executed.'
        : input.security.classification === 'SECURITY_REVIEW_REQUIRED'
          ? 'Security: review required — cannot be sandboxed in this environment.'
          : input.security.blockingIndicators.length === 0
            ? 'Security: no blocking indicators found in the checks performed.'
            : `Security: ${input.security.classification.toLowerCase()} — see checks.`
      : 'Security: UNKNOWN';
    return {
      id,
      kind: 'USEFUL_OPEN_SOURCE_FOUND',
      title: 'Useful open-source capability found',
      recommended: {
        name: input.repository,
        why: [input.purpose, licenseNote, securityNote],
      },
      requires: ['github_connection', 'additional_permission'],
      risks:
        input.risks.length > 0
          ? input.risks
          : ['Untrusted third-party code — security review must complete before any execution.'],
      actions:
        input.security?.classification === 'BLOCKED'
          ? ['ignore']
          : ['review_and_configure', 'open_repository', 'ignore'],
      createdAt: this.clock.now(),
    };
  }

  localModel(input: LocalModelInput): IntelligenceRecommendation {
    const id = this.nextId('local');
    const size = input.sizeGb ? `${input.sizeGb} GB` : 'size UNKNOWN';
    const ram = input.ramGb
      ? `${input.ramGb} GB RAM`
      : input.vramGb
        ? `${input.vramGb} GB VRAM`
        : 'hardware UNKNOWN';
    return {
      id,
      kind: 'FREE_LOCAL_MODEL_AVAILABLE',
      title: 'Free local model available',
      recommended: {
        name: input.name,
        why: [
          `${size} · ${ram}`,
          input.privacyBenefit,
          'Quality is the deciding factor — free alone is never a reason to switch.',
        ],
      },
      requires: ['download', 'local_install'],
      risks: ['Local installation requires suitable hardware — verify RAM/VRAM before download.'],
      actions: ['download', 'review_details', 'continue_with_current'],
      cost: { amountUsd: 0, cadence: 'one_time' },
      createdAt: this.clock.now(),
    };
  }

  /** Cheap fixture helper for deterministic tests. */
  fromProvider(
    current: ProviderCandidateFact | undefined,
    recommended: ProviderCandidateFact,
  ): IntelligenceRecommendation {
    return this.betterCapability({
      current: current ? { name: current.name, quality: current.quality } : undefined,
      recommended: {
        name: recommended.name,
        quality: recommended.quality,
        costUsd: recommended.estimatedCostUsd,
      },
      why: ['Higher quality for this task (quality-first selection).'],
      requires: recommended.configured ? [] : ['api_key'],
      risks: ['Provider configuration required before use.'],
    });
  }

  private nextId(kind: string): string {
    this.sequence += 1;
    return `${kind}-${this.sequence}-${this.clock.now()}`;
  }
}
