// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/brain
// EPIC-016 — The VedMoulya Brain
//
// Central intelligence & orchestration layer. The Brain coordinates
// the frozen estate (EI-005 orchestrator, EPIC-006 LoopEngine, EPIC-012
// provider intelligence, EPIC-012C AI World, EPIC-013 capability
// marketplace, EPIC-014 execution bridge) into one coherent adaptive
// reasoning and execution system. It never executes AI itself and
// never duplicates a specialized engine.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { FailoverEvent, ProviderUsageFact } from './continuous-types.js';

// ── Brain modes ─────────────────────────────────────────────────────
export type BrainMode =
  'FAST' | 'BALANCED' | 'QUALITY' | 'DEEP_RESEARCH' | 'COST_SENSITIVE' | 'PRIVATE_LOCAL';

export const BRAIN_MODES: readonly BrainMode[] = [
  'FAST',
  'BALANCED',
  'QUALITY',
  'DEEP_RESEARCH',
  'COST_SENSITIVE',
  'PRIVATE_LOCAL',
] as const;

// ── Brain stages (user-visible pipeline) ────────────────────────────
export type BrainStage =
  | 'UNDERSTANDING'
  | 'PLAN'
  | 'INTELLIGENCE'
  | 'EXECUTION'
  | 'VERIFICATION'
  | 'RESULT'
  | 'CANCELLED'
  | 'FAILED';

export const BRAIN_STAGES: readonly BrainStage[] = [
  'UNDERSTANDING',
  'PLAN',
  'INTELLIGENCE',
  'EXECUTION',
  'VERIFICATION',
  'RESULT',
  'CANCELLED',
  'FAILED',
] as const;

export type BrainStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';

// ── Provider roles ──────────────────────────────────────────────────
export type ProviderRole =
  | 'PRIMARY_REASONER'
  | 'RESEARCHER'
  | 'CODER'
  | 'ANALYST'
  | 'FACT_CHECKER'
  | 'CRITIC'
  | 'SECURITY_REVIEWER'
  | 'VISION_ANALYZER'
  | 'WRITER'
  | 'PLANNER'
  | 'SYNTHESIZER'
  | 'VERIFIER'
  | 'SPECIALIST';

export const PROVIDER_ROLES: readonly ProviderRole[] = [
  'PRIMARY_REASONER',
  'RESEARCHER',
  'CODER',
  'ANALYST',
  'FACT_CHECKER',
  'CRITIC',
  'SECURITY_REVIEWER',
  'VISION_ANALYZER',
  'WRITER',
  'PLANNER',
  'SYNTHESIZER',
  'VERIFIER',
  'SPECIALIST',
] as const;

// ── Intent profile ──────────────────────────────────────────────────
export type QualityTarget = 'LOW' | 'MEDIUM' | 'HIGH';
export type PrivacyRequirement = 'PRIVATE' | 'STANDARD';
export type Urgency = 'LOW' | 'NORMAL' | 'HIGH';

export interface BoundedAssumption {
  /** What was assumed (always bounded, never fabricated as fact). */
  assumption: string;
  /** Why the assumption was made. */
  reason: string;
}

export interface IntentProfile {
  /** The user's objective, distilled. */
  objective: string;
  /** Domain hint (e.g. content, software, career, business, learning); UNKNOWN when undetected. */
  domain: string;
  /** What the user wants produced. */
  desiredOutcome: string;
  /** Constraints the user stated (free, private, local, deadline…). */
  constraints: string[];
  qualityTarget: QualityTarget;
  privacyRequirement: PrivacyRequirement;
  urgency: Urgency;
  /** Actions the user explicitly authorized. */
  authorizedActions: string[];
  /** Material ambiguity that would change execution if unresolved. */
  ambiguities: string[];
  /** Bounded assumptions recorded (UNKNOWN stays UNKNOWN). */
  assumptions: BoundedAssumption[];
}

// ── Provider role assignment ────────────────────────────────────────
export interface ProviderRoleAssignment {
  capability: CapabilityId;
  role: ProviderRole;
  providerId: string;
  providerName: string;
  modelId?: string;
  /** Measured/provider-declared quality where evidence exists. */
  quality: number | undefined;
  /** Why this provider was assigned this role. */
  reason: string;
  /** Evidence backing the assignment. */
  evidence: string[];
  /** EPIC-020 — evidence-backed cost estimate (KNOWN/ESTIMATED only; never fabricated). */
  estimatedCostUsd?: number;
  /** EPIC-020 — usage/limits evidence attached from the usage port or registry facts. */
  usage?: ProviderUsageFact;
}

// ── Execution graph ─────────────────────────────────────────────────
export type BrainNodeKind = 'task' | 'capability' | 'provider' | 'tool' | 'output' | 'verification';

export interface BrainGraphNode {
  id: string;
  kind: BrainNodeKind;
  label: string;
  capability?: CapabilityId;
  providerId?: string;
  role?: ProviderRole;
  status: BrainStageStatus;
}

export type BrainEdgeType =
  'depends_on' | 'produces' | 'consumes' | 'critiques' | 'verifies' | 'fallback' | 'parallel_with';

