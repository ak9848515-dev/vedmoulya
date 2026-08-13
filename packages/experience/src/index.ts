// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/experience
// Adaptive Application Experience & Visual Intelligence (EPIC-010)
// The layer ABOVE the Application Factory that makes generated
// applications VISUALLY EXCELLENT, COHERENT, RESPONSIVE, ACCESSIBLE
// and CONTINUOUSLY REVIEWABLE.
//
//   USER IDEA → EPIC-009 → EPIC-007 → EPIC-006 → GENERATE → VISUAL
//   REVIEW → FUNCTIONAL REVIEW → SECURITY REVIEW → UX REVIEW →
//   CRITIQUE → TARGETED REFINEMENT → PREVIEW → APPROVAL → DEPLOY
//
// Reuses (never rebuilds): the EPIC-009 DesignSpecification, the
// Application Factory files, the frozen AI runtime (optional critique
// through a narrow port), RAG and the secure tool model.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  DesignToken,
  ComponentStyleSpec,
  ApplicationDesignSystem,
  DesignDecisionSource,
  DesignDecision,
  BlueprintScreen,
  UIBlueprint,
  ScreenStateId,
  ScreenStateSpec,
  Breakpoint,
  ResponsiveBehavior,
  AccessibilityCategory,
  AccessibilityRequirement,
  CriticSeverity,
  VisualCriticArea,
  EvidenceClass,
  CriticFinding,
  VisualCriticReport,
  QualityDimension,
  QualityVerdict,
  QualityDimensionResult,
  ApplicationQualityEvaluation,
  RefinementImpact,
  RefinementPlan,
  ExperienceEvaluationBundle,
} from './types/experience-types.js';

// ── Optional AI critique seam (Phase 8/11) ───────────────────────
export type {
  AICritiqueInput,
  AICritiqueFinding,
  AICritiqueResult,
  AICritiquePort,
} from './contracts/AICritiquePort.js';

// ── Catalog ──────────────────────────────────────────────────────
export {
  experienceKnowledgeFor,
  buildDesignSystem,
  buildUIBlueprint,
  KNOWN_ARCHETYPES,
} from './catalog/design-knowledge.js';
export type { ArchetypeExperienceKnowledge } from './catalog/design-knowledge.js';

// ── Domain engines (Phases 1–16) ─────────────────────────────────
export { DesignSystemEngine } from './domain/DesignSystemEngine.js';
export type { DesignSystemInput } from './domain/DesignSystemEngine.js';
export { DesignDecisionEngine } from './domain/DesignDecisionEngine.js';
export type { DesignDecisionInput } from './domain/DesignDecisionEngine.js';
export { UIBlueprintEngine } from './domain/UIBlueprintEngine.js';
export type { UIBlueprintInput } from './domain/UIBlueprintEngine.js';
export { StateIntelligenceEngine, ALL_STATES } from './domain/StateIntelligenceEngine.js';
export type { StateIntelligenceInput } from './domain/StateIntelligenceEngine.js';
export {
  ResponsiveIntelligenceEngine,
  BREAKPOINTS,
} from './domain/ResponsiveIntelligenceEngine.js';
export type { ResponsiveIntelligenceInput } from './domain/ResponsiveIntelligenceEngine.js';
export { AccessibilityEngine } from './domain/AccessibilityEngine.js';
export type { AccessibilityInput, AccessibilityCheckResult } from './domain/AccessibilityEngine.js';
export { VisualCriticEngine } from './domain/VisualCriticEngine.js';
export type {
  VisualCriticInput,
  VisualCriticEngineOptions,
  CriticRuleResult,
  RuleContext,
} from './domain/VisualCriticEngine.js';
export { QualityEvaluator, DIMENSIONS } from './domain/QualityEvaluator.js';
export type { QualityInput } from './domain/QualityEvaluator.js';
export { EvidenceClassifier } from './domain/EvidenceClassifier.js';
export type { EvidenceClassifierInput } from './domain/EvidenceClassifier.js';
export { RefinementPlanner } from './domain/RefinementPlanner.js';
export type { RefinementInput } from './domain/RefinementPlanner.js';
export { TraceabilityEngine } from './domain/TraceabilityEngine.js';
export type { TraceabilityInput, TraceabilityLink } from './domain/TraceabilityEngine.js';
export { ExperienceEngine } from './domain/ExperienceEngine.js';
export type {
  ExperienceEngineOptions,
  EvaluateInput,
  RefineInput,
} from './domain/ExperienceEngine.js';

// ── Application service (experience.* contract) ──────────────────
export { ExperienceApplicationService } from './application/ExperienceApplicationService.js';
export type { ExperienceApplicationServiceOptions } from './application/ExperienceApplicationService.js';
export type {
  ExperienceEvaluateDTO,
  ExperienceFindingsDTO,
  ExperienceRefineDTO,
  ExperienceEvaluateInput,
  ExperienceRefineInput,
} from './application/ExperienceDTO.js';
