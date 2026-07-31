// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Domain Layer
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// Exports: entities, value objects, events, services, repository,
//          factory, and business rules
// ──────────────────────────────────────────────────────────────────

// ── Value Objects ─────────────────────────────────────────────────────────
export type { DecisionId } from './value-objects/DecisionId.js';
export { createDecisionId, generateDecisionId } from './value-objects/DecisionId.js';
export { DecisionStatus } from './value-objects/DecisionStatus.js';
export type { DecisionStatusValue } from './value-objects/DecisionStatus.js';
export { DecisionPriority } from './value-objects/DecisionPriority.js';
export type { PriorityLevel } from './value-objects/DecisionPriority.js';
export { DecisionConfidence } from './value-objects/DecisionConfidence.js';
export type { DecisionConfidenceLevel } from './value-objects/DecisionConfidence.js';
export { DecisionScore } from './value-objects/DecisionScore.js';
export type { CriterionScore } from './value-objects/DecisionScore.js';
export { DecisionRisk } from './value-objects/DecisionRisk.js';
export type { RiskLevel } from './value-objects/DecisionRisk.js';
export { DecisionOpportunity } from './value-objects/DecisionOpportunity.js';
export type { OpportunityLevel } from './value-objects/DecisionOpportunity.js';
export { DecisionVersion } from './value-objects/DecisionVersion.js';
export { DecisionConstraint } from './value-objects/DecisionConstraint.js';
export type { ConstraintType, ConstraintCategory } from './value-objects/DecisionConstraint.js';
export { DecisionReasoning } from './value-objects/DecisionReasoning.js';
export type { ReasoningMethod } from './value-objects/DecisionReasoning.js';
export { DecisionOutcome } from './value-objects/DecisionOutcome.js';
export type { OutcomeResult } from './value-objects/DecisionOutcome.js';

// ── Entities ──────────────────────────────────────────────────────────────
export { Decision } from './entities/Decision.js';
export type {
  DecisionOption,
  DecisionRequest,
  DecisionEvidence,
  DecisionCategory,
  DecisionInitiator,
} from './entities/Decision.js';

// ── Domain Events ─────────────────────────────────────────────────────────
export type { DecisionEvent, DecisionEventType } from './events/DecisionEvent.js';
export { createDecisionEvent } from './events/DecisionEvent.js';

// ── Repository ────────────────────────────────────────────────────────────
export type { DecisionRepository, DecisionSearchParams } from './repository/DecisionRepository.js';

// ── Domain Services ───────────────────────────────────────────────────────
export { DecisionDomainService } from './services/DecisionDomainService.js';
export type {
  OptionRanking,
  Recommendation,
  TradeoffAnalysis,
} from './services/DecisionDomainService.js';
// Note: `DomainOperationResult` is intentionally not re-exported from here
// to avoid ambiguous export conflicts with the Memory Engine context.

// ── Factory ───────────────────────────────────────────────────────────────
export { DecisionFactory } from './factory/DecisionFactory.js';
export type { CreateDecisionCommand, DecisionFactoryResult } from './factory/DecisionFactory.js';

// ── Business Rules ────────────────────────────────────────────────────────
// Note: `validate`, `Rule`, and `RuleResult` are intentionally not re-exported
// from here to avoid ambiguous export conflicts with the Identity context.
// Import them directly: import { validate } from '@vedmoulya/domain/decision/rules/DecisionRules';
export {
  decisionContentRule,
  reasoningRequiredRule,
  outcomeRequiredRule,
  optionsRequiredRule,
} from './rules/DecisionRules.js';
