// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S7.1 — Opportunity ranking / recommendation
//
// Answers exactly one question:
//
//     "Which of MY discovered opportunities are worth MY attention, and why?"
//
// This is a RANKING over verdicts that already exist. It creates no scoring
// engine and no second economics model: every number it publishes comes from
// the EXISTING S5.1 canonical qualification (`createOpportunityQualifier` →
// `BusinessOpportunityAssessor`) and, when wired, the EXISTING S6.3 value
// intelligence. The `reasons` it returns are the assessor's OWN deterministic
// evidence lines, rendered verbatim — nothing is invented and no precision is
// added.
//
// The single judgement made here is a PRESENTATION threshold on the existing
// 0..1 score (`RECOMMENDATION_SCORE_THRESHOLD`) plus a refusal to call a
// HIGH-risk opportunity "recommended". Both are labelled as presentation
// policy, not as new intelligence.
//
// Ranking holds NO authority: it cannot approve, cannot qualify (it never
// transitions), cannot launch a Mission, cannot bid or contact anyone. Its
// result type states that structurally (`authorizationRequired: true`,
// `approved: false`).
// ─────────────────────────────────────────────────────────────────────────────

import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import type { OpportunityQualification } from './OpportunityQualification.js';

/**
 * PRESENTATION threshold over the EXISTING canonical 0..1 qualification score.
 * It decides what the UI may label RECOMMENDED — it is not a score, it is not
 * persisted and it grants nothing.
 */
export const RECOMMENDATION_SCORE_THRESHOLD = 0.5;

export interface OpportunityRecommendation {
  opportunityId: string;
  /** External provenance, when the opportunity came from a source. */
  source?: string;
  sourceReference?: string;
  title: string;
  category: string;
  /** The CURRENT lifecycle status — never a manufactured one. */
  status: string;
  /** The EXISTING assessor's 0..1 score, unmodified. */
  score: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** Presentation verdict from the EXISTING score + risk. */
  recommended: boolean;
  /** The EXISTING evidence lines + value-intelligence reasons, verbatim. */
  reasons: string[];
  /** The EXISTING S6.3 overall assessment, when the backend produced one. */
  valueAssessment?: string;
  /** Structural: this type cannot express approval. */
  authorizationRequired: true;
  approved: false;
}

/** Terminal states are not candidates for attention (same rule as the briefing). */
function isActionable(record: OpportunityLifecycleRecord): boolean {
  return record.status !== 'REJECTED' && record.status !== 'COMPLETED';
}

/**
 * Rank ONE owner's opportunities. `records` must already be owner-scoped (the
 * caller reads them through the canonical owner-scoped store), and `qualify` is
 * the EXISTING pure qualifier — it performs no transition, so ranking is safe
 * on any lifecycle state.
 */
export function rankOpportunities(
  records: readonly OpportunityLifecycleRecord[],
  qualify: (record: OpportunityLifecycleRecord) => OpportunityQualification,
): OpportunityRecommendation[] {
  const ranked = records.filter(isActionable).map((record): OpportunityRecommendation => {
    const qualification = qualify(record);
    const { score, riskLevel } = qualification.assessment;
    const value = qualification.valueIntelligence;

    const reasons: string[] = [...qualification.assessment.evidence];
    if (value !== undefined && value.reasons.length > 0) reasons.push(...value.reasons);
    // Honest estimate provenance — a label with its evidence status, never a
    // derived figure.
    if (record.estimatedValue !== undefined) {
      reasons.push(
        `Stated value: ${record.estimatedValue.label} (${record.estimatedValue.status})`,
      );
    }
    if (record.estimatedEffort !== undefined) {
      reasons.push(
        `Stated effort: ${record.estimatedEffort.label} (${record.estimatedEffort.status})`,
      );
    }

    return {
      opportunityId: record.id,
      ...(record.sourceRef !== undefined
        ? { source: record.sourceRef.source, sourceReference: record.sourceRef.sourceReference }
        : {}),
      title: record.title,
      category: record.category,
      status: record.status,
      score,
      riskLevel,
      // Presentation policy: a threshold on the EXISTING score, and a HIGH-risk
      // opportunity is never presented as recommended.
      recommended: score >= RECOMMENDATION_SCORE_THRESHOLD && riskLevel !== 'HIGH',
      reasons,
      ...(value !== undefined ? { valueAssessment: value.overallAssessment } : {}),
      authorizationRequired: true,
      approved: false,
    };
  });

  // Deterministic order: score desc, then discovery order (createdAt asc), then
  // id — so identical evidence always yields an identical list.
  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aRecord = records.find((r) => r.id === a.opportunityId);
    const bRecord = records.find((r) => r.id === b.opportunityId);
    const aCreated = aRecord?.createdAt ?? '';
    const bCreated = bRecord?.createdAt ?? '';
    if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
    return a.opportunityId < b.opportunityId ? -1 : a.opportunityId > b.opportunityId ? 1 : 0;
  });
}
