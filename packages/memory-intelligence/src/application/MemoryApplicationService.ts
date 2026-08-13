// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Application Service
// EI-010 — Enterprise Memory Intelligence Platform
// Facade over the Memory domain services. Exposes the API surface:
// capture (the Memory Pipeline entry), registry (get/list/update/
// delete), retrieval (the ten retrieval modes), summarize, validate,
// consolidate, compress, expire, lifecycle transitions, relate +
// graph traversal, consumers, analytics, the timeline feed, and the
// Memory Center dashboard.
//
// The Memory Pipeline lives here: Event → Capture → Validation →
// Consolidation → Relationship Detection → Importance Scoring →
// Ranking → Compression → Retrieval → (Enterprise Brain → Execution →
// Learning → Memory Update). This layer performs the Capture through
// Compression stages; the downstream stages (Brain/Execution/Learning)
// consume the registry through the other engines' existing flows —
// no duplicated logic.
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { MemoryEngines } from '../contracts/memory-engines.js';
import type { MemoryRepository } from '../domain/repository/MemoryRepository.js';
import type { MemoryGraph } from '../domain/graph/MemoryGraph.js';
import { MemoryCaptureService } from '../domain/services/MemoryCaptureService.js';
import { MemoryImportanceService } from '../domain/services/MemoryImportanceService.js';
import { MemoryRankingService } from '../domain/services/MemoryRankingService.js';
import { MemoryRetrievalService } from '../domain/services/MemoryRetrievalService.js';
import { MemoryCompressionService } from '../domain/services/MemoryCompressionService.js';
import { MemoryConsolidationService } from '../domain/services/MemoryConsolidationService.js';
import { MemoryExpirationService } from '../domain/services/MemoryExpirationService.js';
import { MemoryLifecycleService } from '../domain/services/MemoryLifecycleService.js';
import { MemoryAnalyticsService } from '../domain/services/MemoryAnalyticsService.js';
import { MemoryCitationService } from '../domain/services/MemoryCitationService.js';
import { MemoryRelationshipService } from '../domain/services/MemoryRelationshipService.js';
import { titleRule } from '../domain/rules/MemoryRules.js';
import {
  generateMemoryAuditId,
  generateMemoryCitationId,
  generateMemoryConsumerId,
  generateMemoryRelationshipId,
} from '../domain/value-objects/MemoryId.js';
import type {
  MemoryGraphTraversal,
  MemoryItem,
  MemoryRelationship,
  MemoryRelationshipType,
  MemorySearchResult,
  MemoryType,
} from '../types/memory-types.js';
import { MemoryMapper } from './MemoryMapper.js';
import type {
  ConsolidateMemoryDTO,
  ConsumerUsageDTO,
  ExpireMemoryDTO,
  GraphQueryDTO,
  LifecycleMemoryDTO,
  MemoryCaptureInput,
  MemoryDashboardDTO,
  MemoryListQueryDTO,
  MemoryRetrievalDTO,
  MemoryTimelineDTO,
  RelateMemoryDTO,
  ShortestPathDTO,
  SummarizeMemoryDTO,
  UpdateMemoryDTO,
  ValidateMemoryDTO,
} from './MemoryDTO.js';

export interface MemoryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Engine consultation errors tolerated during enrichment. */
  errors?: string[];
}

export const MEMORY_DEFAULT_CONFIDENCE = 0.7;

export class MemoryApplicationService {
  private readonly captureService: MemoryCaptureService;
  private readonly importance: MemoryImportanceService;
  private readonly ranking: MemoryRankingService;
  private readonly retrieval: MemoryRetrievalService;
  private readonly compression: MemoryCompressionService;
  private readonly consolidation: MemoryConsolidationService;
  private readonly expiration: MemoryExpirationService;
  private readonly lifecycle: MemoryLifecycleService;
  private readonly analytics: MemoryAnalyticsService;
  private readonly citations: MemoryCitationService;
  private readonly relationships: MemoryRelationshipService;

