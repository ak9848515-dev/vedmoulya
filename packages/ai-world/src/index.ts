// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ai-world
// AI World Discovery, Provider Catalog & Market Intelligence
// EPIC-012C
//
// A continuous, bounded, evidence-first discovery layer over the AI
// ecosystem: WHAT IS NEW → WHAT IS USEFUL → WHAT IS FREE → WHAT CAN
// RUN LOCALLY → WHAT SHOULD VEDMOULYA CONFIGURE → WHAT TO IGNORE.
//
// Reuses (never rebuilds): the existing provider registry,
// ProviderIntelligenceService/RefreshService (EPIC-012A/012B), the
// existing routing engine (AI-SELECT / ProviderRoutingAdvisor), the
// existing provider configuration experience, and the existing
// auth/IDOR/rate-limit/security controls. No second routing engine,
// no duplicate configuration logic.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  DiscoveryCategory,
  EvidenceConfidence,
  DiscoveryEvidence,
  FreeResourceClass,
  LocalAvailability,
  RecommendationState,
  GitHubRepoFlag,
  GitHubRepositoryIntelligence,
  DiscoveryModelFacts,
  DiscoveryItem,
  DiscoveryBudget,
  RawDiscoveryItem,
  RawDiscoveryResult,
  DiscoveryItemAction,
  DiscoveryUserState,
  AIWorldSection,
  AIWorldView,
  DigestEntry,
  DiscoveryDigest,
  DiscoverySourceRunReport,
  DiscoveryRunReport,
} from './types/discovery-types.js';
export {
  DISCOVERY_CATEGORIES,
  FREE_RESOURCE_CLASSES,
  RECOMMENDATION_STATES,
  GITHUB_REPO_FLAGS,
  DEFAULT_DISCOVERY_BUDGET,
} from './types/discovery-types.js';

// ── Contracts ────────────────────────────────────────────────────
export type { AIDiscoverySource, DiscoverySourceContext } from './contracts/AIDiscoverySource.js';

// ── Domain engines ───────────────────────────────────────────────
export { SecurityScanner } from './domain/SecurityScanner.js';
export type { SecurityScanResult, SecurityFlag } from './domain/SecurityScanner.js';
export { FreeResourceClassifier } from './domain/FreeResourceClassifier.js';
export type { ResourceClassification } from './domain/FreeResourceClassifier.js';
export { GitHubRepositoryIntelligenceEngine } from './domain/GitHubRepositoryIntelligence.js';
export type { GitHubRepoInput } from './domain/GitHubRepositoryIntelligence.js';
export { RelevanceScorer } from './domain/RelevanceScorer.js';
export type { RelevanceScore, ScoringContext } from './domain/RelevanceScorer.js';
export { RecommendationEngine } from './domain/RecommendationEngine.js';
export type { Recommendation } from './domain/RecommendationEngine.js';
export { DiscoveryNormalizer } from './domain/DiscoveryNormalizer.js';
export type { NormalizerContext } from './domain/DiscoveryNormalizer.js';
export { DiscoveryDeduplicator } from './domain/DiscoveryDeduplicator.js';
export type { DedupResult } from './domain/DiscoveryDeduplicator.js';
export { DigestBuilder } from './domain/DigestBuilder.js';
export type { DigestOptions } from './domain/DigestBuilder.js';
export { DiscoveryOrchestrator } from './domain/DiscoveryOrchestrator.js';
export type { DiscoveryOrchestratorOptions } from './domain/DiscoveryOrchestrator.js';
export type { DiscoveryStore } from './domain/DiscoveryStore.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryDiscoveryStore } from './infrastructure/InMemoryDiscoveryStore.js';
export type { InMemoryDiscoveryStoreOptions } from './infrastructure/InMemoryDiscoveryStore.js';

// ── Infrastructure (SPRINT-022 — production Postgres persistence) ─
export { PostgresDiscoveryStore } from './infrastructure/PostgresDiscoveryStore.js';
export type { PostgresDiscoveryStoreOptions } from './infrastructure/PostgresDiscoveryStore.js';
export { StaticCatalogDiscoverySource } from './infrastructure/StaticCatalogDiscoverySource.js';

// ── Application service (aiWorld.* contract) ─────────────────────
export { DiscoveryApplicationService } from './application/DiscoveryApplicationService.js';
export type {
  DiscoveryApplicationServiceOptions,
  DiscoveryItemView,
  DiscoveryWorldResult,
} from './application/DiscoveryApplicationService.js';
