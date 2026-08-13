// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence & Requirements Engine: Types
// EPIC-009 — the INTELLIGENCE LAYER ABOVE the Application Factory.
//
//   USER IDEA → UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS →
//   DETECT AMBIGUITY → DETECT CONFLICTS → ASK HIGH-VALUE QUESTIONS →
//   SAFE DEFAULTS → COMPLETENESS → PRODUCT BRIEF → DESIGN →
//   ARCHITECTURE → AI/RAG/TOOL STRATEGY → SECURITY → COST → BUILD
//   PLAN → USER APPROVAL → APPLICATION FACTORY → LOOP ENGINE
//
// This layer defines TYPES ONLY. It never executes AI directly, never
// writes files, never builds applications — it produces a complete,
// prov-enanced product definition that the frozen factory consumes
// after user approval.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { AppArchetype, DeploymentTargetId } from '@vedmoulya/app-factory';

// ── Provenance (Phase 1/3) ──────────────────────────────────────────────────

/** Where every important claim came from. Never silently upgrade inference
 *  to user-provided fact. */
export type ProvenanceSource =
  'USER' | 'INFERENCE' | 'QUESTION' | 'DEFAULT' | 'MEMORY' | 'RAG' | 'SYSTEM';

export interface Provenance {
  source: ProvenanceSource;
  /** 0..1 — how sure we are of this claim. */
  confidence: number;
  detail?: string;
}

// ── Requirement model (Phase 2/3/26) ────────────────────────────────────────

export type RequirementPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RequirementStatus =
  'UNKNOWN' | 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'IMPLEMENTED' | 'VALIDATED';

export type RequirementCategory =
  | 'functional'
  | 'non_functional'
  | 'business_rule'
  | 'user'
  | 'data'
  | 'integration'
  | 'ai'
  | 'ux'
  | 'security'
  | 'performance'
  | 'scalability'
  | 'deployment'
  | 'compliance';

export interface Requirement {
  /** Stable human-readable id, e.g. REQ-001. */
  id: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  confidence: number;
  source: ProvenanceSource;
  /** Requirement ids that must be satisfied first. */
  dependencies: string[];
  risks: string[];
  status: RequirementStatus;
  /** Why this requirement exists / why it remains unknown. */
  reason?: string;
  /** Requirement change-control version (Phase 26). */
  version: number;
}

// ── Product Intent (Phase 1) ────────────────────────────────────────────────

export type IntentField =
  | 'problem'
  | 'desiredOutcome'
  | 'targetUsers'
  | 'domain'
  | 'applicationType'
  | 'platforms'
  | 'knownFeatures'
  | 'knownConstraints'
  | 'businessContext'
  | 'integrations'
  | 'aiExpectations'
  | 'deploymentExpectations'
  | 'successCriteria'
  | 'assumptions'
  | 'unknowns';

/** One claim inside the intent with full provenance. */
export interface IntentClaim {
  key: IntentField;
  label: string;
  value: string;
  provenance: Provenance;
  /** True when this is a recorded unknown rather than a fact. */
  isUnknown: boolean;
}

export interface ProductIntent {
  sessionId: string;
  problem?: string;
  desiredOutcome?: string;
  targetUsers: string[];
  domain?: string;
  applicationType?: string;
  platforms: string[];
  knownFeatures: string[];
  knownConstraints: string[];
  businessContext?: string;
  integrations: string[];
  aiExpectations: string[];
  deploymentExpectations: string[];
  successCriteria: string[];
  /** Full provenance ledger — nothing is silently assumed. */
  explicit: IntentClaim[];
  inferred: IntentClaim[];
  assumptions: IntentClaim[];
  unknowns: IntentClaim[];
  /** 0..1 overall confidence in the understanding. */
  overallConfidence: number;
  archetype: AppArchetype;
  derivationReasons: string[];
}

// ── Requirement Set (Phase 2) ───────────────────────────────────────────────

export interface RequirementSet {
  sessionId: string;
  requirements: Requirement[];
  /** Category → requirement ids. */
  byCategory: Record<RequirementCategory, string[]>;
  /** Overall confidence (mean of requirement confidence). */
  confidence: number;
  counts: {
    total: number;
    byStatus: Record<RequirementStatus, number>;
    byPriority: Record<RequirementPriority, number>;
  };
}

// ── Requirement Graph (Phase 4) ─────────────────────────────────────────────

export interface RequirementNode {
  id: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  status: RequirementStatus;
}

export type RequirementEdgeKind = 'dependency' | 'conflict' | 'blocker';

export interface RequirementEdge {
  from: string;
  to: string;
  kind: RequirementEdgeKind;
}

