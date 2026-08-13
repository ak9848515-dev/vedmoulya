// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Completeness Engine
// EPIC-009 — Phase 10. Evaluates requirement completeness per area and
// overall. A numeric score NEVER overrides a critical unknown: if a
// critical unknown remains the verdict is NOT_READY regardless of the
// score (e.g. 98% complete but payment security unresolved → NOT READY).
// ──────────────────────────────────────────────────────────────────

import type {
  CompletenessArea,
  RequirementCategory,
  RequirementCompleteness,
  RequirementSet,
  SafeDefault,
} from '../types/requirement-types.js';

export interface CompletenessInput {
  sessionId: string;
  requirements: RequirementSet;
  defaults: SafeDefault[];
  /** Unanswered BLOCKING questions (by question id). */
  blockingQuestionIds: string[];
}

const AREAS: readonly RequirementCategory[] = [
  'functional',
  'ux',
  'data',
  'security',
  'integration',
  'ai',
  'deployment',
  'performance',
  'scalability',
  'compliance',
  'business_rule',
  'user',
  'non_functional',
];

export class CompletenessEngine {
  evaluate(input: CompletenessInput): RequirementCompleteness {
    const perArea: CompletenessArea[] = AREAS.map((area) => {
      const ids = input.requirements.byCategory[area];
      const areaReqs = input.requirements.requirements.filter((r) => ids.includes(r.id));
      const resolved = areaReqs.filter((r) => r.status !== 'UNKNOWN' && r.status !== 'REJECTED');
      const covered = resolved.map((r) => r.id);
      const gaps = areaReqs
        .filter((r) => r.status === 'UNKNOWN' || r.status === 'REJECTED')
        .map((r) => r.id);
      const score = areaReqs.length === 0 ? 1 : resolved.length / areaReqs.length;
      return { area, score, covered, gaps };
    });

    const scores = perArea.filter((a) => a.covered.length > 0 || a.gaps.length > 0);
    const overall =
      scores.length === 0 ? 0 : scores.reduce((sum, a) => sum + a.score, 0) / scores.length;

    const criticalUnknowns = input.requirements.requirements
      .filter(
        (r) => r.status === 'UNKNOWN' && (r.priority === 'CRITICAL' || r.category === 'security'),
      )
      .map((r) => r.description);
    const importantUnknowns = input.requirements.requirements
      .filter((r) => r.status === 'UNKNOWN' && r.priority === 'HIGH')
      .map((r) => r.description);
    const assumptions = input.defaults
      .filter((d) => d.status === 'proposed' || d.status === 'accepted' || d.status === 'edited')
      .map((d) => `${d.unknown}: ${d.defaultValue}`);

    // The score NEVER overrides a critical unknown.
    const blockedByCritical = criticalUnknowns.length > 0 || input.blockingQuestionIds.length > 0;
    const ready = !blockedByCritical;

    let verdict: RequirementCompleteness['verdict'];
    if (!ready) {
      verdict = 'NOT_READY';
    } else if (
      importantUnknowns.length > 0 ||
      input.defaults.some((d) => d.status === 'proposed')
    ) {
      verdict = 'READY_WITH_ASSUMPTIONS';
    } else {
      verdict = 'READY';
    }

    const confidence = Math.min(
      0.95,
      0.4 +
        overall * 0.4 +
        (input.defaults.filter((d) => d.status !== 'proposed').length > 0 ? 0.1 : 0),
    );

    return {
      sessionId: input.sessionId,
      score: round2(overall),
      confidence: round2(confidence),
      criticalUnknowns,
      importantUnknowns,
      assumptions,
      ready,
      perArea,
      verdict,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
