// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Factory
// Consistent factory for creating memory entities
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { MemoryRepository } from '../repository/MemoryRepository.js';
import { generateMemoryId, type MemoryId } from '../value-objects/MemoryId.js';
import { MemoryCategory } from '../value-objects/MemoryCategory.js';
import { MemoryImportance } from '../value-objects/MemoryImportance.js';
import { MemoryConfidence } from '../value-objects/MemoryConfidence.js';
import { MemorySource, type MemorySourceType } from '../value-objects/MemorySource.js';
import { MemoryRetentionPolicy } from '../value-objects/MemoryRetentionPolicy.js';
import { MemoryState } from '../value-objects/MemoryState.js';
import { MemoryVersion } from '../value-objects/MemoryVersion.js';
import { MemoryStrength } from '../value-objects/MemoryStrength.js';
import { Memory } from '../entities/Memory.js';

// ── Command Types ─────────────────────────────────────────────────────────

export interface CreateMemoryCommand {
  category: string;
  title: string;
  content: string;
  importanceScore?: number;
  confidenceScore?: number;
  sourceType?: MemorySourceType;
  sourceDetail?: string;
  knowledgeNodeId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  retentionClass?: string;
}

export interface MemoryFactoryResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Map a source type string to the MemorySource static method */
function createMemorySource(sourceType: MemorySourceType, detail: string): MemorySource {
  switch (sourceType) {
    case 'user_input':
      return MemorySource.userInput(detail);
    case 'ai_inference':
      return MemorySource.aiInference(detail);
    case 'system_generated':
      return MemorySource.systemGenerated(detail);
    case 'import':
      return MemorySource.importSource(detail);
    case 'integration':
      return MemorySource.integration(detail);
    case 'conversation':
      return MemorySource.conversation(detail);
    case 'observation':
      return MemorySource.observation(detail);
    case 'reflection':
      return MemorySource.reflection(detail);
    default:
      return MemorySource.systemGenerated(detail);
  }
}

/**
 * MemoryFactory — creates memory entities with
 * proper default values, validation, and event emission.
 */
export class MemoryFactory {
  private readonly repository: MemoryRepository;

  constructor(repository: MemoryRepository) {
    this.repository = repository;
  }

  /** Create a new Memory from a command */
  createMemory(command: CreateMemoryCommand): Promise<MemoryFactoryResult<Memory>> {
    try {
      const memoryId = generateMemoryId();
      const category = MemoryCategory.create(command.category);
      const importance =
        command.importanceScore !== undefined
          ? MemoryImportance.fromScore(command.importanceScore)
          : MemoryImportance.medium();
      const confidence =
        command.confidenceScore !== undefined
          ? MemoryConfidence.fromScore(command.confidenceScore)
          : MemoryConfidence.medium();
      const source = command.sourceType
        ? createMemorySource(command.sourceType, command.sourceDetail ?? '')
        : MemorySource.systemGenerated(`memory: ${command.title}`);
      const retentionPolicy = command.retentionClass
        ? MemoryRetentionPolicy.fromClass(command.retentionClass)
        : MemoryRetentionPolicy.shortTerm();

      const memory = Memory.create({
        id: memoryId,
        category,
        title: command.title,
        content: command.content,
        importance,
        confidence,
        source,
        knowledgeNodeId: command.knowledgeNodeId,
        tags: command.tags,
        metadata: command.metadata,
        retentionPolicy,
      });

      return Promise.resolve({ success: true, data: memory });
    } catch (error) {
      return Promise.resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Factory error',
      });
    }
  }

  /** Reconstruct a memory from persisted data */
  static reconstructMemory(params: {
    id: string;
    category: string;
    title: string;
    content: string;
    importanceLevel?: string;
    importanceScore?: number;
    confidenceLevel?: string;
    confidenceScore?: number;
    strength?: number;
    strengthInterval?: number;
    easeFactor?: number;
    recallCount?: number;
    state?: string;
    stateReason?: string;
    sourceType?: string;
    sourceDetail?: string;
    versionMajor?: number;
    versionMinor?: number;
    versionPatch?: number;
    retentionClass?: string;
    knowledgeNodeId?: string;
    tags?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    lastRecalledAt?: Date;
  }): Memory {
    return new Memory({
      id: params.id as MemoryId,
      category: MemoryCategory.create(params.category),
      title: params.title,
      content: params.content,
      importance:
        params.importanceScore !== undefined
          ? MemoryImportance.fromScore(params.importanceScore)
          : MemoryImportance.fromLevel(params.importanceLevel ?? 'medium'),
      confidence:
        params.confidenceScore !== undefined
          ? MemoryConfidence.fromScore(params.confidenceScore)
          : MemoryConfidence.fromLevel(params.confidenceLevel ?? 'medium'),
      strength: new MemoryStrength(
        params.strength ?? 0.3,
        params.strengthInterval ?? 1,
        params.easeFactor ?? 2.5,
      ),
      source: params.sourceType
        ? createMemorySource(params.sourceType as MemorySourceType, params.sourceDetail ?? '')
        : MemorySource.systemGenerated('reconstructed'),
      state: params.state
        ? MemoryState.fromState(params.state, params.stateReason)
        : MemoryState.active(),
      version: new MemoryVersion(
        params.versionMajor ?? 1,
        params.versionMinor ?? 0,
        params.versionPatch ?? 0,
      ),
      retentionPolicy: params.retentionClass
        ? MemoryRetentionPolicy.fromClass(params.retentionClass)
        : MemoryRetentionPolicy.shortTerm(),
      knowledgeNodeId: params.knowledgeNodeId,
      tags: params.tags,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
      lastRecalledAt: params.lastRecalledAt,
    });
  }
}
