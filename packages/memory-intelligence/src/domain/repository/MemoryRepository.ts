// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence Repository Interface
// Contract for Enterprise Memory persistence (EI-010).
// Persists memory items (with embedded consumers, citations, and
// audit) plus relationship edges. Implementations:
// InMemoryMemoryRepository (hermetic test double) and
// PostgresMemoryRepository (JSONB documents in `memory_registry`,
// collections `memory` + `relationship`).
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  MemoryCompressionState,
  MemoryItem,
  MemoryLifecycleStatus,
  MemoryRelationship,
  MemoryRelationshipType,
  MemoryRetentionPolicy,
  MemorySourceType,
  MemoryType,
} from '../../types/memory-types.js';

export interface MemoryItemSearch {
  type?: MemoryType;
  sourceType?: MemorySourceType;
  lifecycleStatus?: MemoryLifecycleStatus;
  compressionState?: MemoryCompressionState;
  retentionPolicy?: MemoryRetentionPolicy;
  owner?: string;
  tag?: string;
  relatedGoal?: string;
  relatedTask?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedContext?: string;
  minImportance?: number;
  minConfidence?: number;
}

export interface MemoryRepository {
  // ── Items ───────────────────────────────────────────────────────────────
  saveItem(item: MemoryItem): Promise<void>;
  findItemById(memoryId: string): Promise<MemoryItem | null>;
  listItems(
    search: MemoryItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<MemoryItem>>;
  listAllItems(): Promise<MemoryItem[]>;
  listItemsByType(type: MemoryType): Promise<MemoryItem[]>;
  deleteItem(memoryId: string): Promise<void>;
  countItems(): Promise<number>;

  // ── Relationships (the Memory Graph edges) ─────────────────────────────
  saveRelationship(relationship: MemoryRelationship): Promise<void>;
  findRelationshipById(relationshipId: string): Promise<MemoryRelationship | null>;
  listRelationships(type?: MemoryRelationshipType): Promise<MemoryRelationship[]>;
  listRelationshipsForItem(memoryId: string): Promise<MemoryRelationship[]>;
  deleteRelationship(relationshipId: string): Promise<void>;
  countRelationships(): Promise<number>;
}
