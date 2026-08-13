// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/requirements
// Product Intelligence & Requirements Engine (EPIC-009)
// The INTELLIGENCE LAYER ABOVE the Application Factory:
//
//   USER IDEA → UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS →
//   DETECT AMBIGUITY → DETECT CONFLICTS → ASK HIGH-VALUE QUESTIONS →
//   SAFE DEFAULTS → COMPLETENESS → PRODUCT BRIEF → DESIGN →
//   ARCHITECTURE → AI/RAG/TOOL STRATEGY → SECURITY → COST → BUILD
//   PLAN → USER APPROVAL → APPLICATION FACTORY → LOOP ENGINE
//
// Reuses (never rebuilds): the AI Runtime (optional enrichment through
// a narrow port), the Application Factory (handoff after approval),
// RAG, the ToolRuntime model, and the frozen persistence conventions.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  ProvenanceSource,
  Provenance,
  RequirementPriority,
  RequirementStatus,
  RequirementCategory,
  Requirement,
  IntentField,
  IntentClaim,
  ProductIntent,
  RequirementSet,
  RequirementNode,
  RequirementEdgeKind,
  RequirementEdge,
  RequirementGraph,
  AmbiguityKind,
  AmbiguityFinding,
  AmbiguityReport,
  QuestionClass,
  QuestionOption,
  QuestionImpacts,
  RequirementQuestion,
  QuestionBundle,
  QuestionPlan,
  SafeDefaultStatus,
  SafeDefault,
  CompletenessVerdict,
  CompletenessArea,
  RequirementCompleteness,
  ConflictSeverity,
  RequirementConflict,
  ProductBrief,
  JourneyPathKind,
  JourneyStep,
  UserJourney,
  InteractionModel,
  ExperienceStrategy,
  DesignSpecification,
  ArchitectureChoice,
  ArchitectureDataEntity,
  ArchitectureApiEndpoint,
  ProductArchitecture,
  AIStrategy,
  RAGSource,
  RAGStrategy,
  ToolRisk,
  ToolStrategyEntry,
  ToolStrategy,
  SecurityPlan,
  CostPlan,
  BuildStep,
  BuildPlan,
  PlanReview,
  ChangeImpact,
  TraceabilityLink,
  TraceabilityIndex,
  RequirementVersion,
  RequirementPhase,
  ChangeImpactRecord,
  RequirementSession,
  HandoffGoal,
} from './types/requirement-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  RequirementSessionStore,
  RequirementEnrichmentPort,
  ClockPort,
} from './contracts/requirement-ports.js';
export { SYSTEM_CLOCK } from './contracts/requirement-ports.js';

// ── Catalog ──────────────────────────────────────────────────────
export {
  ARCHETYPE_KNOWLEDGE,
  knowledgeFor,
  KNOWN_ARCHETYPES,
  IMPACT_WEIGHTS,
  buildDesignSpecification,
} from './catalog/knowledge.js';
export type {
  QuestionTemplate,
  DefaultTemplate,
  DesignPersonality,
  StackChoiceTemplate,
  AIStrategyTemplate,
  RAGStrategyTemplate,
  SecurityBaselineTemplate,
  CostModelTemplate,
  BuildStepTemplate,
  ArchetypeKnowledge,
} from './catalog/knowledge.js';

