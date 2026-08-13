// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Plan Review Builder
// EPIC-009 — Phase 23. Before generation the user sees: WHAT I
// UNDERSTOOD, WHAT YOU EXPLICITLY REQUESTED, WHAT I INFERRED, WHAT I
// DON'T KNOW, QUESTIONS, ASSUMPTIONS, PRODUCT SPECIFICATION, USER
// JOURNEYS, DESIGN DIRECTION, ARCHITECTURE, AI STRATEGY, RAG STRATEGY,
// TOOLS, SECURITY, COST, BUILD PLAN — then APPROVE / MODIFY / ANSWER
// QUESTIONS / CANCEL. No large generation happens before approval.
// ──────────────────────────────────────────────────────────────────

import type {
  AIStrategy,
  BuildPlan,
  CostPlan,
  DesignSpecification,
  ExperienceStrategy,
  PlanReview,
  ProductArchitecture,
  ProductBrief,
  ProductIntent,
  RAGStrategy,
  RequirementQuestion,
  RequirementSet,
  SafeDefault,
  SecurityPlan,
  ToolStrategy,
  UserJourney,
} from '../types/requirement-types.js';

export interface ReviewInput {
  sessionId: string;
  intent: ProductIntent;
  requirements: RequirementSet;
  questions: RequirementQuestion[];
  defaults: SafeDefault[];
  brief: ProductBrief;
  journeys: UserJourney[];
  experience: ExperienceStrategy;
  design: DesignSpecification;
  architecture: ProductArchitecture;
  aiStrategy: AIStrategy;
  ragStrategy: RAGStrategy;
  tools: ToolStrategy;
  security: SecurityPlan;
  cost: CostPlan;
  buildPlan: BuildPlan;
  /** True only when no critical unknowns and no unanswered BLOCKING questions. */
  ready: boolean;
}

export class PlanReviewBuilder {
  build(input: ReviewInput): PlanReview {
    const confirmed = input.requirements.requirements.filter((r) => r.status === 'CONFIRMED');
    const unknown = input.requirements.requirements.filter((r) => r.status === 'UNKNOWN');
    const inferred = input.requirements.requirements.filter(
      (r) => r.source === 'INFERENCE' || r.source === 'DEFAULT',
    );

    return {
      sessionId: input.sessionId,
      whatIUnderstood: [
        input.intent.problem ?? '',
        `Application type: ${input.intent.applicationType ?? 'web application'}`,
        `Target users: ${input.intent.targetUsers.join(', ')}`,
        `Platforms: ${input.intent.platforms.join(', ')}`,
      ].filter((s) => s.length > 0),
      explicitlyRequested: confirmed.map((r) => r.description),
      inferred: inferred.slice(0, 12).map((r) => `${r.description} (${r.source.toLowerCase()})`),
      dontKnow: unknown.map((r) => r.description),
      questions: input.questions,
      assumptions: input.defaults,
      brief: input.brief,
      journeys: input.journeys,
      designDirection: input.design.visualPersonality,
      architecture: input.architecture,
      aiStrategy: input.aiStrategy,
      ragStrategy: input.ragStrategy,
      tools: input.tools,
      security: input.security,
      cost: input.cost,
      buildPlan: input.buildPlan,
      ready: input.ready,
    };
  }
}
