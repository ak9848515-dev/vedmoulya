// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Domain Types
// EPIC-007 — AI Application Factory
// Takes a natural-language application idea and turns it into a
// structured, validated application project:
//   UNDERSTAND → SPECIFY → ARCHITECT → PLAN → SELECT TECHNOLOGIES →
//   SELECT AI CAPABILITIES → GENERATE → TEST → CRITIQUE → REFINE →
//   BUILD → PACKAGE → DEPLOY/EXPORT
//
// This layer defines TYPES ONLY. The factory never executes AI, never
// calls providers, never re-implements RAG, the loop engine, the AI
// runtime or the ToolRuntime — it is the APPLICATION FACTORY layer
// ABOVE those systems.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier } from '@vedmoulya/ai';
import type { LoopBudgetConfig, LoopTaskPhase } from '@vedmoulya/loop-engine';

// ── Application Specification (Phase 1) ─────────────────────────────────────

/** A single functional/non-functional requirement with a resolution state. */
export interface AppRequirement {
  requirementId: string;
  category:
    'functional' | 'non_functional' | 'ui' | 'backend' | 'data' | 'security' | 'performance' | 'ai';
  description: string;
  /** inferred = derived safely from the goal; explicit = stated by the user. */
  source: 'explicit' | 'inferred';
  /** unresolved requirements are surfaced to the user, never silently assumed. */
  status: 'resolved' | 'unresolved';
  /** Why this requirement was inferred (or why it remains unresolved). */
  reason: string;
}

export interface UserJourney {
  journeyId: string;
  name: string;
  actor: string;
  steps: string[];
}

/** A typed, inspectable application specification (Phase 1). */
export interface ApplicationSpecification {
  applicationId: string;
  name: string;
  purpose: string;
  targetUsers: string[];
  userJourneys: UserJourney[];
  features: string[];
  requirements: AppRequirement[];
  acceptanceCriteria: string[];
  budget: LoopBudgetConfig;
  constraints: string[];
  archetype: AppArchetype;
  derivationReasons: string[];
  unresolved: Array<{ label: string; reason: string }>;
}

// ── Archetypes (Phase 2/18 — controlled interpretation) ─────────────────────

export type AppArchetype = 'abap-debugger' | 'restaurant-app' | 'ai-app-builder' | 'generic-web';

// ── Application Architecture (Phase 2) ──────────────────────────────────────

export interface ArchitectureLayer {
  layer:
    | 'frontend'
    | 'backend'
    | 'database'
    | 'auth'
    | 'ai'
    | 'rag'
    | 'tools'
    | 'api'
    | 'testing'
    | 'deployment';
  technology: string;
  /** Why this technology was chosen (technology-aware, not vendor-locked). */
  rationale: string;
  /** True when the layer reuses an existing VedMoulya capability. */
  reusesPlatform: boolean;
}

export interface ApplicationArchitecture {
  applicationId: string;
  layers: ArchitectureLayer[];
  dataModel: Array<{ entity: string; fields: Array<{ name: string; type: string }> }>;
  apiContract: Array<{
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    purpose: string;
    authRequired: boolean;
  }>;
  aiCapabilities: Array<{
    capability: CapabilityType;
    purpose: string;
    qualityTier: QualityTier;
    evidence?: { collection: string; groundingRequired: boolean };
  }>;
  integrations: Array<{ name: string; purpose: string }>;
  securityControls: string[];
  performanceTargets: string[];
  deploymentTarget: DeploymentTargetId;
  validationReasons: string[];
}

// ── Application Task Graph (Phase 3 — reuses the loop engine) ───────────────

export type ApplicationTaskPhase =
  | 'requirements'
  | 'architecture'
  | 'data_model'
  | 'api_contract'
  | 'ui_design'
  | 'implementation'
  | 'testing'
  | 'security_review'
  | 'performance_review'
  | 'build'
  | 'final_validation';