// ── Domain ───────────────────────────────────────────────────────
export { IntentUnderstandingEngine } from './domain/IntentUnderstandingEngine.js';
export type { IntentUnderstandingInput } from './domain/IntentUnderstandingEngine.js';
export { RequirementExtractionEngine } from './domain/RequirementExtractionEngine.js';
export type { RequirementExtractionInput } from './domain/RequirementExtractionEngine.js';
export { RequirementGraphBuilder } from './domain/RequirementGraphBuilder.js';
export type { GraphBuildInput } from './domain/RequirementGraphBuilder.js';
export { AmbiguityEngine } from './domain/AmbiguityEngine.js';
export type { AmbiguityInput } from './domain/AmbiguityEngine.js';
export { ConflictDetector } from './domain/ConflictDetector.js';
export { RequirementQuestionEngine, rankScore } from './domain/RequirementQuestionEngine.js';
export type { QuestionPlanInput } from './domain/RequirementQuestionEngine.js';
export { SafeDefaultEngine } from './domain/SafeDefaultEngine.js';
export type { SafeDefaultInput } from './domain/SafeDefaultEngine.js';
export { CompletenessEngine } from './domain/CompletenessEngine.js';
export type { CompletenessInput } from './domain/CompletenessEngine.js';
export { ProductBriefGenerator } from './domain/ProductBriefGenerator.js';
export type { BriefInput } from './domain/ProductBriefGenerator.js';
export { UserJourneyEngine } from './domain/UserJourneyEngine.js';
export type { JourneyInput } from './domain/UserJourneyEngine.js';
export { ExperienceStrategyEngine, ALL_MODELS } from './domain/ExperienceStrategyEngine.js';
export type { ExperienceInput } from './domain/ExperienceStrategyEngine.js';
export { DesignIntelligenceEngine } from './domain/DesignIntelligenceEngine.js';
export type { DesignInput } from './domain/DesignIntelligenceEngine.js';
export { ArchitectureIntelligenceEngine } from './domain/ArchitectureIntelligenceEngine.js';
export type { ArchitectureInput } from './domain/ArchitectureIntelligenceEngine.js';
export { AIStrategyEngine } from './domain/AIStrategyEngine.js';
export type { AIStrategyInput } from './domain/AIStrategyEngine.js';
export { RAGStrategyEngine } from './domain/RAGStrategyEngine.js';
export type { RAGStrategyInput } from './domain/RAGStrategyEngine.js';
export { ToolStrategyEngine } from './domain/ToolStrategyEngine.js';
export type { ToolStrategyInput } from './domain/ToolStrategyEngine.js';
export { SecurityPlanner } from './domain/SecurityPlanner.js';
export type { SecurityInput } from './domain/SecurityPlanner.js';
export { CostPlanner } from './domain/CostPlanner.js';
export type { CostInput } from './domain/CostPlanner.js';
export { BuildPlanner } from './domain/BuildPlanner.js';
export type { BuildPlanInput } from './domain/BuildPlanner.js';
export { PlanReviewBuilder } from './domain/PlanReviewBuilder.js';
export type { ReviewInput } from './domain/PlanReviewBuilder.js';
export { ChangeImpactAnalyzer } from './domain/ChangeImpactAnalyzer.js';
export type { ChangeImpactInput } from './domain/ChangeImpactAnalyzer.js';
export { TraceabilityIndexer } from './domain/TraceabilityIndexer.js';
export type { TraceabilityInput } from './domain/TraceabilityIndexer.js';
export { RequirementVersionControl } from './domain/RequirementVersionControl.js';
export type { RequirementVersionControlOptions } from './domain/RequirementVersionControl.js';
export { ProductIntelligenceEngine } from './domain/ProductIntelligenceEngine.js';
export type {
  ProductIntelligenceOptions,
  StartInput,
  AnswerInput,
} from './domain/ProductIntelligenceEngine.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryRequirementSessionStore } from './infrastructure/InMemoryRequirementSessionStore.js';
export { PostgresRequirementSessionStore } from './infrastructure/PostgresRequirementSessionStore.js';

// ── Application ──────────────────────────────────────────────────
export { RequirementsApplicationService } from './application/RequirementsApplicationService.js';
export type {
  RequirementsApplicationServiceOptions,
  RequirementsStartInput,
  RequirementsAnswerInput,
} from './application/RequirementsApplicationService.js';
export { RequirementsMapper } from './application/RequirementsMapper.js';
export type {
  RequirementsStartDTO,
  RequirementsSessionDTO,
  RequirementsSessionSummaryDTO,
  RequirementsApproveDTO,
  RequirementsHandoffDTO,
} from './application/RequirementsDTO.js';
