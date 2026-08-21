// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem
// AI Ecosystem Foundation (SPRINT-050)
//
// The ecosystem model unifies: Provider → Model → Capability → Tool → Agent → Workflow
// under a single architectural umbrella. This package provides typed contracts
// and lightweight registries — no business logic engines.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  RiskLevel,
  ApprovalPolicy,
  AutomationLevel,
  PricingModel,
  PrivacyClass,
  AgentStatus,
  AgentDefinition,
  WorkflowStatus,
  WorkflowStep,
  WorkflowDefinition,
  EcosystemComponent,
  EcosystemSummary,
} from './types/ecosystem-types.js';

export {
  RISK_LEVELS,
  AUTOMATION_LEVELS,
  PRICING_MODELS,
  PRIVACY_CLASSES,
  AGENT_STATUSES,
  WORKFLOW_STATUSES,
} from './types/ecosystem-types.js';

// ── Domain Entities ───────────────────────────────────────────────
export { Agent } from './domain/entities/Agent.js';
export { Workflow } from './domain/entities/Workflow.js';

// ── Registries ────────────────────────────────────────────────────
export { AgentRegistry } from './domain/registries/AgentRegistry.js';
export type { AgentSearchCriteria } from './domain/registries/AgentRegistry.js';
export { WorkflowRegistry } from './domain/registries/WorkflowRegistry.js';
export type { WorkflowSearchCriteria } from './domain/registries/WorkflowRegistry.js';

// ── Service ───────────────────────────────────────────────────────
export { EcosystemService } from './domain/EcosystemService.js';
export type { EcosystemServiceOptions } from './domain/EcosystemService.js';

// ── Execution Types ──────────────────────────────────────────────
export type {
  WorkflowExecutionStatus,
  WorkflowStepStatus,
  WorkflowStepResult,
  WorkflowExecution,
  WorkflowApprovalState,
  StartWorkflowExecutionRequest,
  WorkflowExecutionSummary,
} from './types/execution-types.js';
export { WORKFLOW_EXECUTION_STATUSES } from './types/execution-types.js';

// ── Execution Service ────────────────────────────────────────────
export { WorkflowExecutionService } from './application/WorkflowExecutionService.js';
export type {
  ClockPort as ExecutionClockPort,
  StepExecutorPort,
  StepVerifierPort,
  EvidencePort,
  WorkflowExecutionStore,
  WorkflowExecutionServiceOptions,
  ServiceResult as ExecutionServiceResult,
} from './application/WorkflowExecutionService.js';

// ── Execution Infrastructure ─────────────────────────────────────
export { InMemoryWorkflowExecutionStore } from './infrastructure/InMemoryWorkflowExecutionStore.js';

// ── Career Intelligence (SPRINT-054) ─────────────────────────────
export type {
  OpportunitySource,
  DataConfidence,
  CareerOpportunity,
  MatchedOpportunity,
  RankedOpportunity,
  CareerProposal,
  CareerProfile,
  CareerIntelligenceResult,
} from './catalog/career-intelligence-types.js';

export {
  CAREER_RESEARCH_AGENT,
  CAREER_MATCH_AGENT,
  CAREER_RANKING_AGENT,
  CAREER_PROPOSAL_AGENT,
  CAREER_VERIFICATION_AGENT,
  CAREER_INTELLIGENCE_AGENTS,
} from './catalog/career-intelligence-agents.js';

export {
  CAREER_INTELLIGENCE_STEPS,
  CAREER_INTELLIGENCE_WORKFLOW,
} from './catalog/career-intelligence-workflow.js';
