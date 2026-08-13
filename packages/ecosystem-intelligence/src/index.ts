// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// EPIC-015 — VedMoulya Intelligence
//
// The Intelligence layer continuously understands the external AI
// ecosystem and answers — for THIS task — \"is there something
// significantly better available?\" across configured providers, free
// providers, local models, GitHub projects and external applications.
//
// DISCOVERY + EVIDENCE + SECURITY + LICENSE + FRESHNESS — never a
// static directory. Nothing is fabricated, nothing is auto-activated.
// Reuses (never rebuilds): the Brain's candidate + preference ports
// (EPIC-016/EPIC-014), provider intelligence (EPIC-012A/B), AI World
// discovery (EPIC-012C) and capability quality-first selection
// (EPIC-013). Google auth stays untouched — GitHub connects through a
// separate least-privilege authorization flow.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  IntelligenceLifecycleState,
  LifecycleRecord,
  SecurityClassification,
  SecurityCheck,
  RepositorySecurityAssessment,
  LicenseUsageVerdict,
  LicenseIntelligence,
  FreeResourceStatus,
  FreeResourceLimits,
  GitHubConnectionState,
  GitHubPermissionScope,
  GitHubConnection,
  AcquisitionState,
  AcquisitionPlan,
  BestOptionKind,
  IntelligenceOption,
  TaskIntelligenceResult,
  FallbackPlan,
  RecommendationKind,
  IntelligenceRecommendation,
  IntelligenceTaskContext,
  IntelligenceNotificationKind,
  IntelligenceNotification,
} from './types/intelligence-types.js';
export {
  INTELLIGENCE_LIFECYCLE,
  SECURITY_CLASSIFICATIONS,
  GITHUB_CONNECTION_STATES,
  GITHUB_PERMISSION_SCOPES,
  ACQUISITION_STATES,
  BEST_OPTION_KINDS,
} from './types/intelligence-types.js';

// ── Contracts (narrow seams — the ONLY external reach) ───────────
export type {
  ClockPort,
  GitHubAuthPort,
  GitHubRepoFacts,
  GitHubRepoSourcePort,
  GitHubConnectionStore,
  LifecycleStore,
  RecommendationStore,
  NotificationStore,
  AcquisitionStore,
} from './contracts/intelligence-ports.js';
// Reused seams (never duplicated): the Brain's candidate + preference
// ports keep EXACTLY ONE source seam across the whole platform.
export type { BrainCandidatePort, BrainPreferencePort } from './contracts/intelligence-ports.js';

// ── Domain engines ───────────────────────────────────────────────
export {
  GitHubConnectionManager,
  effectiveGrantedScopes,
  isWriteScope,
} from './domain/GitHubConnectionManager.js';
export type { GitHubPermissionView } from './domain/GitHubConnectionManager.js';
export { SecurityAssessor } from './domain/SecurityAssessor.js';
export type { RepositoryFacts } from './domain/SecurityAssessor.js';
export { LicenseEngine } from './domain/LicenseEngine.js';
export {
  FreeResourceIntelligence,
  DEFAULT_FREE_CLAIM_MAX_AGE_MS,
} from './domain/FreeResourceIntelligence.js';
export type { FreeResourceFacts } from './domain/FreeResourceIntelligence.js';
export { AcquisitionPlanner } from './domain/AcquisitionPlanner.js';
export type { AcquisitionInput } from './domain/AcquisitionPlanner.js';
export {
  TaskIntelligenceEngine,
  MATERIAL_IMPROVEMENT_MARGIN,
} from './domain/TaskIntelligenceEngine.js';
export type { CandidateSet } from './domain/TaskIntelligenceEngine.js';
export { RecommendationAssembler } from './domain/RecommendationAssembler.js';
export type {
  BetterCapabilityInput,
  OpenSourceInput,
  LocalModelInput,
} from './domain/RecommendationAssembler.js';
export { LifecycleLedger } from './domain/LifecycleLedger.js';
export { NotificationGate, MIN_MEANINGFUL_RELEVANCE } from './domain/NotificationGate.js';

// ── Infrastructure (owner-scoped in-memory stores) ───────────────
export {
  InMemoryGitHubConnectionStore,
  InMemoryLifecycleStore,
  InMemoryRecommendationStore,
  InMemoryNotificationStore,
  InMemoryAcquisitionStore,
} from './infrastructure/InMemoryIntelligenceStores.js';

// ── Infrastructure (SPRINT-022 — production Postgres persistence) ─
export {
  PostgresGitHubConnectionStore,
  PostgresLifecycleStore,
  PostgresRecommendationStore,
  PostgresNotificationStore,
  PostgresAcquisitionStore,
} from './infrastructure/PostgresIntelligenceStores.js';

// ── Application service (intelligence.* contract) ────────────────
export { EcosystemIntelligenceApplicationService } from './application/EcosystemIntelligenceApplicationService.js';
export type {
  EcosystemIntelligenceServiceOptions,
  GitHubBeginResult,
  GitHubVerifyResult,
  RepositoryAssessmentResult,
} from './application/EcosystemIntelligenceApplicationService.js';