  constructor(
    private readonly repository: MemoryRepository,
    private readonly graphService: MemoryGraph,
    private readonly engines: MemoryEngines,
  ) {
    this.captureService = new MemoryCaptureService();
    this.importance = new MemoryImportanceService();
    this.ranking = new MemoryRankingService();
    this.retrieval = new MemoryRetrievalService(this.ranking);
    this.compression = new MemoryCompressionService();
    this.consolidation = new MemoryConsolidationService();
    this.expiration = new MemoryExpirationService();
    this.lifecycle = new MemoryLifecycleService();
    this.analytics = new MemoryAnalyticsService();
    this.citations = new MemoryCitationService();
    this.relationships = new MemoryRelationshipService();
  }

  // ── Capture (Event → Capture → Validation → Ranking → Compression) ────────

  async capture(dto: MemoryCaptureInput): Promise<MemoryResult<MemoryItem>> {
    const titleCheck = titleRule(dto.title);
    if (!titleCheck.passed)
      return { success: false, error: titleCheck.message ?? 'title is required' };
    if (!dto.content.trim()) return { success: false, error: 'content is required' };
    if (!dto.source.trim()) return { success: false, error: 'source is required' };
    if (!dto.owner.trim()) return { success: false, error: 'owner is required' };

    const actor = dto.actor ?? 'memory-platform';
    let item = this.captureService.capture(dto).item;

    // Citations (evidence) verified at capture.
    item = {
      ...item,
      citations: this.citations.verify(
        (dto.citations ?? []).map((citation) => ({
          citationId: generateMemoryCitationId(),
          sourceId: citation.sourceId,
          sourceTitle: citation.sourceTitle,
          sourceType: citation.sourceType ?? dto.sourceType,
          reference: citation.reference,
          retrievedAt: item.createdAt,
          verified: false,
        })),
        dto.sourceType,
      ),
    };

    // Relationship detection against the existing registry (auto-relate).
    const registry = await this.repository.listAllItems();
    const detected = this.relationships.detectRelationships(item, registry, actor);
    item = { ...item, relationships: this.dedupeEdges([...item.relationships, ...detected]) };

    // Full pipeline (default): validate → consolidate → importance → rank → compress → active.
    let errors: string[] | undefined;
    if (dto.pipeline !== false) {
      const pipeline = await this.runPipeline(item, actor);
      item = pipeline.item;
      errors = pipeline.errors.length > 0 ? pipeline.errors : undefined;
    } else {
      item.importance = this.importance.score(item);
    }

    // Registry write (item + its edges).
    await this.repository.saveItem(item);
    for (const edge of item.relationships) {
      await this.repository.saveRelationship(edge);
    }

    return { success: true, data: item, errors };
  }

