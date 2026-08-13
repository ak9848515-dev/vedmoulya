// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/capabilities
// Enterprise Capability Registry & Marketplace (EI-001)
// The reusable capability system: every business module consumes
// capabilities without knowing providers, workflows, or orchestration.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  CapabilityStatus as CapabilityStatusValue,
  CapabilityCategory,
  BusinessModule,
  CostProfile,
  TokenProfile,
  LatencyProfile,
  QualityProfile,
  RequiredAIFeature,
  CapabilityDefinition,
  CapabilitySearchCriteria,
} from './types/capability-types.js';
export {
  CAPABILITY_STATUSES,
  CAPABILITY_CATEGORIES,
  BUSINESS_MODULES,
  REQUIRED_AI_FEATURES,
} from './types/capability-types.js';

// ── Domain ────────────────────────────────────────────────────────────────
export { Capability } from './domain/entities/Capability.js';
export type { CapabilityCompositionRef } from './domain/entities/Capability.js';
export { createCapabilityId, generateCapabilityId } from './domain/value-objects/CapabilityId.js';
export type {
  CapabilityId,
  CapabilityId as CapabilityIdType,
} from './domain/value-objects/CapabilityId.js';
export { CapabilityStatus } from './domain/value-objects/CapabilityStatus.js';
export { CapabilityVersion } from './domain/value-objects/CapabilityVersion.js';
export type { CapabilityRepository } from './domain/repository/CapabilityRepository.js';
export { CapabilityGraphService } from './domain/services/CapabilityGraphService.js';
export type {
  CapabilityGraph,
  CapabilityGraphNode,
  CycleDetectionResult,
} from './domain/services/CapabilityGraphService.js';
export { CapabilityCompositionService } from './domain/services/CapabilityCompositionService.js';
export type {
  CompositionTreeNode,
  CompositionValidation,
} from './domain/services/CapabilityCompositionService.js';
export {
  capabilityNameRule,
  capabilityCategoryRule,
  capabilityStatusRule,
  businessModulesRule,
  confidenceRule,
  qualityProfileRule,
  validate,
} from './domain/rules/CapabilityRules.js';
export type { RuleResult } from './domain/rules/CapabilityRules.js';

// ── Infrastructure ────────────────────────────────────────────────────────
export { InMemoryCapabilityRepository } from './infrastructure/InMemoryCapabilityRepository.js';
export { PostgresCapabilityRepository } from './infrastructure/PostgresCapabilityRepository.js';

// ── Application ───────────────────────────────────────────────────────────
export { CapabilityApplicationService } from './application/CapabilityApplicationService.js';
export type { CapabilityResult } from './application/CapabilityApplicationService.js';
export { CapabilityMapper } from './application/CapabilityMapper.js';
export type {
  CreateCapabilityDTO,
  UpdateCapabilityDTO,
  CapabilityQueryDTO,
  CapabilityDTO,
  CapabilityCompositionDTO,
  CapabilityGraphDTO,
  CapabilityMarketplaceDTO,
} from './application/CapabilityDTO.js';

// ── Catalog Seed ──────────────────────────────────────────────────────────
export { createCatalogCapabilities, CATALOG_SIZE } from './catalog/capability-catalog.js';
