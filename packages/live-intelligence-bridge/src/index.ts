// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge
// EPIC-017 — The Live Intelligence Bridge
//
// Connects the VedMoulya Brain to the existing Intelligence and
// Execution ecosystem so the complete loop becomes operational:
//
//   USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY →
//   PROVIDER/MODEL INTELLIGENCE → ECOSYSTEM INTELLIGENCE →
//   SECURITY/LICENSE/AVAILABILITY → TASK-SPECIFIC QUALITY →
//   COMPARE CURRENT VS BETTER → RECOMMENDATION → USER APPROVAL →
//   CONFIGURATION/HAND-OFF → VALIDATION → ROUTING → EPIC-014
//   EXECUTION → VERIFY → EVALUATE → MEMORY/PREFERENCE FEEDBACK
//
// Reuses (never rebuilds): the Brain (EPIC-016), Ecosystem
// Intelligence (EPIC-015), Capability Marketplace (EPIC-013),
// Execution Bridge (EPIC-014), AI World (EPIC-012C), provider
// intelligence (EPIC-012A/B), the BrainCandidatePort + preference
// ledger seams, and the existing auth/IDOR/rate-limit/security
// controls. No duplicate engines; no fabricated evidence; nothing
// is auto-activated.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  BridgeStage,
  BridgeStageStatus,
  BridgeLoopStatus,
  AcquisitionClass,
  BridgeCandidate,
  BridgeComparison,
  BridgeRecommendationKind,
  BridgeRecommendation,
  BridgeApprovalAction,
  BridgeApproval,
  BridgeHandoffKind,
  BridgeExecutionHandoff,
  BridgeOutcomeEvaluation,
  BridgePerformanceFact,
  BridgeNotificationKind,
  BridgeNotificationEvent,
  BridgeLoopRun,
  BridgeLoopConfig,
} from './types/bridge-types.js';
export { BRIDGE_STAGES, ACQUISITION_CLASSES } from './types/bridge-types.js';

// ── Contracts (narrow seams — the ONLY external reach) ───────────
export type {
  BridgeClockPort,
  BridgeBrainPort,
  BridgeIntelligencePort,
  BridgeMarketplacePort,
  BridgeExecutionPort,
  BridgeAiWorldPort,
  BridgeLoopStore,
} from './contracts/bridge-ports.js';
// Reused seams (never duplicated): the Brain's candidate + preference
// ports keep EXACTLY ONE source seam across the whole platform.
export type { BrainCandidatePort, BrainPreferencePort } from './contracts/bridge-ports.js';

// ── Domain engines ───────────────────────────────────────────────
export { AcquisitionClassifier } from './domain/AcquisitionClassifier.js';
export type { AcquisitionVerdict } from './domain/AcquisitionClassifier.js';
export { BridgeCandidateAssembler } from './domain/BridgeCandidateAssembler.js';
export type { AssemblyOptions } from './domain/BridgeCandidateAssembler.js';
export { BridgeComparisonBuilder } from './domain/BridgeComparisonBuilder.js';
export type { ComparisonInput } from './domain/BridgeComparisonBuilder.js';
export { BridgeRecommendationBuilder } from './domain/BridgeRecommendationBuilder.js';
export type { RecommendationInput } from './domain/BridgeRecommendationBuilder.js';
export { BridgeApprovalPolicy } from './domain/BridgeApprovalPolicy.js';
export type { ApprovalVerdict } from './domain/BridgeApprovalPolicy.js';
export { BridgeOutcomeEvaluator } from './domain/BridgeOutcomeEvaluator.js';
export type { OutcomeInput } from './domain/BridgeOutcomeEvaluator.js';
export { BridgePreferenceFeedback } from './domain/BridgePreferenceFeedback.js';
export type {
  PerformanceFactInput,
  PreferenceFeedbackInput,
} from './domain/BridgePreferenceFeedback.js';
export {
  BridgeNotificationMapper,
  MIN_MEANINGFUL_RELEVANCE,
} from './domain/BridgeNotificationMapper.js';
export type { NotificationCandidate } from './domain/BridgeNotificationMapper.js';

// ── Infrastructure (owner-scoped in-memory store) ────────────────
export { InMemoryBridgeLoopStore } from './infrastructure/InMemoryBridgeLoopStore.js';
export type { InMemoryBridgeLoopStoreOptions } from './infrastructure/InMemoryBridgeLoopStore.js';

// ── Infrastructure (SPRINT-022 — production Postgres persistence) ─
export { PostgresBridgeLoopStore } from './infrastructure/PostgresBridgeLoopStore.js';

// ── Application service (liveIntelligence.* contract) ────────────
export { LiveIntelligenceBridgeService } from './application/LiveIntelligenceBridgeService.js';
export type {
  BridgeServiceOptions,
  BridgeResult,
} from './application/LiveIntelligenceBridgeService.js';