  /**
   * The Memory Pipeline from a captured item to `active`:
   *   validated → consolidated (with duplicate merge) → importance
   *   scored → ranked → compressed → active
   * Each stage is audited by the lifecycle service. Engine consultation
   * failures are tolerated (the memory still lands in the registry).
   */
  private async runPipeline(
    captured: MemoryItem,
    actor: string,
  ): Promise<{ item: MemoryItem; errors: string[] }> {
    const errors: string[] = [];
    let item = captured;

    // Validate (captured → validated).
    const validated = this.lifecycle.transition(item, 'validated', actor, 'pipeline validation');
    if (!validated.transitioned) errors.push(validated.message ?? 'validation failed');
    item = validated.item;

    // Consolidation against the registry (duplicate merge).
    const registry = await this.repository.listAllItems();
    const candidates = this.consolidation.findCandidates([...registry, item]);
    const forThis = candidates.find(
      (c) =>
        c.primary.memoryId === item.memoryId ||
        c.duplicates.some((d) => d.memoryId === item.memoryId),
    );
    if (forThis) {
      const { consolidated, mergedCount } = this.consolidation.consolidate(forThis);
      item = consolidated;
      item = this.lifecycle.transition(
        item,
        'consolidated',
        actor,
        `merged ${mergedCount - 1} duplicate(s)`,
      ).item;
      // Remove the merged duplicates from the registry.
      for (const duplicate of forThis.duplicates) {
        await this.repository.deleteItem(duplicate.memoryId);
      }
    } else {
      item = this.lifecycle.transition(item, 'consolidated', actor, 'no duplicates found').item;
    }

    // Importance scoring + ranking.
    item = { ...item, importance: this.importance.score(item) };
    const ranked = this.ranking.rank(item);
    item = this.lifecycle.transition(
      item,
      'ranked',
      actor,
      `rank score ${ranked.score.toFixed(3)}`,
    ).item;

    // Compression (raw → summarized) + activation.
    const compressed = this.compression.compress(item, { target: 'summarized' });
    item = {
      ...item,
      summary: compressed.summary,
      compressionState: compressed.compressionState,
    };
    item = this.lifecycle.transition(
      item,
      'compressed',
      actor,
      `compressed ${compressed.beforeLength} → ${compressed.afterLength} chars`,
    ).item;
    item = this.lifecycle.transition(item, 'active', actor, 'memory ready for retrieval').item;

    // Engine enrichment (consumer registry + cross-links) — graceful.
    const enriched = await this.enrichWithEngines(item);
    errors.push(...enriched.errors);
    return { item: enriched.item, errors };
  }

