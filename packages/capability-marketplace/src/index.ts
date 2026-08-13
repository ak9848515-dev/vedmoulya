// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/capability-marketplace
// AI Capability Marketplace & Factory Intelligence
// EPIC-013
//
// Connects AI World intelligence with the factory ecosystem:
//   OUTCOME → CAPABILITIES → CANDIDATES → INTEGRATION CLASS →
//   AUTOMATION BOUNDARY → QUALITY-FIRST SELECTION → PLAN → APPROVAL.
//
// Reuses (never rebuilds): the provider registry + provider
// intelligence (EPIC-012A/012B), AI World discovery (EPIC-012C),
// local-model discovery, the frozen AI runtime (optional enrichment
// seam), and the existing auth/IDOR/rate-limit/security controls.
// No duplicate provider routing, no duplicate provider configuration.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  CapabilityId,
  IntegrationType,
  CandidateClass,
  AutomationLevel,
  EvidenceConfidence,
  CapabilityEvidence,
  CandidateKind,
  CapabilityCandidate,
  PlanStep,
  FactoryCapabilityPlan,
  CapabilityPlanRequest,
  CapabilityMarketplaceView,
  IrreversibleAction,
  CapabilityPlanSummary,
} from './types/capability-types.js';
export {
  CAPABILITY_IDS,
  CAPABILITY_LABELS,
  INTEGRATION_TYPES,
  INTEGRATION_LABELS,
  CANDIDATE_CLASSES,
  CANDIDATE_CLASS_LABELS,
  AUTOMATION_LEVELS,
  AUTOMATION_LABELS,
  IRREVERSIBLE_ACTIONS,
} from './types/capability-types.js';

// ── Contracts ────────────────────────────────────────────────────
export type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
  CapabilitySourcePort,
  CapabilityEnrichmentPort,
} from './contracts/CapabilitySourcePort.js';

// ── Domain engines ───────────────────────────────────────────────
export { CapabilityGraph } from './domain/CapabilityGraph.js';
export type { CapabilityDetection } from './domain/CapabilityGraph.js';
export { CapabilityDecomposer } from './domain/CapabilityDecomposer.js';
export type { DecomposedStep, Decomposition } from './domain/CapabilityDecomposer.js';
export { IntegrationClassifier } from './domain/IntegrationClassifier.js';
export type { IntegrationResult } from './domain/IntegrationClassifier.js';
export { AutomationBoundaryEngine } from './domain/AutomationBoundaryEngine.js';
export type { AutomationAssessment } from './domain/AutomationBoundaryEngine.js';
export { QualityFirstSelector } from './domain/QualityFirstSelector.js';
export type { SelectionResult } from './domain/QualityFirstSelector.js';
export { ApprovalEngine } from './domain/ApprovalEngine.js';
export type { ApprovalDecision } from './domain/ApprovalEngine.js';
export { CapabilityPlanner } from './domain/CapabilityPlanner.js';
export type { PlannerOptions } from './domain/CapabilityPlanner.js';
export type { CapabilityPlanStore } from './domain/CapabilityPlanStore.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryCapabilityPlanStore } from './infrastructure/InMemoryCapabilityPlanStore.js';
export type { InMemoryCapabilityPlanStoreOptions } from './infrastructure/InMemoryCapabilityPlanStore.js';

// ── Application service (capability.* contract) ─────────────────
export { CapabilityMarketplaceApplicationService } from './application/CapabilityMarketplaceApplicationService.js';
export type { CapabilityMarketplaceServiceOptions } from './application/CapabilityMarketplaceApplicationService.js';
