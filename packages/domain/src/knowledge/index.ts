// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain Layer
// ARC-003 — Knowledge Graph Bounded Context
// Exports: entities, value objects, events, services, repository,
//          factory, and business rules
// ──────────────────────────────────────────────────────────────────

// ── Entities ──────────────────────────────────────────────────────────────
export { KnowledgeNode } from './entities/KnowledgeNode.js';
export { KnowledgeEdge } from './entities/KnowledgeEdge.js';
export { Skill } from './entities/Skill.js';
export { Competency } from './entities/Competency.js';
export { Evidence } from './entities/Evidence.js';
export { Artifact } from './entities/Artifact.js';
export { GoalReference } from './entities/GoalReference.js';
export { ProjectReference } from './entities/ProjectReference.js';
export { CareerReference } from './entities/CareerReference.js';
export { BusinessReference } from './entities/BusinessReference.js';
export { LearningReference } from './entities/LearningReference.js';
export { DecisionReference } from './entities/DecisionReference.js';
export { ExecutionReference } from './entities/ExecutionReference.js';
export { MemoryReference } from './entities/MemoryReference.js';
export { ContextReference } from './entities/ContextReference.js';
export { PortfolioReference } from './entities/PortfolioReference.js';
export { Relationship } from './entities/Relationship.js';

// ── Value Objects ─────────────────────────────────────────────────────────
export type { KnowledgeNodeId } from './value-objects/KnowledgeNodeId.js';
export { createKnowledgeNodeId, generateKnowledgeNodeId } from './value-objects/KnowledgeNodeId.js';
export type { KnowledgeEdgeId } from './value-objects/KnowledgeEdgeId.js';
export { createKnowledgeEdgeId, generateKnowledgeEdgeId } from './value-objects/KnowledgeEdgeId.js';
export type { GraphId } from './value-objects/GraphId.js';
export { createGraphId, generateGraphId } from './value-objects/GraphId.js';
export { KnowledgeCategory } from './value-objects/KnowledgeCategory.js';
export type { KnowledgeCategoryValue } from './value-objects/KnowledgeCategory.js';
export { KnowledgeStatus } from './value-objects/KnowledgeStatus.js';
export type { KnowledgeState } from './value-objects/KnowledgeStatus.js';
export { KnowledgeConfidence } from './value-objects/KnowledgeConfidence.js';
export type { ConfidenceLevel } from './value-objects/KnowledgeConfidence.js';
export { KnowledgeSource } from './value-objects/KnowledgeSource.js';
export type { KnowledgeSourceType } from './value-objects/KnowledgeSource.js';
export { KnowledgeVersion } from './value-objects/KnowledgeVersion.js';
export type { VersionInfo } from './value-objects/KnowledgeVersion.js';
export { RelationshipType } from './value-objects/RelationshipType.js';
export type { RelationshipCategory } from './value-objects/RelationshipType.js';
export { KnowledgeQuality } from './value-objects/KnowledgeQuality.js';
export type { QualityMetrics } from './value-objects/KnowledgeQuality.js';
export { KnowledgeLineage } from './value-objects/KnowledgeLineage.js';
export type { LineageEntry } from './value-objects/KnowledgeLineage.js';

// ── Aggregate ─────────────────────────────────────────────────────────────
export { KnowledgeGraph } from './aggregates/KnowledgeGraph.js';

// ── Domain Events ─────────────────────────────────────────────────────────
export type { KnowledgeEvent, KnowledgeEventType } from './events/KnowledgeEvent.js';
export { createKnowledgeEvent } from './events/KnowledgeEvent.js';

// ── Repository ────────────────────────────────────────────────────────────
export type { KnowledgeRepository } from './repository/KnowledgeRepository.js';

// ── Domain Services ───────────────────────────────────────────────────────
export { KnowledgeGraphService } from './services/KnowledgeGraphService.js';
export type {
  GraphOperationResult,
  TraversalResult,
  SearchResult,
  ImpactResult,
  CycleDetectionResult,
} from './services/KnowledgeGraphService.js';

// ── Factory ───────────────────────────────────────────────────────────────
export { KnowledgeFactory } from './factory/KnowledgeFactory.js';
export type {
  CreateNodeCommand,
  CreateEdgeCommand,
  KnowledgeFactoryResult,
} from './factory/KnowledgeFactory.js';

// ── Business Rules ────────────────────────────────────────────────────────
// Note: `validate`, `Rule`, and `RuleResult` are not re-exported here to avoid
// ambiguity with the Identity context's re-exports of the same names.
// They can be imported directly from '@vedmoulya/domain' (Identity version)
// or from './rules/KnowledgeRules.js' directly.
export {
  nodeValidationRule,
  edgeValidationRule,
  relationshipConstraintsRule,
  cyclePreventionRule,
  graphConsistencyRule,
} from './rules/KnowledgeRules.js';
