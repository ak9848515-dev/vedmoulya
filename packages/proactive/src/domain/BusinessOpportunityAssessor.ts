// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · BusinessOpportunityAssessor
// SPRINT-029 — Phase 7 · opportunity → business pipeline.
//
// DISCOVER → RESEARCH → SCORE → BUSINESS CASE → COST/REVENUE ESTIMATE →
// RISK → MVP PLAN → USER APPROVAL → EXECUTION.
//
// This layer performs the FIRST SEVEN steps only. It NEVER spends money,
// registers a company, creates contracts, publishes commercially, creates
// external accounts or makes commitments. Execution happens only after the
// existing approval authority approves — and even then only through the
// existing execution bridge. Score is evidence-based (0 when no evidence);
// cost/revenue estimates appear ONLY when evidence exists (never fabricated).
// ─────────────────────────────────────────────────────────────────────────────

import type { BusinessOpportunityAssessment, EvidenceValue } from '../types/proactive-types.js';

function requiredCapabilitiesPresent(required: string[]): boolean {
  return required.length > 0;
}

export interface BusinessOpportunityInput {
  ownerId: string;
  title: string;
  description: string;
  /** Capabilities the owner already has (evidence of feasibility). */
  availableCapabilities: string[];
  /** Capabilities the opportunity needs. */
  requiredCapabilities: string[];
  /** Prior related task history (evidence the owner works in this area). */
  relatedWork: { objective: string; status: string; createdAt: string }[];
  /** Market/AI-world evidence (relevance, recentness). */
  marketSignals: { title: string; relevance: number; createdAt: string }[];
  now: () => string;
}

/**
 * Score 0..1 from evidence only. Each axis contributes only when evidence
 * exists; with no evidence at all the score is 0 (UNKNOWN stays UNKNOWN).
 */
export class BusinessOpportunityAssessor {
  assess(input: BusinessOpportunityInput): BusinessOpportunityAssessment {
    const evidence: string[] = [];

    const capabilityFit =
      input.requiredCapabilities.length === 0
        ? 0
        : input.requiredCapabilities.filter((c) => input.availableCapabilities.includes(c)).length /
          input.requiredCapabilities.length;
    if (input.requiredCapabilities.length > 0) {
      evidence.push(
        `Capability fit ${Math.round(capabilityFit * 100)}% (${input.availableCapabilities.length} available of ${input.requiredCapabilities.length} required capabilities).`,
      );
    }

    const recentWork = input.relatedWork.filter(
      (w) => Date.now() - Date.parse(w.createdAt) < 90 * 24 * 60 * 60 * 1000,
    ).length;
    if (input.relatedWork.length > 0) {
      evidence.push(`${recentWork} related tasks within the last 90 days.`);
    }

    const relevantSignals = input.marketSignals.filter((s) => s.relevance >= 0.5).length;
    if (input.marketSignals.length > 0) {
      evidence.push(`${relevantSignals} relevant market/AI-world signals.`);
    }

    // Score: capability fit dominates, recent work and market signals add.
    const score = Math.min(
      1,
      capabilityFit * 0.6 + Math.min(0.2, recentWork / 10) + Math.min(0.2, relevantSignals / 5),
    );

    const riskLevel = input.requiredCapabilities.some(
      (c) => !input.availableCapabilities.includes(c),
    )
      ? 'MEDIUM'
      : 'LOW';

    const estimatedCost = this.estimateCost(input.requiredCapabilities);
    const estimatedRevenue = this.estimateRevenue(input.marketSignals);

    const mvpPlan = this.buildMvpPlan(input);

    // Cost/revenue basis notes belong in the business case ONLY when there is
    // genuine evidence; with no evidence at all the case stays honest.
    const businessCase: string[] =
      evidence.length > 0 ? evidence : ['No evidence yet — research before any commitment.'];
    if (requiredCapabilitiesPresent(input.requiredCapabilities)) {
      businessCase.push(
        `Estimated cost basis: ${input.requiredCapabilities.length} required capabilities.`,
      );
    }
    if (input.marketSignals.length > 0) {
      businessCase.push(`Revenue signal basis: ${input.marketSignals.length} market signals.`);
    }

    return {
      id: `ba-${input.now().replace(/\D/g, '').slice(-8)}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      category: this.categorize(input.title, input.description),
      score,
      businessCase,
      estimatedCost,
      estimatedRevenue,
      riskLevel,
      mvpPlan,
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence,
      createdAt: input.now(),
    };
  }

  private categorize(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    if (/youtube|video|content/.test(text)) return 'Content creation';
    if (/saas|app|software|product/.test(text)) return 'SaaS / digital product';
    if (/consult|service|agency/.test(text)) return 'Consulting / services';
    if (/marketplace|e-?commerce|store/.test(text)) return 'Marketplace / commerce';
    return 'Other';
  }

  /** Cost estimate ONLY when required capabilities are identifiable AND the
   *  owner lacks free/local options evidence. Otherwise UNKNOWN. */
  private estimateCost(requiredCapabilities: string[]): EvidenceValue | undefined {
    if (requiredCapabilities.length === 0) return undefined;
    return {
      label: 'Unknown — depends on provider choice (free/local options may apply)',
      status: 'UNKNOWN',
    };
  }

  private estimateRevenue(signals: { relevance: number }[]): EvidenceValue | undefined {
    if (signals.length === 0) return undefined;
    return { label: 'Unknown — no verified revenue data', status: 'UNKNOWN' };
  }

  private buildMvpPlan(input: BusinessOpportunityInput): string[] {
    const steps = ['Research the market (existing AI-world discovery).'];
    if (input.requiredCapabilities.length > 0) {
      steps.push('Map required capabilities to the existing capability catalog.');
    }
    steps.push('Draft the minimum viable deliverable.');
    steps.push('Get explicit user approval before any commitment.');
    steps.push('Execute only through the existing execution bridge (if approved).');
    return steps;
  }
}
