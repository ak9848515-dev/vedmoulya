// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/providers
// Enterprise Provider Registry & Intelligence Platform (EI-002)
// Providers are enterprise assets: discoverable, health-monitored,
// capability-mapped, costed. The registry holds the intelligence;
// routing and selection decisions are later sprints.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  ProviderLifecycleStatus as ProviderLifecycleStatusValue,
  ProviderModel,
  ProviderCostProfile,
  ProviderLatencyProfile,
  ProviderRateLimits,
  ProviderHealthSnapshot,
  ProviderDefinition,
  ProviderSearchCriteria,
  BenchmarkDifficulty,
  ProviderBenchmarkCategory,
  ProviderBenchmarkDefinition,
} from './types/provider-types.js';
export {
  PROVIDER_LIFECYCLE_STATUSES,
  BENCHMARK_DIFFICULTIES,
  PROVIDER_BENCHMARK_CATEGORIES,
} from './types/provider-types.js';

// ── Domain ────────────────────────────────────────────────────────────────
export { Provider } from './domain/entities/Provider.js';
export type { ProviderCapabilityMatrixEntry, ProviderHealth } from './domain/entities/Provider.js';
export { createProviderId, generateProviderId } from './domain/value-objects/ProviderId.js';
export type {
  ProviderId,
  ProviderId as ProviderIdType,
} from './domain/value-objects/ProviderId.js';
export { ProviderLifecycleStatus } from './domain/value-objects/ProviderLifecycleStatus.js';
export { ProviderVersion } from './domain/value-objects/ProviderVersion.js';
export type { ProviderRepository } from './domain/repository/ProviderRepository.js';
export { ProviderCapabilityMatrixService } from './domain/services/ProviderCapabilityMatrixService.js';
export type {
  CapabilityRanking,
  CapabilityMatrixView,
  ProviderMatrixSummary,
} from './domain/services/ProviderCapabilityMatrixService.js';
export { ProviderBenchmarkDatasetService } from './domain/services/ProviderBenchmarkDatasetService.js';
export type {
  BenchmarkDatasetFilter,
  BenchmarkDatasetSummary,
} from './domain/services/ProviderBenchmarkDatasetService.js';
export { ProviderHealthService } from './domain/services/ProviderHealthService.js';
export type {
  ProviderFleetHealth,
  ProviderHealthSnapshotView,
} from './domain/services/ProviderHealthService.js';

// ── EPIC-012A — Provider Intelligence ─────────────────────────────────────
export type {
  ProvenanceState,
  Provenanced,
  ModelResourceType,
  ResourceClassification,
  ModelIntelligence,
  ProviderIntelligenceProfile,
  LocalModelInfo,
  LocalModelDiscoveryResult,
  LocalModelDiscoveryPort,
  HardwareSpec,
  HardwareFitAssessment,
  HardwareFitVerdict,
  HardwareCompatibilityProfile,
} from './types/intelligence-types.js';
export { MODEL_RESOURCE_TYPES, PROVENANCE_ORDER } from './types/intelligence-types.js';
export {
  classifyResource,
  resolveResourceType,
} from './domain/services/ModelResourceClassifier.js';
export type { ResourceFacts } from './domain/services/ModelResourceClassifier.js';
export { ProviderIntelligenceService } from './domain/services/ProviderIntelligenceService.js';
export type { ProviderIntelligenceOptions } from './domain/services/ProviderIntelligenceService.js';
export { HardwareCompatibilityService } from './domain/services/HardwareCompatibilityService.js';
export type { HardwareFitFacts } from './domain/services/HardwareCompatibilityService.js';

// ── EPIC-012B — Provider Intelligence Refresh, Discovery & Cache ─────────
export type {
  ModelLifecycleStatus,
  ProfileStaleness,
  ProviderCatalogDiscoveryPort,
  ProviderCatalogDiscoveryResult,
  IntelligenceVerificationState,
  ProviderIntelligenceRefreshResult,
} from './types/intelligence-types.js';
export { MODEL_LIFECYCLE_STATUSES } from './types/intelligence-types.js';
export { ProviderIntelligenceRefreshService } from './domain/services/ProviderIntelligenceRefreshService.js';
export type { ProviderIntelligenceRefreshOptions } from './domain/services/ProviderIntelligenceRefreshService.js';
export { DEFAULT_INTELLIGENCE_MAX_AGE_MS } from './domain/services/ProviderIntelligenceRefreshService.js';
export type {
  ProviderIntelligenceStore,
  ProviderIntelligenceRecord,
} from './domain/intelligence/ProviderIntelligenceStore.js';
export { InMemoryProviderIntelligenceStore } from './infrastructure/InMemoryProviderIntelligenceStore.js';
export {
  OllamaLocalModelDiscovery,
  OpenAICompatibleModelDiscovery,
  InMemoryLocalModelDiscovery,
} from './infrastructure/LocalModelDiscovery.js';
export {
  providerNameRule,
  providerFamilyRule,
  providerLifecycleStatusRule,
  availabilityRule,
  modelsRule,
  validate,
  PROVIDER_FAMILIES,
} from './domain/rules/ProviderRules.js';
export type { RuleResult } from './domain/rules/ProviderRules.js';

// ── EPIC-012A — Owner-Scoped Provider Preferences ────────────────────────
export type {
  BudgetPolicy,
  ProviderBudgets,
  ProviderPreferences,
  ProviderPreferencesPatch,
} from './types/preferences-types.js';
export {
  DEFAULT_BUDGET_POLICY,
  DEFAULT_MONTHLY_TOKEN_BUDGET,
  defaultProviderPreferences,
} from './types/preferences-types.js';
export type { ProviderPreferencesStore } from './domain/preferences/ProviderPreferencesStore.js';
export { ProviderPreferencesService } from './application/ProviderPreferencesService.js';
export type { ProviderPreferencesResult } from './application/ProviderPreferencesService.js';
export { runWithProviderUser, currentProviderUser } from './application/request-context.js';

// ── Infrastructure ────────────────────────────────────────────────────────
export { InMemoryProviderRepository } from './infrastructure/InMemoryProviderRepository.js';
export { InMemoryProviderPreferencesStore } from './infrastructure/InMemoryProviderPreferencesStore.js';
export { PostgresProviderRepository } from './infrastructure/PostgresProviderRepository.js';

// ── Application ───────────────────────────────────────────────────────────
export { ProviderApplicationService } from './application/ProviderApplicationService.js';
export type {
  ProviderResult,
  ProviderIntelligenceStatusResult,
  ProviderIntelligenceInfrastructure,
} from './application/ProviderApplicationService.js';
export { ProviderMapper } from './application/ProviderMapper.js';
export type {
  CreateProviderDTO,
  UpdateProviderDTO,
  ProviderQueryDTO,
  ProviderDTO,
  ProviderModelDTO,
  ProviderModelInput,
  ProviderMatrixDTO,
  ProviderMatrixInput,
  ProviderCapabilityMatrixDTO,
  ProviderFleetHealthDTO,
  ProviderMarketplaceDTO,
  ProviderBenchmarkDatasetDTO,
  ProviderBenchmarkQueryDTO,
  ProviderModelRegistryDTO,
  ProviderModelRegistryEntryDTO,
} from './application/ProviderDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────────────
export { createCatalogProviders, CATALOG_SIZE } from './catalog/provider-catalog.js';
export { createBenchmarkDataset, BENCHMARK_DATASET_SIZE } from './catalog/benchmark-catalog.js';
