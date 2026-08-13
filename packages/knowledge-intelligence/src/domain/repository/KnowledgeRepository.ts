// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence Repository Interface
// Contract for Enterprise Knowledge persistence (EI-009).
// Persists knowledge items (with embedded versions, consumers,
// citations, dependencies, and audit) plus relationship edges.
// Implementations: InMemoryKnowledgeRepository (hermetic test double)
// and PostgresKnowledgeRepository (JSONB documents in
// `knowledge_registry`, collections `item` + `relationship`).
// ──────────────────────────────────────────────────────────────────

import type { PaginatedResult, PaginationParams } from '@vedmoulya/core';
import type {
  KnowledgeCategory,
  KnowledgeItem,
  KnowledgeLifecycleStatus,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeSourceType,
  KnowledgeValidationStatus,
} from '../../types/knowledge-types.js';

export interface KnowledgeItemSearch {
  category?: KnowledgeCategory;
  sourceType?: KnowledgeSourceType;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  validationStatus?: KnowledgeValidationStatus;
  owner?: string;
  tag?: string;
  minTrust?: number;
}

export interface KnowledgeRepository {
  // ── Items ───────────────────────────────────────────────────────────────
  saveItem(item: KnowledgeItem): Promise<void>;
  findItemById(knowledgeId: string): Promise<KnowledgeItem | null>;
  listItems(
    search: KnowledgeItemSearch,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeItem>>;
  listAllItems(): Promise<KnowledgeItem[]>;
  listItemsByCategory(category: KnowledgeCategory): Promise<KnowledgeItem[]>;
  deleteItem(knowledgeId: string): Promise<void>;
  countItems(): Promise<number>;

  // ── Relationships (the Knowledge Graph edges) ──────────────────────────
  saveRelationship(relationship: KnowledgeRelationship): Promise<void>;
  findRelationshipById(relationshipId: string): Promise<KnowledgeRelationship | null>;
  listRelationships(type?: KnowledgeRelationshipType): Promise<KnowledgeRelationship[]>;
  listRelationshipsForItem(knowledgeId: string): Promise<KnowledgeRelationship[]>;
  deleteRelationship(relationshipId: string): Promise<void>;
  countRelationships(): Promise<number>;
}