/** One task in the application generation graph. */
export interface ApplicationTask {
  taskId: string;
  title: string;
  role: SpecialistRoleId;
  phase: ApplicationTaskPhase;
  /** TaskIds that must complete first. */
  dependencies: string[];
  /** May run concurrently with its ready siblings. */
  parallelEligible: boolean;
  /** Files this task is expected to produce. */
  producesFiles: string[];
  /** Capability the specialist needs (logical, not a provider). */
  capability: CapabilityType;
  qualityTier: QualityTier;
  prompt: string;
  expectedOutput: string;
  /** Mapped loop phase so the loop engine can run this graph. */
  loopPhase: LoopTaskPhase;
}

export interface ApplicationTaskGraph {
  applicationId: string;
  tasks: ApplicationTask[];
  entryTaskIds: string[];
  terminalTaskIds: string[];
  validated: boolean;
  validationReasons: string[];
}

// ── Specialist Roles (Phase 4) ──────────────────────────────────────────────

export type SpecialistRoleId =
  | 'requirements-analyst'
  | 'product-architect'
  | 'ui-ux-designer'
  | 'frontend-engineer'
  | 'backend-engineer'
  | 'database-engineer'
  | 'ai-engineer'
  | 'rag-engineer'
  | 'security-engineer'
  | 'test-engineer'
  | 'performance-engineer'
  | 'code-reviewer'
  | 'deployment-engineer';

export interface SpecialistRole {
  id: SpecialistRoleId;
  label: string;
  description: string;
  /** Logical capabilities this role requests from the AI runtime. */
  capabilities: CapabilityType[];
  /** Which application task phases this role owns. */
  phases: ApplicationTaskPhase[];
}

// ── File Operations / Patch model (Phases 5–6) ──────────────────────────────

export type FileOperationKind = 'create' | 'modify' | 'delete' | 'rename';

export type ExecutionActionClass =
  | 'READ_ONLY'
  | 'SAFE_WRITE'
  | 'DESTRUCTIVE_WRITE'
  | 'NETWORK'
  | 'DATABASE'
  | 'DEPLOYMENT'
  | 'SECRET_ACCESS'
  | 'CODE_EXECUTION';

/** A controlled, explainable file change (Phase 5/6). */
export interface FileOperation {
  operationId: string;
  kind: FileOperationKind;
  /** Absolute-ish path inside the isolated workspace (e.g. /src/App.tsx). */
  path: string;
  /** Destination path for rename. */
  toPath?: string;
  /** New/updated content (create + modify). */
  content?: string;
  /** Why this change exists (explainability). */
  reason: string;
  /** The originating application task id. */
  originatingTask: string;
  /** Classified by the ExecutionPolicy — never assumed. */
  actionClass: ExecutionActionClass;
  /** Validation state (pending → approved → applied → rejected). */
  status: 'pending' | 'approved' | 'applied' | 'rejected' | 'rolled_back';
  /** Rollback content captured before a destructive op (Phase 6). */
  rollbackContent?: string;
  /** Validation results after this change is applied. */
  validationStatus: 'untested' | 'passed' | 'failed';
}

// ── Execution Policy (Phase 9) ──────────────────────────────────────────────

export interface ExecutionPolicyRule {
  actionClass: ExecutionActionClass;
  /** Default posture: allowed / controlled / blocked. */
  default: 'allowed' | 'controlled' | 'blocked';
  /** What must be true for a controlled action to proceed. */
  requiresApproval?: boolean;
  requiresPolicyValidation?: boolean;
}

export interface ExecutionPolicy {
  rules: ExecutionPolicyRule[];
  /** Explicit authorization flag the user can grant per action class. */
  grants: Partial<Record<ExecutionActionClass, boolean>>;
}

// ── Blueprint (Phase 7) — the source of truth for a generated app ───────────

export interface BlueprintTechnology {
  name: string;
  category:
    | 'frontend'
    | 'backend'
    | 'database'
    | 'auth'
    | 'ai'
    | 'rag'
    | 'deployment'
    | 'testing'
    | 'tooling';
  version?: string;
}

export interface BlueprintFile {
  path: string;
  kind: 'source' | 'config' | 'test' | 'schema' | 'docs' | 'asset';
  purpose: string;
  producedBy: ApplicationTaskPhase;
}

