// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/context-fabric
// Context & Personal Intelligence Fabric (APP-001)
// The unified context abstraction that answers: given this user, this
// goal, this task and this permission set, what information,
// relationships, memories and knowledge are relevant, where did they
// come from, why were they selected, and what is the minimum useful
// context package for the next agent/workflow?
//
// Post-V1 application-platform layer. CONSUMES the frozen Enterprise
// Intelligence engines through narrow FabricEngines port contracts —
// owns none, duplicates no logic, never requires an LLM for basic
// retrieval.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  PersonalEntityType,
  BusinessEntityType,
  FabricEntityType,
  FabricGraphKind,
  ContextSource,
  EntityLifecycle,
  ContextEntity,
  ContextRelationshipType,
  ContextRelationship,
  PermissionScope,
  ContextPermission,
  PermissionEvaluation,
  ContextProvenance,
  ContextRetrievalQuery,
  ContextRankingResult,
  ContextRetrievalResult,
  ContextExplanation,
  GraphStats,
  PersonalGraph,
  BusinessGraph,
  ContextPackageItem,
  ContextFabricPackage,
  FabricHealthSource,
  FabricHealth,
} from './types/fabric-types.js';
export { CONTEXT_FABRIC_SOURCES, CONTEXT_RELATIONSHIP_TYPES } from './types/fabric-types.js';

// ── Contracts (engine ports) ─────────────────────────────────────
export type {
  PortResult,
  FabricContextEnginePort,
  FabricMemoryEnginePort,
  FabricKnowledgeEnginePort,
  FabricGoalsEnginePort,
  FabricCapabilitiesEnginePort,
  FabricEngines,
} from './contracts/fabric-engines.js';

// ── Domain ───────────────────────────────────────────────────────
export type { GraphRepository } from './domain/repository/GraphRepository.js';
export {
  entityId,
  isPersonalType,
  isBusinessType,
  relationshipEndpointRule,
  isRelationshipValid,
  isValidSource,
  DEFAULT_RANK_WEIGHTS,
  validateWeights,
  estimateTokens,
  estimatePackageTokens,
} from './domain/rules/FabricRules.js';
export type { FabricRankWeights } from './domain/rules/FabricRules.js';
export {
  evaluatePermission,
  filterEligibleEntities,
  permissionLabel,
} from './domain/services/PermissionEvaluationService.js';
export type { AccessRequest } from './domain/services/PermissionEvaluationService.js';
export {
  buildProvenance,
  provenanceStatement,
  buildSelectionRationale,
} from './domain/services/ProvenanceService.js';
export type { ProvenanceRequest, SelectionRationale } from './domain/services/ProvenanceService.js';
export {
  KeywordStrategy,
  MetadataStrategy,
  GraphProximityStrategy,
  RecencyStrategy,
  ConfidenceStrategy,
  MemoryRelevanceStrategy,
  ContextSearchService,
} from './domain/services/ContextSearchService.js';
export type {
  RetrievalStrategy,
  SearchServiceOptions,
} from './domain/services/ContextSearchService.js';
export { ContextAssemblyService, previewEntity } from './domain/services/ContextAssemblyService.js';
export type { AssemblyOptions, AssembledItem } from './domain/services/ContextAssemblyService.js';
export { PersonalGraphService } from './domain/services/PersonalGraphService.js';
export { BusinessGraphService } from './domain/services/BusinessGraphService.js';
export { FabricHealthService } from './domain/services/FabricHealthService.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryGraphRepository } from './infrastructure/InMemoryGraphRepository.js';
export { PostgresGraphRepository } from './infrastructure/PostgresGraphRepository.js';

// ── Application ──────────────────────────────────────────────────
export { ContextFabricApplicationService } from './application/ContextFabricApplicationService.js';
export type {
  FabricResult,
  ContextFabricOptions,
} from './application/ContextFabricApplicationService.js';
export type {
  PersonalGraphDTO,
  BusinessGraphDTO,
  ContextEntityDTO,
  ContextRelationshipDTO,
  ContextRetrievalResultDTO,
  ContextFabricPackageDTO,
  ContextExplanationDTO,
  ContextPermissionDTO,
  ContextProvenanceDTO,
  FabricHealthDTO,
  FabricSearchSummaryDTO,
  FabricGraphQueryDTO,
  FabricSearchDTO,
  FabricEntityQueryDTO,
  FabricRelationshipsQueryDTO,
  FabricPackageBuildDTO,
  FabricExplainDTO,
  FabricPermissionQueryDTO,
  FabricEntityLinkDTO,
} from './application/ContextFabricDTO.js';

// ── Catalog Seed ─────────────────────────────────────────────────
export {
  SEED_FABRIC_USER_ID,
  SEED_FABRIC_ORG_ID,
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
  SEED_FABRIC_ENTITY_COUNT,
  SEED_FABRIC_RELATIONSHIP_COUNT,
} from './catalog/fabric-catalog.js';