export interface RequirementGraph {
  sessionId: string;
  nodes: RequirementNode[];
  edges: RequirementEdge[];
  /** requirementId → its direct dependencies. */
  dependencies: Record<string, string[]>;
  /** requirementId → requirements that depend on it (downstream impact). */
  downstream: Record<string, string[]>;
  /** Blocked chains (requirement cannot proceed until its blockers clear). */
  blockers: Array<{ requirementId: string; blockedBy: string[] }>;
  /** Requirements that change the architecture when altered. */
  architectureChanging: string[];
  /** Cycles detected (must be resolved before build). */
  cycles: Array<{ ids: string[] }>;
  roots: string[];
  leaves: string[];
}

// ── Ambiguity (Phase 5) ─────────────────────────────────────────────────────

export type AmbiguityKind =
  | 'ambiguous_language'
  | 'missing_requirement'
  | 'conflicting_requirement'
  | 'unclear_terminology'
  | 'architecture_changing_uncertainty'
  | 'security_sensitive_uncertainty'
  | 'unrealistic_expectation';

export interface AmbiguityFinding {
  id: string;
  kind: AmbiguityKind;
  topic: string;
  excerpt?: string;
  explanation: string;
  impact: 'high' | 'medium' | 'low';
  /** Linked question id when this ambiguity needs an answer. */
  relatedQuestionId?: string;
}

export interface AmbiguityReport {
  sessionId: string;
  findings: AmbiguityFinding[];
}

// ── Questions (Phase 6/7/8) ─────────────────────────────────────────────────

export type QuestionClass = 'BLOCKING' | 'IMPORTANT' | 'OPTIONAL';

export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

export interface QuestionImpacts {
  architecture: number;
  security: number;
  business: number;
  ux: number;
  implementation: number;
  cost: number;
  confidence: number;
}

export interface RequirementQuestion {
  id: string;
  class: QuestionClass;
  /** Logical grouping topic (bundling, Phase 8). */
  topic: string;
  /** Short, understandable, non-technical where possible. */
  text: string;
  /** Why this question matters. */
  rationale: string;
  impacts: QuestionImpacts;
  options?: QuestionOption[];
  freeText?: boolean;
  /** The safe default if the user does not answer. */
  defaultAnswer?: string;
  answer?: string;
  answerSource?: ProvenanceSource;
  /** Bundle id this question belongs to. */
  groupId: string;
  /** Whether the answer resolved an ambiguity finding. */
  resolvesAmbiguityId?: string;
  /** Security-sensitive questions are always asked and never auto-defaulted. */
  securitySensitive?: boolean;
}

export interface QuestionBundle {
  id: string;
  title: string;
  questions: RequirementQuestion[];
}

export interface QuestionPlan {
  sessionId: string;
  bundles: QuestionBundle[];
  blocking: RequirementQuestion[];
  important: RequirementQuestion[];
  optional: RequirementQuestion[];
  all: RequirementQuestion[];
  answered: RequirementQuestion[];
}

// ── Safe Defaults (Phase 9) ─────────────────────────────────────────────────

export type SafeDefaultStatus = 'proposed' | 'accepted' | 'edited' | 'rejected';

export interface SafeDefault {
  id: string;
  unknown: string;
  /** ASSUMPTION — the claim being made. */
  assumption: string;
  /** DEFAULT — the chosen value. */
  defaultValue: string;
  /** REASON — why this default is safe. */
  reason: string;
  /** IMPACT — what this default affects. */
  impact: string;
  status: SafeDefaultStatus;
  /** Security/architecture sensitive defaults can never silently apply. */
  securitySensitive: boolean;
  relatedRequirementId?: string;
}

// ── Completeness (Phase 10) ─────────────────────────────────────────────────

export type CompletenessVerdict = 'NOT_READY' | 'READY_WITH_ASSUMPTIONS' | 'READY';

export interface CompletenessArea {
  area: RequirementCategory;
  score: number;
  covered: string[];
  gaps: string[];
}

export interface RequirementCompleteness {
  sessionId: string;
  /** 0..1. NEVER allowed to override a critical unknown. */
  score: number;
  confidence: number;
  criticalUnknowns: string[];
  importantUnknowns: string[];
  assumptions: string[];
  /** False when a critical unknown remains (score is ignored). */
  ready: boolean;
  perArea: CompletenessArea[];
  verdict: CompletenessVerdict;
}

// ── Conflicts (Phase 11) ────────────────────────────────────────────────────

export type ConflictSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export interface RequirementConflict {
  id: string;
  reqAId: string;
  reqBId: string;
  /** \"These requirements conflict.\" */
  description: string;
  explanation: string;
  alternatives: string[];
  severity: ConflictSeverity;
  status: 'open' | 'resolved' | 'rejected';
}

// ── Product Brief (Phase 12) ────────────────────────────────────────────────