export interface ApplicationBlueprint {
  blueprintId: string;
  applicationId: string;
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  technologies: BlueprintTechnology[];
  files: BlueprintFile[];
  dependencies: string[];
  environment: Record<string, string>;
  database: Array<{ entity: string; table: string; columns: string[] }>;
  apis: ApplicationArchitecture['apiContract'];
  tests: Array<{ name: string; scope: 'unit' | 'integration' | 'e2e'; status: 'planned' }>;
  deployment: { target: DeploymentTargetId; steps: string[] };
  acceptanceCriteria: string[];
  createdAt: string;
  version: string;
}

// ── Preview / approval (Phase 8) ────────────────────────────────────────────

export interface ApplicationPlanPreview {
  applicationId: string;
  whatWillBeBuilt: string;
  why: string;
  technologyChoices: BlueprintTechnology[];
  aiCapabilities: ApplicationArchitecture['aiCapabilities'];
  expectedFiles: number;
  fileHighlights: string[];
  databaseChanges: string[];
  integrations: string[];
  estimatedEffort: string;
  estimatedAiUsage: {
    estimatedTokens: number;
    estimatedCostUsd: number;
    estimatedProviderCalls: number;
  };
  securityConsiderations: string[];
  deploymentTarget: DeploymentTargetId;
  approvalRequired: boolean;
  approvedAt?: string;
  approvalChanges?: string;
}

// ── Validation (Phase 10) ───────────────────────────────────────────────────

export type ValidationGateId =
  | 'lint'
  | 'typecheck'
  | 'unit_tests'
  | 'integration_tests'
  | 'build'
  | 'security'
  | 'ui_quality'
  | 'ai_critic';

export interface ValidationGateResult {
  gate: ValidationGateId;
  passed: boolean;
  findings: string[];
  /** 0..1 score. */
  score: number;
}

export interface ValidationReport {
  applicationId: string;
  gates: ValidationGateResult[];
  overall: 'PASS' | 'FAIL' | 'PARTIAL';
  automaticFixesApplied: number;
  createdAt: string;
}

// ── UI Quality (Phase 11) ───────────────────────────────────────────────────

export interface UIQualityCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface UIQualityReport {
  applicationId: string;
  score: number; // 0..1
  checks: UIQualityCheck[];
  verdict: 'PASS' | 'FAIL';
}

// ── Security (Phase 12) ─────────────────────────────────────────────────────

export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SecurityFinding {
  findingId: string;
  severity: SecuritySeverity;
  category:
    | 'dependency'
    | 'authentication'
    | 'authorization'
    | 'idor'
    | 'secret_exposure'
    | 'unsafe_input'
    | 'injection'
    | 'api_security'
    | 'file_access'
    | 'tool_permission';
  description: string;
  filePath?: string;
  remediation: string;
}

export interface SecurityReport {
  applicationId: string;
  findings: SecurityFinding[];
  /** CRITICAL/HIGH findings block completion. */
  blocked: boolean;
  summary: { critical: number; high: number; medium: number; low: number };
}

// ── Economics (Phase 17) ────────────────────────────────────────────────────

export interface EconomicsSnapshot {
  applicationId: string;
  aiCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  cacheHits: number;
  iterations: number;
  retries: number;
  providerUsage: Record<string, number>;
  generationTimeMs: number;
  estimatedBefore: { estimatedTokens: number; estimatedCostUsd: number };
}

// ── Deployment (Phase 16) ───────────────────────────────────────────────────

export type DeploymentTargetId = 'local' | 'vercel' | 'firebase' | 'cloud_run' | 'self_hosted';

export interface DeploymentRequest {
  target: DeploymentTargetId;
  authorized: boolean;
}

export interface DeploymentResult {
  target: DeploymentTargetId;
  status: 'not_started' | 'deploying' | 'deployed' | 'blocked' | 'failed';
  message: string;
  requiresAuthorization: boolean;
  artifactPath?: string;
}

// ── Version control (Phase 15) ──────────────────────────────────────────────

