// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Domain Layer
// ARC-003/ARC-004 — Memory Engine Bounded Context
// Exports: entities, value objects, events, services, repository,
//          factory, and business rules
// ──────────────────────────────────────────────────────────────────

// ── Value Objects ─────────────────────────────────────────────────────────
export type { MemoryId } from './value-objects/MemoryId.js';
export { createMemoryId, generateMemoryId } from './value-objects/MemoryId.js';
export { MemoryCategory } from './value-objects/MemoryCategory.js';
export type { MemoryCategoryValue } from './value-objects/MemoryCategory.js';
export { MemoryImportance } from './value-objects/MemoryImportance.js';
export type { ImportanceLevel } from './value-objects/MemoryImportance.js';
export { MemoryConfidence } from './value-objects/MemoryConfidence.js';
export type { MemoryConfidenceLevel } from './value-objects/MemoryConfidence.js';
export { MemoryStrength } from './value-objects/MemoryStrength.js';
export { MemoryFreshness } from './value-objects/MemoryFreshness.js';
export type { FreshnessState } from './value-objects/MemoryFreshness.js';
export { MemoryState } from './value-objects/MemoryState.js';
export type { MemoryStateValue } from './value-objects/MemoryState.js';
export { MemorySource } from './value-objects/MemorySource.js';
export type { MemorySourceType } from './value-objects/MemorySource.js';
export { MemoryVersion } from './value-objects/MemoryVersion.js';
// Note: `VersionInfo` is intentionally omitted here to avoid ambiguity with
// KnowledgeVersion's `VersionInfo` re-export from the Knowledge module.
// Import it directly: import type { VersionInfo } from '@vedmoulya/domain/memory/value-objects/MemoryVersion';
export { MemoryRetentionPolicy } from './value-objects/MemoryRetentionPolicy.js';
export type { RetentionClass } from './value-objects/MemoryRetentionPolicy.js';

// ── Entities ──────────────────────────────────────────────────────────────
export { Memory } from './entities/Memory.js';

// ── Domain Events ─────────────────────────────────────────────────────────
export type { MemoryEvent, MemoryEventType } from './events/MemoryEvent.js';
export { createMemoryEvent } from './events/MemoryEvent.js';

// ── Repository ────────────────────────────────────────────────────────────
export type {
  MemoryRepository,
  MemorySearchParams,
  TimelineEntry,
  TimelineOrder,
} from './repository/MemoryRepository.js';

// ── Domain Services ───────────────────────────────────────────────────────
export { MemoryDomainService } from './services/MemoryDomainService.js';
export type {
  DomainOperationResult,
  ConsolidationSuggestion,
  DecayResult,
  TimelineSummary,
} from './services/MemoryDomainService.js';

// ── Factory ───────────────────────────────────────────────────────────────
export { MemoryFactory } from './factory/MemoryFactory.js';
export type { CreateMemoryCommand, MemoryFactoryResult } from './factory/MemoryFactory.js';

// ── Business Rules ────────────────────────────────────────────────────────
// Note: `validate`, `Rule`, and `RuleResult` are not re-exported here to avoid
// ambiguity with the Identity context's re-exports of the same names.
// They can be imported directly from './rules/MemoryRules.js' if needed.
export {
  memoryContentRule,
  importanceConstraintRule,
  retentionPolicyRule,
  knowledgeGraphReferenceRule,
} from './rules/MemoryRules.js';