export interface ProductBrief {
  sessionId: string;
  problem: string;
  targetUsers: string[];
  goals: string[];
  nonGoals: string[];
  features: string[];
  userJourneys: string[];
  businessRules: string[];
  data: string[];
  integrations: string[];
  aiCapabilities: string[];
  uxStrategy: string;
  security: string[];
  performance: string[];
  scalability: string[];
  deployment: string[];
  assumptions: string[];
  openQuestions: string[];
  successCriteria: string[];
}

// ── User Journeys (Phase 13) ────────────────────────────────────────────────

export type JourneyPathKind =
  | 'happy'
  | 'failure'
  | 'empty_state'
  | 'permission_failure'
  | 'network_failure'
  | 'validation_failure'
  | 'recovery';

export interface JourneyStep {
  label: string;
  detail?: string;
}

export interface UserJourney {
  id: string;
  actor: string;
  name: string;
  path: JourneyPathKind;
  steps: JourneyStep[];
}

// ── Experience Strategy (Phase 14) ──────────────────────────────────────────

export type InteractionModel =
  | 'dashboard'
  | 'chat'
  | 'copilot'
  | 'wizard'
  | 'workflow'
  | 'canvas'
  | 'editor'
  | 'search'
  | 'command_center'
  | 'mobile_first_workflow'
  | 'structured_form';

export interface ExperienceStrategy {
  sessionId: string;
  primaryModel: InteractionModel;
  secondaryModels: InteractionModel[];
  reasons: string[];
  alternatives: Array<{ model: InteractionModel; tradeoff: string }>;
  screens: string[];
  navigation: string;
}

// ── Design Specification (Phase 15) ─────────────────────────────────────────

export interface DesignSpecification {
  sessionId: string;
  visualPersonality: string;
  targetAudience: string;
  brandDirection: string;
  colorSystem: string[];
  typography: string;
  spacing: string;
  components: string[];
  iconography: string;
  motion: string;
  responsiveStrategy: string;
  accessibility: string;
  interactionStates: string[];
  emptyStates: string[];
  loadingStates: string[];
  errorStates: string[];
  rationale: string[];
}

// ── Architecture Intelligence (Phase 16) ────────────────────────────────────

export interface ArchitectureChoice {
  layer: string;
  choice: string;
  reason: string;
  alternative: string;
  tradeoff: string;
}

export interface ArchitectureDataEntity {
  entity: string;
  fields: Array<{ name: string; type: string }>;
}

export interface ArchitectureApiEndpoint {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  purpose: string;
  authRequired: boolean;
}

export interface ProductArchitecture {
  sessionId: string;
  choices: ArchitectureChoice[];
  dataModel: ArchitectureDataEntity[];
  apiContract: ArchitectureApiEndpoint[];
  integrations: Array<{ name: string; purpose: string }>;
  observability: string[];
  testing: string[];
  deployment: { target: DeploymentTargetId; steps: string[] };
  /** What complexity was deliberately avoided. */
  complexityGuard: string[];
}

// ── AI Strategy (Phase 17) ──────────────────────────────────────────────────

export interface AIStrategy {
  required: boolean;
  capabilities: Array<{ capability: CapabilityType; purpose: string; qualityTier: QualityTier }>;
  modelClass: string;
  providerStrategy: string;
  contextRequirements: string[];
  ragRequired: boolean;
  structuredOutput: boolean;
  toolCalling: boolean;
  latencyRequirement: string;
  qualityRequirement: string;
  tokenBudget: { maxInputTokens: number; maxOutputTokens: number };
  fallback: string;
  /** Every AI call must flow through the frozen runtime. */
  reusesRuntime: boolean;
  reasons: string[];
}

// ── RAG Strategy (Phase 18) ─────────────────────────────────────────────────

export interface RAGSource {
  name: string;
  collection: string;
  freshness: string;
  authority: string;
}

export interface RAGStrategy {
  required: boolean;
  sources: RAGSource[];
  retrievalStrategy: string;
  groundingRequired: boolean;
  evidenceRequired: boolean;
  reasons: string[];
}

// ── Tool Strategy (Phase 19) ────────────────────────────────────────────────

export type ToolRisk = 'low' | 'medium' | 'high';

export interface ToolStrategyEntry {
  name: string;
  purpose: string;
  permissions: string;
  dataAccess: string;
  risk: ToolRisk;
  approvalRequired: boolean;
}

export interface ToolStrategy {
  tools: ToolStrategyEntry[];
  deniedTools: string[];
}

// ── Security-by-Design (Phase 20) ───────────────────────────────────────────

export interface SecurityPlan {
  authentication: string;
  authorization: string;
  roles: string[];
  ownership: string;
  tenancy: string;
  secrets: string[];
  pii: string[];
  apiSecurity: string[];
  fileAccess: string[];
  toolPermissions: string[];
  audit: string[];
  logging: string[];
  /** Security-sensitive unknowns → BLOCKING questions. */
  securityCriticalUnknowns: string[];
  blockingQuestions: string[];
}

