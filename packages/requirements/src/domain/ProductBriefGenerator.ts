// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Product Brief Generator
// EPIC-009 — Phase 12. Produces the human-readable ProductBrief with
// all 18 sections, derived deterministically from the confirmed
// intent + requirements + knowledge. This is the product definition
// the user reviews before any technical planning.
// ──────────────────────────────────────────────────────────────────

import type {
  ProductBrief,
  ProductIntent,
  Requirement,
  RequirementSet,
  SafeDefault,
} from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface BriefInput {
  sessionId: string;
  intent: ProductIntent;
  requirements: RequirementSet;
  defaults: SafeDefault[];
}

export class ProductBriefGenerator {
  generate(input: BriefInput): ProductBrief {
    const k = knowledgeFor(input.intent.archetype);
    const confirmed = input.requirements.requirements.filter(
      (r) => r.status === 'CONFIRMED' || r.status === 'PROPOSED',
    );
    const byCategory = (cat: Requirement['category']): string[] =>
      confirmed.filter((r) => r.category === cat).map((r) => r.description);

    const journeys = k.journeyActors.flatMap((a) =>
      a.journeys.filter((j) => j.path === 'happy').map((j) => `${a.actor} — ${j.name}`),
    );

    const openQuestions = input.requirements.requirements
      .filter((r) => r.status === 'UNKNOWN')
      .map((r) => r.description);

    return {
      sessionId: input.sessionId,
      problem: input.intent.problem ?? 'A problem worth solving with software.',
      targetUsers: input.intent.targetUsers,
      goals:
        input.intent.knownFeatures.length > 0
          ? input.intent.knownFeatures
          : [`Deliver a ${k.label}`],
      nonGoals: k.nonGoals,
      features: confirmed.filter((r) => r.category === 'functional').map((r) => r.description),
      userJourneys: journeys,
      businessRules: byCategory('business_rule'),
      data: byCategory('data'),
      integrations: byCategory('integration'),
      aiCapabilities: byCategory('ai'),
      uxStrategy: `${k.design.visualPersonality}. Primary interaction model: ${k.experience.primaryModel}.`,
      security: byCategory('security'),
      performance: byCategory('performance'),
      scalability: byCategory('scalability'),
      deployment: byCategory('deployment'),
      assumptions: input.defaults
        .filter((d) => d.status !== 'rejected')
        .map((d) => `${d.unknown}: ${d.defaultValue}`),
      openQuestions,
      successCriteria: input.intent.successCriteria,
    };
  }
}
