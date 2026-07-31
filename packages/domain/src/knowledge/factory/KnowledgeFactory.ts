// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Factory
// Consistent factory for creating knowledge graph entities
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeRepository } from '../repository/KnowledgeRepository.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import {
  generateKnowledgeNodeId,
  createKnowledgeNodeId,
} from '../value-objects/KnowledgeNodeId.js';
import { generateKnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import { createGraphId } from '../value-objects/GraphId.js';
import {
  KnowledgeCategory,
  type KnowledgeCategoryValue,
} from '../value-objects/KnowledgeCategory.js';
import { KnowledgeSource, type KnowledgeSourceType } from '../value-objects/KnowledgeSource.js';
import { RelationshipType, type RelationshipCategory } from '../value-objects/RelationshipType.js';
import { KnowledgeConfidence } from '../value-objects/KnowledgeConfidence.js';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';
import { KnowledgeQuality } from '../value-objects/KnowledgeQuality.js';
import { KnowledgeVersion } from '../value-objects/KnowledgeVersion.js';
import { KnowledgeLineage } from '../value-objects/KnowledgeLineage.js';
import { KnowledgeNode as KnowledgeNodeEntity } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge as KnowledgeEdgeEntity } from '../entities/KnowledgeEdge.js';
import type { EntityStatus } from '@vedmoulya/core';

// ── Command Types ─────────────────────────────────────────────────────────

export interface CreateNodeCommand {
  graphId: GraphId;
  category: KnowledgeCategoryValue;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sourceType?: KnowledgeSourceType;
  sourceDetail?: string;
  tags?: string[];
}

export interface CreateEdgeCommand {
  graphId: GraphId;
  sourceId: KnowledgeNodeId;
  targetId: KnowledgeNodeId;
  relationshipType: string;
  relationshipCategory: RelationshipCategory;
  label?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  sourceType?: KnowledgeSourceType;
  sourceDetail?: string;
}

export interface KnowledgeFactoryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Map a source type string to the KnowledgeSource static method */
function createKnowledgeSource(sourceType: KnowledgeSourceType, detail: string): KnowledgeSource {
  switch (sourceType) {
    case 'user_input':
      return KnowledgeSource.userInput(detail);
    case 'ai_inference':
      return KnowledgeSource.aiInference(detail);
    case 'system_generated':
      return KnowledgeSource.systemGenerated(detail);
    case 'import':
      return KnowledgeSource.importSource(detail);
    case 'integration':
      return KnowledgeSource.integration(detail);
    case 'conversation':
      return KnowledgeSource.conversation(detail);
    case 'document':
      return KnowledgeSource.document(detail);
    case 'learning':
      return KnowledgeSource.learning(detail);
    default:
      return KnowledgeSource.systemGenerated(detail);
  }
}

/**
 * KnowledgeFactory — creates knowledge graph entities with
 * proper default values, validation, and event emission.
 */
export class KnowledgeFactory {
  private readonly repository: KnowledgeRepository;

  constructor(repository: KnowledgeRepository) {
    this.repository = repository;
  }