// ── Cost / Token Plan (Phase 21) ────────────────────────────────────────────

export interface CostPlan {
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  ragCalls: number;
  embeddingCalls: number;
  expectedIterations: number;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  strategy: string[];
  assumptions: string[];
}

// ── Build Plan (Phase 22) ───────────────────────────────────────────────────

export interface BuildStep {
  id: string;
  title: string;
  phase: string;
  dependencies: string[];
  parallelEligible: boolean;
}

export interface BuildPlan {
  steps: BuildStep[];
  /** Waves of steps that can run in parallel. */
  parallelWaves: string[][];
  entrySteps: string[];
  terminalSteps: string[];
  usesLoopEngine: boolean;
}

// ── Plan Review (Phase 23) ──────────────────────────────────────────────────

export interface PlanReview {
  sessionId: string;
  whatIUnderstood: string[];
  explicitlyRequested: string[];
  inferred: string[];
  dontKnow: string[];
  questions: RequirementQuestion[];
  assumptions: SafeDefault[];
  brief: ProductBrief;
  journeys: UserJourney[];
  designDirection: string;
  architecture: ProductArchitecture;
  aiStrategy: AIStrategy;
  ragStrategy: RAGStrategy;
  tools: ToolStrategy;
  security: SecurityPlan;
  cost: CostPlan;
  buildPlan: BuildPlan;
  /** True only when no critical unknowns and no unanswered BLOCKING questions. */
  ready: boolean;
  approvedAt?: string;
}

// ── Change Impact (Phase 24) ────────────────────────────────────────────────

export interface ChangeImpact {
  sessionId: string;
  request: string;
  requirementImpact: string[];
  architectureImpact: string[];
  databaseImpact: string[];
  apiImpact: string[];
  uxImpact: string[];
  securityImpact: string[];
  aiImpact: string[];
  testingImpact: string[];
  deploymentImpact: string[];
  costImpact: string;
  whatWillChange: string[];
  whatWillNotChange: string[];
  risks: string[];
  newRequirements: Requirement[];
  newSecurityRequirements: string[];
  estimatedCostUsd: number;
  requiresApproval: boolean;
}

// ── Traceability (Phase 25) ─────────────────────────────────────────────────

export interface TraceabilityLink {
  requirementId: string;
  description: string;
  design: string[];
  architecture: string[];
  tasks: string[];
  files: string[];
  tests: string[];
  validation: string[];
}

export interface TraceabilityIndex {
  sessionId: string;
  links: TraceabilityLink[];
}

// ── Requirement Change Control (Phase 26) ───────────────────────────────────

export interface RequirementVersion {
  version: number;
  requirementId: string;
  description: string;
  change: string;
  approvedBy?: string;
  approvedAt?: string;
  timestamp: string;
}

// ── Session (orchestration state machine) ───────────────────────────────────

export type RequirementPhase =
  | 'UNDERSTANDING'
  | 'QUESTIONS'
  | 'DEFAULTS'
  | 'READY_FOR_PLAN'
  | 'REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'HANDED_OFF';

export interface ChangeImpactRecord {
  request: string;
  impact: ChangeImpact;
  timestamp: string;
}

export interface RequirementSession {
  sessionId: string;
  owner: string;
  idea: string;
  phase: RequirementPhase;
  intent?: ProductIntent;
  requirements?: RequirementSet;
  graph?: RequirementGraph;
  ambiguity?: AmbiguityReport;
  questionPlan?: QuestionPlan;
  defaults?: SafeDefault[];
  completeness?: RequirementCompleteness;
  conflicts?: RequirementConflict[];
  brief?: ProductBrief;
  journeys?: UserJourney[];
  experience?: ExperienceStrategy;
  design?: DesignSpecification;
  architecture?: ProductArchitecture;
  aiStrategy?: AIStrategy;
  ragStrategy?: RAGStrategy;
  toolStrategy?: ToolStrategy;
  security?: SecurityPlan;
  cost?: CostPlan;
  buildPlan?: BuildPlan;
  review?: PlanReview;
  traceability?: TraceabilityIndex;
  changeImpacts: ChangeImpactRecord[];
  versions: RequirementVersion[];
  /** Synthesized factory-ready goal (created on approval). */
  handoffGoal?: string;
  enrichment: {
    attempted: boolean;
    calls: number;
    tokens: number;
    costUsd: number;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ── Handoff (Phase 23/28) ───────────────────────────────────────────────────

export interface HandoffGoal {
  goal: string;
  archetype: AppArchetype;
  confirmedRequirements: number;
  acceptedDefaults: number;
}