  /** Register which engines consume this memory + tolerate consultation errors. */
  private async enrichWithEngines(
    item: MemoryItem,
  ): Promise<{ item: MemoryItem; errors: string[] }> {
    const errors: string[] = [];
    const consumers: MemoryItem['consumers'] = [...item.consumers];
    const now = new Date().toISOString();

    const register = (
      consumerId: string,
      consumerType: MemoryItem['consumers'][number]['consumerType'],
      label: string,
    ): void => {
      const existing = consumers.find((c) => c.consumerId === consumerId);
      if (existing) {
        existing.usageCount += 1;
        existing.lastUsedAt = now;
      } else {
        consumers.push({
          consumerId,
          consumerType,
          consumerLabel: label,
          usageCount: 1,
          firstUsedAt: now,
          lastUsedAt: now,
        });
      }
    };

    try {
      const dashboard = await this.engines.brain.getDashboard();
      if (dashboard.success && dashboard.data)
        register('enterprise-brain', 'engine', 'Enterprise Brain (EI-008)');
      else errors.push(`brain.getDashboard: ${dashboard.error ?? 'no data'}`);
    } catch (error) {
      errors.push(`brain.getDashboard: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const dashboard = await this.engines.learning.getDashboard();
      if (dashboard.success && dashboard.data)
        register('learning-intelligence', 'engine', 'Learning Intelligence (EI-007)');
      else errors.push(`learning.getDashboard: ${dashboard.error ?? 'no data'}`);
    } catch (error) {
      errors.push(
        `learning.getDashboard: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      const dashboard = await this.engines.knowledge.getDashboard();
      if (dashboard.success && dashboard.data)
        register('knowledge-intelligence', 'engine', 'Knowledge Intelligence (EI-009)');
      else errors.push(`knowledge.getDashboard: ${dashboard.error ?? 'no data'}`);
    } catch (error) {
      errors.push(
        `knowledge.getDashboard: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      const summary = await this.engines.goals.getSummary();
      if (summary.success && summary.data)
        register('goal-intelligence', 'engine', 'Goal Intelligence (EI-006)');
      else errors.push(`goals.getSummary: ${summary.error ?? 'no data'}`);
    } catch (error) {
      errors.push(`goals.getSummary: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { item: { ...item, consumers }, errors };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(dto: UpdateMemoryDTO): Promise<MemoryResult<MemoryItem>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };
    const actor = dto.actor ?? item.owner;
    const now = new Date().toISOString();

    const next: MemoryItem = {
      ...item,
      title: dto.title?.trim() || item.title,
      content: dto.content?.trim() || item.content,
      source: dto.source?.trim() || item.source,
      sourceType: dto.sourceType ?? item.sourceType,
      owner: dto.owner?.trim() || item.owner,
      relatedGoal: dto.relatedGoal ?? item.relatedGoal,
      relatedTask: dto.relatedTask ?? item.relatedTask,
      relatedCapability: dto.relatedCapability ?? item.relatedCapability,
      relatedProvider: dto.relatedProvider ?? item.relatedProvider,
      relatedProject: dto.relatedProject ?? item.relatedProject,
      relatedUser: dto.relatedUser ?? item.relatedUser,
      relatedContext: dto.relatedContext ?? item.relatedContext,
      relatedDecision: dto.relatedDecision ?? item.relatedDecision,
      relatedExecution: dto.relatedExecution ?? item.relatedExecution,
      tags: dto.tags
        ? [...new Set(dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
        : item.tags,
      confidence: dto.confidence
        ? {
            score: Math.max(0, Math.min(1, dto.confidence.score ?? item.confidence.score)),
            level:
              (dto.confidence.score ?? item.confidence.score) >= 0.8
                ? 'high'
                : (dto.confidence.score ?? item.confidence.score) >= 0.5
                  ? 'medium'
                  : 'low',
            factors: dto.confidence.factors ?? item.confidence.factors,
          }
        : item.confidence,
      retentionPolicy: dto.retentionPolicy ?? item.retentionPolicy,
      importance: this.importance.score({
        ...item,
        confidence: dto.confidence
          ? { ...item.confidence, score: dto.confidence.score ?? item.confidence.score }
          : item.confidence,
      }),
      audit: [
        ...item.audit,
        {
          auditId: generateMemoryAuditId(),
          action: 'updated',
          actor,
          note: 'Memory updated',
          timestamp: now,
        },
      ],
      updatedAt: now,
    };

    await this.repository.saveItem(next);
    return { success: true, data: next };
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(memoryId: string): Promise<MemoryResult<{ deleted: boolean }>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    await this.repository.deleteItem(memoryId);

    // Scrub stale embedded relationship references on the remaining items.
    const remaining = await this.repository.listAllItems();
    for (const other of remaining) {
      const filtered = other.relationships.filter(
        (r) => r.sourceId !== memoryId && r.targetId !== memoryId,
      );
      if (filtered.length !== other.relationships.length) {
        await this.repository.saveItem({ ...other, relationships: filtered });
      }
    }
    return { success: true, data: { deleted: true } };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getItem(memoryId: string): Promise<MemoryResult<MemoryItem>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    return { success: true, data: item };
  }

  async listItems(
    dto: MemoryListQueryDTO = {},
  ): Promise<MemoryResult<{ items: MemoryItem[]; total: number }>> {
    const pagination: PaginationParams = {
      page: Math.max(1, dto.page ?? 1),
      limit: Math.min(200, Math.max(1, dto.limit ?? 50)),
    };
    const result = await this.repository.listItems(
      {
        type: dto.type,
        sourceType: dto.sourceType,
        lifecycleStatus: dto.lifecycleStatus,
        compressionState: dto.compressionState,
        retentionPolicy: dto.retentionPolicy,
        owner: dto.owner,
        tag: dto.tag,
        relatedGoal: dto.relatedGoal,
        relatedTask: dto.relatedTask,
        relatedCapability: dto.relatedCapability,
        relatedProvider: dto.relatedProvider,
        relatedProject: dto.relatedProject,
        relatedUser: dto.relatedUser,
        relatedContext: dto.relatedContext,
        minImportance: dto.minImportance,
        minConfidence: dto.minConfidence,
      },
      pagination,
    );
    return { success: true, data: { items: result.data, total: result.total } };
  }

  // ── Retrieval (the ten modes) ─────────────────────────────────────────────

  async retrieve(dto: MemoryRetrievalDTO = {}): Promise<MemoryResult<MemorySearchResult[]>> {
    const items = await this.repository.listAllItems();
    const results = this.retrieval.retrieve(items, dto);
    return { success: true, data: results };
  }

  // ── Summarize ─────────────────────────────────────────────────────────────

  async summarize(dto: SummarizeMemoryDTO): Promise<MemoryResult<MemoryItem>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };
    const result = this.compression.compress(item, { target: dto.target, ratio: dto.ratio });
    const now = new Date().toISOString();
    const updated: MemoryItem = {
      ...item,
      summary: result.summary,
      compressionState: result.compressionState,
      audit: [
        ...item.audit,
        {
          auditId: generateMemoryAuditId(),
          action: 'compressed',
          actor: dto.actor ?? 'memory-platform',
          note: `Compressed ${result.beforeLength} → ${result.afterLength} chars`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    await this.repository.saveItem(updated);
    return { success: true, data: updated };
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  async validate(
    dto: ValidateMemoryDTO,
  ): Promise<MemoryResult<{ passed: boolean; issues: string[] }>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };

    const issues: string[] = [];
    if (!item.title || item.title.trim().length < 3)
      issues.push('title must be at least 3 characters');
    if (!item.content.trim()) issues.push('content is required');
    if (!item.source.trim()) issues.push('source is required');
    if (!item.owner.trim()) issues.push('owner is required');
    if (Number.isNaN(Date.parse(item.createdAt))) issues.push('createdAt must be a valid ISO date');
    const passed = issues.length === 0;

    const now = new Date().toISOString();
    const updated: MemoryItem = {
      ...item,
      audit: [
        ...item.audit,
        {
          auditId: generateMemoryAuditId(),
          action: 'validated',
          actor: dto.actor,
          note: passed ? 'Validation passed' : `Validation failed: ${issues.join('; ')}`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    await this.repository.saveItem(updated);
    return { success: true, data: { passed, issues } };
  }

  // ── Consolidate (Memory Pipeline stage) ───────────────────────────────────

  async consolidate(
    dto: ConsolidateMemoryDTO = {},
  ): Promise<MemoryResult<{ merged: number; candidates: number }>> {
    const items = await this.repository.listAllItems();
    const candidates = this.consolidation.findCandidates(items);
    if (dto.dryRun) {
      return { success: true, data: { merged: 0, candidates: candidates.length } };
    }
    let merged = 0;
    for (const candidate of candidates) {
      const { consolidated } = this.consolidation.consolidate(candidate);
      await this.repository.saveItem(consolidated);
      for (const duplicate of candidate.duplicates) {
        await this.repository.deleteItem(duplicate.memoryId);
      }
      merged += candidate.duplicates.length;
    }
    return { success: true, data: { merged, candidates: candidates.length } };
  }

  // ── Compress (Memory Pipeline stage) ──────────────────────────────────────

  async compressAll(
    target: MemoryItem['compressionState'] = 'summarized',
  ): Promise<MemoryResult<{ compressed: number }>> {
    const items = await this.repository.listAllItems();
    let compressed = 0;
    for (const item of items) {
      if (item.lifecycleStatus === 'expired' || item.lifecycleStatus === 'archived') continue;
      const result = this.compression.compress(item, { target });
      if (result.compressionState !== item.compressionState || result.summary !== item.summary) {
        await this.repository.saveItem({
          ...item,
          summary: result.summary,
          compressionState: result.compressionState,
        });
        compressed += 1;
      }
    }
    return { success: true, data: { compressed } };
  }

  // ── Expire (Memory Pipeline stage) ────────────────────────────────────────

  async expire(
    dto: ExpireMemoryDTO = {},
  ): Promise<MemoryResult<{ expired: number; purged: number }>> {
    const items = await this.repository.listAllItems();
    const result = this.expiration.expire(items, {
      purge: dto.purge,
      now: new Date().toISOString(),
    });
    for (const item of result.expired) {
      await this.repository.saveItem(item);
    }
    for (const item of result.purged) {
      await this.repository.deleteItem(item.memoryId);
    }
    return {
      success: true,
      data: { expired: result.expired.length, purged: result.purged.length },
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async transitionLifecycle(dto: LifecycleMemoryDTO): Promise<MemoryResult<MemoryItem>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };
    const result = this.lifecycle.transition(item, dto.to, dto.actor, dto.note);
    if (!result.transitioned)
      return { success: false, error: result.message ?? 'Invalid lifecycle transition' };
    await this.repository.saveItem(result.item);
    return { success: true, data: result.item };
  }

  // ── Relate + Graph ────────────────────────────────────────────────────────

  async relate(dto: RelateMemoryDTO): Promise<MemoryResult<MemoryRelationship>> {
    const source = await this.repository.findItemById(dto.sourceId);
    if (!source) return { success: false, error: `Source memory not found: ${dto.sourceId}` };
    const target = await this.repository.findItemById(dto.targetId);
    if (!target) return { success: false, error: `Target memory not found: ${dto.targetId}` };

    const relationship: MemoryRelationship = {
      relationshipId: generateMemoryRelationshipId(),
      type: dto.type,
      sourceId: dto.sourceId,
      sourceTitle: source.title,
      targetId: dto.targetId,
      targetTitle: target.title,
      weight: Math.max(0, Math.min(1, dto.weight ?? 0.7)),
      actor: dto.actor,
      note: dto.note,
      createdAt: new Date().toISOString(),
    };

    const integrity = this.relationships.checkIntegrity(
      relationship,
      await this.repository.listRelationships(),
    );
    if (!integrity.allowed)
      return { success: false, error: integrity.message ?? 'Relationship rejected' };

    await this.repository.saveRelationship(relationship);
    await this.repository.saveItem({
      ...source,
      relationships: this.dedupeEdges([...source.relationships, relationship]),
    });
    return { success: true, data: relationship };
  }

  /** Auto-detect relationships for a memory against the whole registry. */
  async detectRelationships(
    memoryId: string,
    actor: string,
  ): Promise<MemoryResult<MemoryRelationship[]>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    const registry = await this.repository.listAllItems();
    const detected = this.relationships.detectRelationships(item, registry, actor);
    if (detected.length === 0) return { success: true, data: [] };

    for (const edge of detected) {
      await this.repository.saveRelationship(edge);
    }
    const updated = await this.repository.findItemById(memoryId);
    await this.repository.saveItem({
      ...(updated ?? item),
      relationships: this.dedupeEdges([
        ...(updated?.relationships ?? item.relationships),
        ...detected,
      ]),
    });
    return { success: true, data: detected };
  }

  async listRelationships(
    type?: MemoryRelationshipType,
  ): Promise<MemoryResult<MemoryRelationship[]>> {
    return { success: true, data: await this.repository.listRelationships(type) };
  }

  async listRelationshipsForItem(memoryId: string): Promise<MemoryResult<MemoryRelationship[]>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    return { success: true, data: await this.repository.listRelationshipsForItem(memoryId) };
  }

  async graph(dto: GraphQueryDTO): Promise<MemoryResult<MemoryGraphTraversal>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };
    return { success: true, data: await this.graphService.traverse(dto.memoryId, dto.maxDepth) };
  }

  async shortestPath(dto: ShortestPathDTO): Promise<MemoryResult<string[]>> {
    const [from, to] = await Promise.all([
      this.repository.findItemById(dto.fromId),
      this.repository.findItemById(dto.toId),
    ]);
    if (!from || !to) return { success: false, error: 'Both endpoints must exist in the registry' };
    return { success: true, data: await this.graphService.shortestPath(dto.fromId, dto.toId) };
  }

  // ── Consumers ─────────────────────────────────────────────────────────────

  async listConsumers(memoryId: string): Promise<MemoryResult<MemoryItem['consumers']>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    return { success: true, data: [...item.consumers].sort((a, b) => b.usageCount - a.usageCount) };
  }

  async recordConsumerUsage(dto: ConsumerUsageDTO): Promise<MemoryResult<MemoryItem['consumers']>> {
    const item = await this.repository.findItemById(dto.memoryId);
    if (!item) return { success: false, error: `Memory not found: ${dto.memoryId}` };
    const now = new Date().toISOString();
    const consumers = [...item.consumers];
    const consumerId = dto.consumerId ?? generateMemoryConsumerId();
    const existing = consumers.find((c) => c.consumerId === consumerId);
    if (existing) {
      existing.usageCount += 1;
      existing.lastUsedAt = now;
    } else {
      consumers.push({
        consumerId,
        consumerType: dto.consumerType,
        consumerLabel: dto.consumerLabel,
        usageCount: 1,
        firstUsedAt: now,
        lastUsedAt: now,
      });
    }
    const updated: MemoryItem = {
      ...item,
      consumers,
      usage: {
        ...item.usage,
        totalRetrievals: item.usage.totalRetrievals + 1,
        totalConsumers: consumers.length,
        lastAccessedAt: now,
      },
      audit: [
        ...item.audit,
        {
          auditId: generateMemoryAuditId(),
          action: 'consumed',
          actor: dto.actor ?? dto.consumerLabel,
          note: `${dto.consumerLabel} retrieved this memory`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    await this.repository.saveItem(updated);
    return { success: true, data: consumers };
  }

  // ── Learn (Memory Update — reinforcement feedback) ────────────────────────

  /** Reinforce a memory: bump frequency + recency and record a `learned` audit. */
  async reinforce(memoryId: string, actor: string): Promise<MemoryResult<MemoryItem>> {
    const item = await this.repository.findItemById(memoryId);
    if (!item) return { success: false, error: `Memory not found: ${memoryId}` };
    const now = new Date().toISOString();
    const updated: MemoryItem = {
      ...item,
      usage: {
        ...item.usage,
        frequency: item.usage.frequency + 1,
        recency: Math.min(1, item.usage.recency + 0.1),
      },
      importance: this.importance.score({
        ...item,
        usage: {
          ...item.usage,
          frequency: item.usage.frequency + 1,
          recency: Math.min(1, item.usage.recency + 0.1),
        },
      }),
      audit: [
        ...item.audit,
        {
          auditId: generateMemoryAuditId(),
          action: 'learned',
          actor,
          note: 'Reinforced by feedback (Memory Update)',
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    await this.repository.saveItem(updated);
    return { success: true, data: updated };
  }

  // ── Analytics / Timeline / Dashboard ──────────────────────────────────────

  async getAnalytics(): Promise<MemoryResult<ReturnType<MemoryAnalyticsService['aggregate']>>> {
    const items = await this.repository.listAllItems();
    return { success: true, data: this.analytics.aggregate(items) };
  }

  async getTimeline(
    dto: MemoryTimelineDTO = {},
  ): Promise<MemoryResult<ReturnType<typeof MemoryMapper.timelineToDTO>>> {
    const items = await this.repository.listAllItems();
    return { success: true, data: MemoryMapper.timelineToDTO(items, dto.limit) };
  }

  async getDashboard(): Promise<MemoryResult<MemoryDashboardDTO>> {
    const items = await this.repository.listAllItems();
    const analytics = this.analytics.aggregate(items);
    return { success: true, data: MemoryMapper.dashboardToDTO({ analytics, items }) };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Deterministic identifier for a new relationship edge (exported for tests). */
  createRelationshipId(): string {
    return generateMemoryRelationshipId();
  }

  private dedupeEdges(edges: MemoryRelationship[]): MemoryRelationship[] {
    const seen = new Set<string>();
    return edges.filter((edge) => {
      const key = `${edge.type}:${edge.sourceId}:${edge.targetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

import { MEMORY_SOURCE_RELIABILITY } from '../types/memory-types.js';

/** Re-export for consumers that need the intrinsic reliability table. */
export { MEMORY_SOURCE_RELIABILITY };

/** Entity presence helper used by the gateway (same convention as other engines). */
export function requireEntity(value: string | undefined, _field: string): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

/** Re-export the MemoryType union for gateway zod building. */
export type { MemoryType };