  /** Create a new KnowledgeNode from a command */
  createNode(command: CreateNodeCommand): Promise<KnowledgeFactoryResult<KnowledgeNodeEntity>> {
    try {
      const nodeId = generateKnowledgeNodeId();
      const category = KnowledgeCategory.create(command.category);
      const source = command.sourceType
        ? createKnowledgeSource(command.sourceType, command.sourceDetail ?? '')
        : KnowledgeSource.systemGenerated(`node creation: ${command.label}`);

      const node = KnowledgeNodeEntity.create({
        id: nodeId,
        graphId: command.graphId,
        category,
        label: command.label,
        description: command.description,
        metadata: command.metadata,
        source,
        tags: command.tags,
      });

      return Promise.resolve({ success: true, data: node });
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Factory error',
      });
    }
  }

  /** Create a new KnowledgeEdge from a command */
  createEdge(command: CreateEdgeCommand): Promise<KnowledgeFactoryResult<KnowledgeEdgeEntity>> {
    try {
      const edgeId = generateKnowledgeEdgeId();
      const relationshipType = RelationshipType.custom(
        command.relationshipType,
        command.relationshipCategory,
        command.label ?? command.relationshipType.toLowerCase().replace(/_/g, ' '),
      );

      const source = command.sourceType
        ? createKnowledgeSource(command.sourceType, command.sourceDetail ?? '')
        : KnowledgeSource.systemGenerated('edge creation');

      const edge = KnowledgeEdgeEntity.create({
        id: edgeId,
        graphId: command.graphId,
        sourceId: command.sourceId,
        targetId: command.targetId,
        type: relationshipType,
        label: command.label,
        weight: command.weight,
        metadata: command.metadata,
        source,
      });

      return Promise.resolve({ success: true, data: edge });
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Factory error',
      });
    }
  }

  /** Reconstruct a node from persisted data */
  static reconstructNode(params: {
    id: string;
    graphId: string;
    category: string;
    label: string;
    description?: string;
    metadata?: Record<string, unknown>;
    status?: string;
    statusReason?: string;
    confidence?: string;
    confidenceScore?: number;
    sourceType?: string;
    sourceDetail?: string;
    accuracy?: number;
    completeness?: number;
    consistency?: number;
    timeliness?: number;
    relevance?: number;
    major?: number;
    minor?: number;
    patch?: number;
    entityStatus?: EntityStatus;
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
  }): KnowledgeNodeEntity {
    return new KnowledgeNodeEntity({
      id: createKnowledgeNodeId(params.id),
      graphId: createGraphId(params.graphId),
      category: KnowledgeCategory.create(params.category),
      label: params.label,
      description: params.description,
      metadata: params.metadata,
      status: params.status
        ? KnowledgeStatus.fromState(params.status, params.statusReason)
        : KnowledgeStatus.active(),
      confidence: params.confidence
        ? KnowledgeConfidence.fromLevel(params.confidence)
        : KnowledgeConfidence.unknown(),
      source: params.sourceType
        ? createKnowledgeSource(params.sourceType as KnowledgeSourceType, params.sourceDetail ?? '')
        : KnowledgeSource.systemGenerated('reconstructed'),
      quality: new KnowledgeQuality({
        accuracy: params.accuracy ?? 0.5,
        completeness: params.completeness ?? 0.5,
        consistency: params.consistency ?? 0.5,
        timeliness: params.timeliness ?? 1.0,
        relevance: params.relevance ?? 0.5,
      }),
      version: new KnowledgeVersion(params.major ?? 1, params.minor ?? 0, params.patch ?? 0),
      lineage: KnowledgeLineage.initial(
        'knowledge.node.created',
        params.id,
        `Reconstructed: ${params.label}`,
      ),
      entityStatus: params.entityStatus ?? 'active',
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      tags: params.tags,
    });
  }

  /** Reconstruct an edge from persisted data */
  static reconstructEdge(params: {
    id: string;
    graphId: string;
    sourceId: string;
    targetId: string;
    type: string;
    category: string;
    label?: string;
    weight?: number;
    sourceType?: string;
    sourceDetail?: string;
    accuracy?: number;
    completeness?: number;
    consistency?: number;
    timeliness?: number;
    relevance?: number;
    entityStatus?: EntityStatus;
    createdAt?: Date;
    updatedAt?: Date;
  }): KnowledgeEdgeEntity {
    return new KnowledgeEdgeEntity({
      id: params.id as unknown as KnowledgeEdgeId,
      graphId: createGraphId(params.graphId),
      sourceId: createKnowledgeNodeId(params.sourceId),
      targetId: createKnowledgeNodeId(params.targetId),
      type: RelationshipType.custom(
        params.type,
        params.category as RelationshipCategory,
        params.label ?? params.type.toLowerCase().replace(/_/g, ' '),
      ),
      label: params.label,
      weight: params.weight,
      confidence: KnowledgeConfidence.fromScore(
        ((params.accuracy ?? 0.5) + (params.completeness ?? 0.5)) / 2,
      ),
      status: KnowledgeStatus.active(),
      source: params.sourceType
        ? createKnowledgeSource(params.sourceType as KnowledgeSourceType, params.sourceDetail ?? '')
        : KnowledgeSource.systemGenerated('reconstructed'),
      entityStatus: params.entityStatus ?? 'active',
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });
  }
}