export type VersionControlOpType = 'init' | 'branch' | 'commit' | 'diff' | 'prepare_pr';

export interface VersionControlOperation {
  opId: string;
  type: VersionControlOpType;
  detail: string;
  timestamp: string;
  /** PRs are prepared but NEVER auto-pushed. */
  pushed: boolean;
}

// ── Repair loop (EPIC-008 — Phase 11) ───────────────────────────────────────

/** One bounded repair cycle: diagnose → patch → diff → re-validate. */
export interface RepairAttempt {
  /** 1-based attempt number within the repair loop. */
  attempt: number;
  /** The hard cap the loop runs under (never infinite). */
  limit: number;
  /** Validation gates BEFORE the patch (the diagnosis). */
  diagnosis: ValidationReport;
  /** The deterministic patches applied this attempt (path + reason). */
  patches: Array<{ path: string; reason: string }>;
  /** Validation gates AFTER the patch (re-validated). */
  result: ValidationReport;
  createdAt: string;
}

// ── Version history (EPIC-008 — Phase 14) ───────────────────────────────────

/** One recorded application state (plan approved / build / deploy / …). */
export interface ApplicationVersion {
  version: number;
  createdAt: string;
  /** What changed (e.g. 'plan approved', 'build READY', 'deployed', 'archived'). */
  change: string;
  status: ApplicationStatus;
  /** Snapshot of the validation state at this version. */
  validation?: { overall: 'PASS' | 'FAIL' | 'PARTIAL'; gatesPassed: number; gatesTotal: number };
  /** Snapshot of the security state at this version. */
  security?: { blocked: boolean; critical: number; high: number };
  /** Snapshot of economics at this version. */
  economics?: { totalTokens: number; estimatedCostUsd: number; aiCalls: number };
  /** The owner/actor who caused this version. */
  actor?: string;
}

// ── Registry (Phase 13) ─────────────────────────────────────────────────────

export type ApplicationStatus =
  'DRAFT' | 'PLANNED' | 'BUILDING' | 'VALIDATING' | 'READY' | 'DEPLOYED' | 'FAILED' | 'ARCHIVED';

/** One generated application registered inside VedMoulya (Phase 13). */
export interface AppProject {
  applicationId: string;
  owner: string;
  name: string;
  archetype: AppArchetype;
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  blueprint?: ApplicationBlueprint;
  planPreview?: ApplicationPlanPreview;
  version: string;
  status: ApplicationStatus;
  technologies: BlueprintTechnology[];
  aiCapabilities: CapabilityType[];
  repositoryPath: string;
  deploymentStatus: 'not_deployed' | 'deploying' | 'deployed' | 'failed';
  deploymentTarget?: DeploymentTargetId;
  health: 'unknown' | 'healthy' | 'degraded' | 'unhealthy';
  lastBuildAt?: string;
  lastValidation?: ValidationReport;
  securityReport?: SecurityReport;
  uiQuality?: UIQualityReport;
  economics?: EconomicsSnapshot;
  fileOperations: FileOperation[];
  files: Array<{ path: string; content: string; kind: BlueprintFile['kind'] }>;
  vcOperations: VersionControlOperation[];
  /** EPIC-008 Phase 14: recorded application states (oldest first). */
  versionHistory?: ApplicationVersion[];
  /** EPIC-008 Phase 11: bounded repair-loop attempts (diagnose→patch→re-validate). */
  repairAttempts?: RepairAttempt[];
  /** EPIC-008 Phase 11: the repair-loop cap (6). */
  repairLimit?: number;
  /** Phase 11: true when the repair loop exhausted its attempts while still failing. */
  repairLimitReached?: boolean;
  terminationReason?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewAppProject {
  applicationId: string;
  owner: string;
  name: string;
  archetype: AppArchetype;
  specification: ApplicationSpecification;
  architecture: ApplicationArchitecture;
  taskGraph: ApplicationTaskGraph;
  version: string;
  createdAt: string;
  updatedAt: string;
}

// ── Factory run (binding a project build to the loop engine) ────────────────

export interface FactoryRunLink {
  applicationId: string;
  loopRunId: string;
}
