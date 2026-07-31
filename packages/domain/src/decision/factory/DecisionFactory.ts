// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Factory
// Consistent factory for creating decision entities
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { DecisionRepository } from '../repository/DecisionRepository.js';
import { generateDecisionId, type DecisionId } from '../value-objects/DecisionId.js';
import { DecisionStatus } from '../value-objects/DecisionStatus.js';
import { DecisionPriority } from '../value-objects/DecisionPriority.js';
import { DecisionConfidence } from '../value-objects/DecisionConfidence.js';
import { DecisionVersion } from '../value-objects/DecisionVersion.js';
import { Decision } from '../entities/Decision.js';
import type { DecisionCategory, DecisionInitiator, DecisionRequest } from '../entities/Decision.js';

export interface CreateDecisionCommand {
  title: string;
  description: string;
  category: string;
  priorityScore?: number;
  initiator?: string;
  request?: DecisionRequest;
  knowledgeNodeIds?: string[];
  memoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DecisionFactoryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * DecisionFactory — creates decision entities with
 * proper default values, validation, and event emission.
 */
export class DecisionFactory {
  private readonly repository: DecisionRepository;

  constructor(repository: DecisionRepository) {
    this.repository = repository;
  }

  /** Create a new Decision from a command */
  async createDecision(command: CreateDecisionCommand): Promise<DecisionFactoryResult<Decision>> {
    try {
      const decisionId = generateDecisionId();
      const validCategories: DecisionCategory[] = [
        'strategic',
        'tactical',
        'operational',
        'technical',
        'business',
        'career',
        'learning',
        'personal',
      ];
      const category = (validCategories as string[]).includes(command.category)
        ? (command.category as DecisionCategory)
        : 'operational';

      const validInitiators: DecisionInitiator[] = [
        'user',
        'system',
        'ai_orchestrator',
        'scheduled',
        'external',
      ];
      const initiator = (validInitiators as string[]).includes(command.initiator ?? '')
        ? (command.initiator as DecisionInitiator)
        : 'user';

      const priority =
        command.priorityScore !== undefined
          ? DecisionPriority.fromScore(command.priorityScore)
          : DecisionPriority.medium();

      const decision = Decision.create({
        id: decisionId,
        title: command.title,
        description: command.description,
        category,
        priority,
        initiator,
        request: command.request,
        knowledgeNodeIds: command.knowledgeNodeIds,
        memoryIds: command.memoryIds,
        tags: command.tags,
        metadata: command.metadata,
      });

      return await Promise.resolve({ success: true, data: decision });
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Factory error',
      });
    }
  }

  /** Reconstruct a decision from persisted data */
  static reconstructDecision(params: {
    id: string;
    title: string;
    description: string;
    category: string;
    status?: string;
    statusReason?: string;
    priorityLevel?: string;
    priorityScore?: number;
    confidenceLevel?: string;
    confidenceScore?: number;
    versionMajor?: number;
    versionMinor?: number;
    versionPatch?: number;
    initiator?: string;
    selectedOptionId?: string;
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
  }): Decision {
    return new Decision({
      id: params.id as DecisionId,
      title: params.title,
      description: params.description,
      category: params.category as DecisionCategory,
      status: params.status
        ? DecisionStatus.fromStatus(params.status, params.statusReason)
        : undefined,
      priority:
        params.priorityScore !== undefined
          ? DecisionPriority.fromScore(params.priorityScore)
          : DecisionPriority.fromLevel(params.priorityLevel ?? 'medium'),
      confidence:
        params.confidenceScore !== undefined
          ? DecisionConfidence.fromScore(params.confidenceScore)
          : DecisionConfidence.fromLevel(params.confidenceLevel ?? 'unknown'),
      version: new DecisionVersion(
        params.versionMajor ?? 1,
        params.versionMinor ?? 0,
        params.versionPatch ?? 0,
      ),
      initiator: (params.initiator ?? 'user') as DecisionInitiator,
      knowledgeNodeIds: params.knowledgeNodeIds,
      memoryIds: params.memoryIds,
      tags: params.tags,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      completedAt: params.completedAt,
    });
  }
}