export interface BrainGraphEdge {
  from: string;
  to: string;
  type: BrainEdgeType;
}

export interface BrainExecutionGraph {
  nodes: BrainGraphNode[];
  edges: BrainGraphEdge[];
  /** Waves of parallel execution (each wave = an independent set). */
  waves: string[][];
}

// ── Conflict intelligence ───────────────────────────────────────────
export type ConflictClassification =
  'AGREEMENT' | 'MINOR_VARIANCE' | 'MATERIAL_CONFLICT' | 'EVIDENCE_CONFLICT' | 'UNRESOLVED';

export interface ConflictReport {
  /** The claim or question the providers disagreed on. */
  topic: string;
  classification: ConflictClassification;
  /** Providers involved. */
  providers: string[];
  /** The exact disagreement. */
  disagreement: string;
  /** Evidence each side cited. */
  evidence: string[];
  /** Resolution when resolved; UNRESOLVED stays honest. */
  resolution?: string;
  confidence: number;
}

// ── Synthesized output ──────────────────────────────────────────────
export interface SynthesizedClaim {
  claim: string;
  /** Providers that produced it (provenance). */
  providers: string[];
  /** Source evidence. */
  evidence: string[];
  confidence: number;
  conflictStatus: ConflictClassification;
}

export interface BrainSynthesis {
  claims: SynthesizedClaim[];
  /** Weighted synthesis over normalized, de-duplicated, verified claims. */
  summary: string;
  /** How many providers contributed. */
  providerCount: number;
  unresolvedConflicts: ConflictReport[];
}

// ── Decision record ─────────────────────────────────────────────────
export interface BrainDecisionRecord {
  id: string;
  taskId: string;
  userId: string;
  /** What was decided (e.g. provider selection, fallback, replan). */
  decision: string;
  reason: string;
  alternatives: string[];
  selected: string;
  evidence: string[];
  confidence: number;
  constraints: string[];
  providerId?: string;
  modelId?: string;
  costEstimateUsd?: number;
  qualityEstimate: number | undefined;
  createdAt: string;
  provenance: string;
}

// ── Verification ────────────────────────────────────────────────────
export interface BrainVerification {
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
    evidence: string[];
  }>;
  passed: boolean;
}

// ── Outcome evaluation / learning ───────────────────────────────────
export interface OutcomeEvaluation {
  whatWorked: string[];
  whatFailed: string[];
  providerPerformance: Array<{
    providerId: string;
    capability: CapabilityId;
    succeeded: boolean;
    qualityNote?: string;
  }>;
  recommendationCorrect: boolean;
  capabilityUseful: boolean;
  userApproved: boolean;
  verificationCaughtIssues: boolean;
  replanned: boolean;
  outputAccepted: boolean;
  /** EPIC-020 (Outcome & Revenue layer) — 3-value satisfaction §10. */
  satisfaction?: 'YES' | 'PARTIALLY' | 'NO' | 'UNKNOWN';
  /** Inferred vs explicit — inference is never promoted silently. */
  preferenceFacts: Array<{
    fact: string;
    source: 'EXPLICIT' | 'INFERRED';
    reason: string;
    confidence: number;
  }>;
}

// ── Budget ──────────────────────────────────────────────────────────
export interface BrainBudget {
  maxTokens: number;
  maxCostUsd: number;
  maxIterations: number;
  maxLatencyMs: number;
  /** Estimated before execution where evidence exists (UNKNOWN = absent). */
  estimatedCostUsd?: number;
  estimatedTokens?: number;
}

// ── The BrainTask ───────────────────────────────────────────────────
export type BrainTaskStatus =
  | 'NEW'
  | 'UNDERSTANDING'
  | 'PLANNED'
  | 'AWAITING_APPROVAL'
  | 'RUNNING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';

export interface BrainTask {
  id: string;
  userId: string;
  /** User objective verbatim. */
  objective: string;
  originalInput: string;
  intent: IntentProfile;
  mode: BrainMode;
  domain: string;
  qualityTarget: QualityTarget;
  privacyRequirement: PrivacyRequirement;
  budget: BrainBudget;
  /** Capability plan from EPIC-013 (reused, never rebuilt). */
  capabilityPlanId?: string;
  requiredCapabilities: CapabilityId[];
  roleAssignments: ProviderRoleAssignment[];
  graph: BrainExecutionGraph;
  status: BrainTaskStatus;
  stage: BrainStage;
  stageStatuses: Record<BrainStage, BrainStageStatus>;
  providerOutputs: Array<{
    providerId: string;
    role: ProviderRole;
    capability: CapabilityId;
    output: string;
    evidence: string[];
    quality: number | undefined;
  }>;
  conflicts: ConflictReport[];
  synthesis?: BrainSynthesis;
  verification?: BrainVerification;
  /** EPIC-020 — bounded provider failure/fallback trail (mission §5). */
  failoverEvents: FailoverEvent[];
  decisionRecords: BrainDecisionRecord[];
  outcome?: OutcomeEvaluation;
  approvalRequired: string[];
  approvalGranted: string[];
  executionRunId?: string;
  traceId: string;
  createdAt: string;
  updatedAt: string;
}
