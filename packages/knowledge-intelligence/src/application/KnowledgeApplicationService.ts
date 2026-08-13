// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Application Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Facade over the Knowledge domain services. Exposes the API surface:
// register/update/delete items, the eight-mode search, explain,
// validate, version + diff, relate (with auto-detection), the graph
// traversal, consumers, dependencies, lifecycle transitions,
// analytics, the timeline feed, and the Knowledge Center dashboard.
//
// The Knowledge Pipeline lives here: Source → Ingestion →
// Classification → Validation → Relationship Detection → Registry →
// Versioning → Trust Scoring → Search → (Context Intelligence →
// Enterprise Brain → Execution → Learning Feedback → Knowledge Update).
// This layer performs the Registry, Versioning, Trust Scoring,
// Validation, and Relationship Detection stages; the downstream stages
// (Context/Brain/Execution/Learning) consume the registry through the
// other engines' existing flows — no duplicated logic.
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { KnowledgeEngines } from '../contracts/knowledge-engines.js';
import type { KnowledgeRepository } from '../domain/repository/KnowledgeRepository.js';
import type { KnowledgeGraph } from '../domain/graph/KnowledgeGraph.js';
import { KnowledgeTrustScoreService } from '../domain/services/KnowledgeTrustScoreService.js';
import { KnowledgeRankingService } from '../domain/services/KnowledgeRankingService.js';
import { KnowledgeSearchService } from '../domain/services/KnowledgeSearchService.js';
import { KnowledgeRelationshipService } from '../domain/services/KnowledgeRelationshipService.js';
import { KnowledgeValidationService } from '../domain/services/KnowledgeValidationService.js';
import { KnowledgeLifecycleService } from '../domain/services/KnowledgeLifecycleService.js';
import { KnowledgeVersionService } from '../domain/services/KnowledgeVersionService.js';
import { KnowledgeAnalyticsService } from '../domain/services/KnowledgeAnalyticsService.js';
import { KnowledgeCitationService } from '../domain/services/KnowledgeCitationService.js';
import { KnowledgeExplainerService } from '../domain/services/KnowledgeExplainerService.js';
import { KnowledgeEnrichmentService } from '../domain/services/KnowledgeEnrichmentService.js';
import { titleRule } from '../domain/rules/KnowledgeRules.js';
import {
  generateAuditId,
  generateCitationId,
  generateConsumerId,
  generateKnowledgeId,
  generateRelationshipId,
  generateVersionId,
} from '../domain/value-objects/KnowledgeId.js';
import type {
  KnowledgeGraphTraversal,
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
  KnowledgeSearchResult,
} from '../types/knowledge-types.js';
import { KNOWLEDGE_SOURCE_RELIABILITY } from '../types/knowledge-types.js';
import { KnowledgeMapper } from './KnowledgeMapper.js';
import type {
  ConsumerUsageDTO,
  CreateKnowledgeItemDTO,
  DiffKnowledgeDTO,
  GraphQueryDTO,
  KnowledgeDashboardDTO,
  KnowledgeListQueryDTO,
  KnowledgeSearchQueryDTO,
  KnowledgeTimelineDTO,
  LifecycleKnowledgeDTO,
  RelateKnowledgeDTO,
  ShortestPathDTO,
  UpdateKnowledgeItemDTO,
  ValidateKnowledgeDTO,
  VersionKnowledgeDTO,
} from './KnowledgeDTO.js';

export interface KnowledgeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** Engine consultation errors tolerated during enrichment. */
  errors?: string[];
}

export const KNOWLEDGE_DEFAULT_CONFIDENCE = 0.75;

export class KnowledgeApplicationService {
  private readonly trust: KnowledgeTrustScoreService;
  private readonly ranking: KnowledgeRankingService;
  private readonly searcher: KnowledgeSearchService;
  private readonly relationships: KnowledgeRelationshipService;
  private readonly validation: KnowledgeValidationService;
  private readonly lifecycle: KnowledgeLifecycleService;
  private readonly versions: KnowledgeVersionService;
  private readonly analytics: KnowledgeAnalyticsService;
  private readonly citations: KnowledgeCitationService;
  private readonly explainer: KnowledgeExplainerService;
  private readonly enrichment: KnowledgeEnrichmentService;

  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly graphService: KnowledgeGraph,
    private readonly engines: KnowledgeEngines,
  ) {
    this.trust = new KnowledgeTrustScoreService();
    this.ranking = new KnowledgeRankingService();
    this.searcher = new KnowledgeSearchService(this.ranking);
    this.relationships = new KnowledgeRelationshipService();
    this.validation = new KnowledgeValidationService();
    this.lifecycle = new KnowledgeLifecycleService(this.trust);
    this.versions = new KnowledgeVersionService();
    this.analytics = new KnowledgeAnalyticsService();
    this.citations = new KnowledgeCitationService();
    this.explainer = new KnowledgeExplainerService(this.ranking);
    this.enrichment = new KnowledgeEnrichmentService();
  }

  // ── Register (Source → Ingestion → Classification → Registry) ─────────────

  async create(dto: CreateKnowledgeItemDTO): Promise<KnowledgeResult<KnowledgeItem>> {
    const titleCheck = titleRule(dto.title);
    if (!titleCheck.passed)
      return { success: false, error: titleCheck.message ?? 'title is required' };
    if (!dto.description.trim()) return { success: false, error: 'description is required' };
    if (!dto.source.trim()) return { success: false, error: 'source is required' };
    if (!dto.owner.trim()) return { success: false, error: 'owner is required' };

    const actor = dto.actor ?? 'knowledge-platform';
    const now = new Date().toISOString();
    const knowledgeId = generateKnowledgeId(dto.title);

    const confidenceScore = Math.max(
      0,
      Math.min(1, dto.confidence?.score ?? KNOWLEDGE_DEFAULT_CONFIDENCE),
    );
    const confidence: KnowledgeItem['confidence'] = {
      score: confidenceScore,
      level: confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.5 ? 'medium' : 'low',
      factors: dto.confidence?.factors ?? ['Owner-reported confidence'],
    };

    const title = dto.title.trim();
    const description = dto.description.trim();
    const source = dto.source.trim();
    const owner = dto.owner.trim();
    const tags = [...new Set((dto.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];

    const baseItem: KnowledgeItem = {
      knowledgeId,
      title,
      description,
      source,
      sourceType: dto.sourceType,
      owner,
      category: dto.category,
      tags,
      trust: { score: 0, level: 'low', factors: [] },
      confidence,
      version: 1,
      // The registry invariant: every item's version history starts with its
      // initial registration snapshot, so `listVersions` and
      // `diff(from: 1, to: n)` resolve for brand-new items too.
      versionHistory: [
        {
          versionId: generateVersionId(),
          knowledgeId,
          versionNumber: 1,
          title,
          description,
          tags,
          changeSummary: 'Initial registration',
          actor,
          createdAt: now,
        },
      ],
      consumers: [],
      dependencies: [],
      relationships: [],
      citations: this.citations.verify(
        (dto.citations ?? []).map((citation) => ({
          citationId: generateCitationId(),
          sourceId: citation.sourceId,
          sourceTitle: citation.sourceTitle,
          sourceType: citation.sourceType ?? dto.sourceType,
          reference: citation.reference,
          retrievedAt: now,
          verified: false,
        })),
        dto.sourceType,
      ),
      usage: { totalReads: 0, totalConsumers: 0 },
      validationStatus: 'pending',
      lifecycleStatus: 'draft',
      audit: [
        {
          auditId: generateAuditId(),
          action: 'created',
          actor,
          note: `Registered from ${dto.source}`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Trust scoring.
    baseItem.trust = this.trust.score(baseItem);

    // Relationship detection against the existing registry (auto-relate).
    const registry = await this.repository.listAllItems();
    const detected = this.relationships.detectRelationships(baseItem, registry, actor);
    baseItem.relationships = [...baseItem.relationships, ...detected];

    // Engine enrichment (cross-links + consumer registry) — graceful.
    let errors: string[] | undefined;
    if (dto.enrich !== false) {
      const enriched = await this.enrichment.enrich(baseItem, this.engines, registry);
      errors = enriched.errors.length > 0 ? enriched.errors : undefined;
      baseItem.relationships = enriched.item.relationships;
      baseItem.consumers = enriched.item.consumers;
      baseItem.usage = enriched.item.usage;
    }

    // Registry write (item + its edges).
    await this.repository.saveItem(baseItem);
    for (const edge of baseItem.relationships) {
      await this.repository.saveRelationship(edge);
    }

    return { success: true, data: baseItem, errors };
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(dto: UpdateKnowledgeItemDTO): Promise<KnowledgeResult<KnowledgeItem>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    const actor = dto.actor ?? item.owner;

    // Snapshot the current revision before mutating (version history).
    let current = item;
    if (dto.version !== false) {
      current = this.versions.createVersion(item, 'Pre-update snapshot', actor).item;
    }

    const now = new Date().toISOString();
    const next: KnowledgeItem = {
      ...current,
      title: dto.title?.trim() || current.title,
      description: dto.description?.trim() || current.description,
      source: dto.source?.trim() || current.source,
      sourceType: dto.sourceType ?? current.sourceType,
      owner: dto.owner?.trim() || current.owner,
      category: dto.category ?? current.category,
      tags: dto.tags
        ? [...new Set(dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
        : current.tags,
      confidence: dto.confidence
        ? {
            score: Math.max(0, Math.min(1, dto.confidence.score ?? current.confidence.score)),
            level:
              (dto.confidence.score ?? current.confidence.score) >= 0.8
                ? 'high'
                : (dto.confidence.score ?? current.confidence.score) >= 0.5
                  ? 'medium'
                  : 'low',
            factors: dto.confidence.factors ?? current.confidence.factors,
          }
        : current.confidence,
      audit: [
        ...current.audit,
        {
          auditId: generateAuditId(),
          action: 'updated',
          actor,
          note: 'Content updated',
          timestamp: now,
        },
      ],
      updatedAt: now,
    };

    // Re-score trust on every mutation (provenance/validation may have changed).
    next.trust = this.trust.score(next);

    await this.repository.saveItem(next);
    return { success: true, data: next };
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(knowledgeId: string): Promise<KnowledgeResult<{ deleted: boolean }>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    await this.repository.deleteItem(knowledgeId);

    // Scrub stale embedded relationship references on the remaining items.
    const remaining = await this.repository.listAllItems();
    for (const other of remaining) {
      const filtered = other.relationships.filter(
        (r) => r.sourceId !== knowledgeId && r.targetId !== knowledgeId,
      );
      if (filtered.length !== other.relationships.length) {
        await this.repository.saveItem({ ...other, relationships: filtered });
      }
    }
    return { success: true, data: { deleted: true } };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getItem(knowledgeId: string): Promise<KnowledgeResult<KnowledgeItem>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: item };
  }

  async listItems(
    dto: KnowledgeListQueryDTO = {},
  ): Promise<KnowledgeResult<{ items: KnowledgeItem[]; total: number }>> {
    const pagination: PaginationParams = {
      page: Math.max(1, dto.page ?? 1),
      limit: Math.min(200, Math.max(1, dto.limit ?? 50)),
    };
    const result = await this.repository.listItems(
      {
        category: dto.category,
        sourceType: dto.sourceType,
        lifecycleStatus: dto.lifecycleStatus,
        validationStatus: dto.validationStatus,
        owner: dto.owner,
        tag: dto.tag,
        minTrust: dto.minTrust,
      },
      pagination,
    );
    return { success: true, data: { items: result.data, total: result.total } };
  }

  // ── Search (the eight modes) ──────────────────────────────────────────────

  async search(
    dto: KnowledgeSearchQueryDTO = {},
  ): Promise<KnowledgeResult<KnowledgeSearchResult[]>> {
    const items = await this.repository.listAllItems();
    const results = this.searcher.search(items, dto);
    return { success: true, data: results };
  }

  // ── Explain ───────────────────────────────────────────────────────────────

  async explain(
    knowledgeId: string,
  ): Promise<KnowledgeResult<ReturnType<KnowledgeExplainerService['explain']>>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: this.explainer.explain(item) };
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  async validate(
    dto: ValidateKnowledgeDTO,
  ): Promise<KnowledgeResult<ReturnType<KnowledgeValidationService['validate']>>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };

    const registry = await this.repository.listAllItems();
    const knownIds = new Set(registry.map((i) => i.knowledgeId));
    const report = this.validation.validate(item, { requireResolvedRelationships: true, knownIds });

    // Persist the validation outcome (pending → validated / failed).
    const target: KnowledgeItem['validationStatus'] = report.passed ? 'validated' : 'failed';
    if (item.validationStatus !== target) {
      const now = new Date().toISOString();
      const updated: KnowledgeItem = {
        ...item,
        validationStatus: target,
        trust: this.trust.score({ ...item, validationStatus: target }),
        audit: [
          ...item.audit,
          {
            auditId: generateAuditId(),
            action: 'validated',
            actor: dto.actor,
            note: report.passed
              ? 'Validation passed'
              : `Validation failed: ${report.issues.join('; ')}`,
            timestamp: now,
          },
        ],
        updatedAt: now,
      };
      await this.repository.saveItem(updated);
    }
    return { success: true, data: report };
  }

  // ── Version + Diff ────────────────────────────────────────────────────────

  async createVersion(dto: VersionKnowledgeDTO): Promise<KnowledgeResult<KnowledgeItem>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    const { item: updated } = this.versions.createVersion(item, dto.changeSummary, dto.actor);
    await this.repository.saveItem(updated);
    return { success: true, data: updated };
  }

  async listVersions(
    knowledgeId: string,
  ): Promise<KnowledgeResult<ReturnType<KnowledgeVersionService['listVersions']>>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: this.versions.listVersions(item) };
  }

  async getVersion(
    knowledgeId: string,
    versionNumber: number,
  ): Promise<KnowledgeResult<ReturnType<KnowledgeVersionService['getVersion']>>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    const version = this.versions.getVersion(item, versionNumber);
    if (!version)
      return { success: false, error: `Version ${versionNumber} not found for ${knowledgeId}` };
    return { success: true, data: version };
  }

  async diff(
    dto: DiffKnowledgeDTO,
  ): Promise<KnowledgeResult<ReturnType<KnowledgeVersionService['diff']>>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    const result = this.versions.diff(item, dto.fromVersion, dto.toVersion);
    if (!result)
      return { success: false, error: 'At least two versions are required to compute a diff' };
    return { success: true, data: result };
  }

  // ── Relate (Relationship Detection + Registry) ────────────────────────────

  async relate(dto: RelateKnowledgeDTO): Promise<KnowledgeResult<KnowledgeRelationship>> {
    const source = await this.repository.findItemById(dto.sourceId);
    if (!source) return { success: false, error: `Source item not found: ${dto.sourceId}` };
    const target = await this.repository.findItemById(dto.targetId);
    if (!target) return { success: false, error: `Target item not found: ${dto.targetId}` };

    const relationship: KnowledgeRelationship = {
      relationshipId: generateRelationshipId(),
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

  /** Auto-detect relationships for an item against the whole registry. */
  async detectRelationships(
    knowledgeId: string,
    actor: string,
  ): Promise<KnowledgeResult<KnowledgeRelationship[]>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    const registry = await this.repository.listAllItems();
    const detected = this.relationships.detectRelationships(item, registry, actor);
    if (detected.length === 0) return { success: true, data: [] };

    for (const edge of detected) {
      await this.repository.saveRelationship(edge);
    }
    const updated = await this.repository.findItemById(knowledgeId);
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
    type?: KnowledgeRelationshipType,
  ): Promise<KnowledgeResult<KnowledgeRelationship[]>> {
    return { success: true, data: await this.repository.listRelationships(type) };
  }

  async listRelationshipsForItem(
    knowledgeId: string,
  ): Promise<KnowledgeResult<KnowledgeRelationship[]>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: await this.repository.listRelationshipsForItem(knowledgeId) };
  }

  // ── Graph ─────────────────────────────────────────────────────────────────

  async graph(dto: GraphQueryDTO): Promise<KnowledgeResult<KnowledgeGraphTraversal>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    return { success: true, data: await this.graphService.traverse(dto.knowledgeId, dto.maxDepth) };
  }

  async shortestPath(dto: ShortestPathDTO): Promise<KnowledgeResult<string[]>> {
    const [from, to] = await Promise.all([
      this.repository.findItemById(dto.fromId),
      this.repository.findItemById(dto.toId),
    ]);
    if (!from || !to) return { success: false, error: 'Both endpoints must exist in the registry' };
    return { success: true, data: await this.graphService.shortestPath(dto.fromId, dto.toId) };
  }

  // ── Consumers ─────────────────────────────────────────────────────────────

  async listConsumers(knowledgeId: string): Promise<KnowledgeResult<KnowledgeItem['consumers']>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: [...item.consumers].sort((a, b) => b.usageCount - a.usageCount) };
  }

  async recordConsumerUsage(
    dto: ConsumerUsageDTO,
  ): Promise<KnowledgeResult<KnowledgeItem['consumers']>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    const now = new Date().toISOString();
    const consumers = [...item.consumers];
    const consumerId = dto.consumerId ?? generateConsumerId();
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
    const updated: KnowledgeItem = {
      ...item,
      consumers,
      usage: {
        totalReads: item.usage.totalReads + 1,
        totalConsumers: consumers.length,
        lastAccessedAt: now,
      },
      audit: [
        ...item.audit,
        {
          auditId: generateAuditId(),
          action: 'consumed',
          actor: dto.actor ?? dto.consumerLabel,
          note: `${dto.consumerLabel} read this knowledge`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    await this.repository.saveItem(updated);
    return { success: true, data: consumers };
  }

  // ── Dependencies ──────────────────────────────────────────────────────────

  async listDependencies(
    knowledgeId: string,
  ): Promise<KnowledgeResult<KnowledgeItem['dependencies']>> {
    const item = await this.repository.findItemById(knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${knowledgeId}` };
    return { success: true, data: this.relationships.deriveDependencies(item) };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async transitionLifecycle(dto: LifecycleKnowledgeDTO): Promise<KnowledgeResult<KnowledgeItem>> {
    const item = await this.repository.findItemById(dto.knowledgeId);
    if (!item) return { success: false, error: `Knowledge item not found: ${dto.knowledgeId}` };
    const result = this.lifecycle.transition(item, dto.to, dto.actor, dto.note);
    if (!result.transitioned)
      return { success: false, error: result.message ?? 'Invalid lifecycle transition' };
    await this.repository.saveItem(result.item);
    return { success: true, data: result.item };
  }

  // ── Analytics / Timeline / Dashboard / Registry ───────────────────────────

  async getAnalytics(): Promise<
    KnowledgeResult<ReturnType<KnowledgeAnalyticsService['aggregate']>>
  > {
    const items = await this.repository.listAllItems();
    return { success: true, data: this.analytics.aggregate(items) };
  }

  async getTimeline(
    dto: KnowledgeTimelineDTO = {},
  ): Promise<KnowledgeResult<ReturnType<typeof KnowledgeMapper.timelineToDTO>>> {
    const items = await this.repository.listAllItems();
    return { success: true, data: KnowledgeMapper.timelineToDTO(items, dto.limit) };
  }

  async getDashboard(): Promise<KnowledgeResult<KnowledgeDashboardDTO>> {
    const items = await this.repository.listAllItems();
    const analytics = this.analytics.aggregate(items);
    return { success: true, data: KnowledgeMapper.dashboardToDTO({ analytics, items }) };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Deterministic identifier for a new relationship edge (exported for tests). */
  createRelationshipId(): string {
    return generateRelationshipId();
  }

  private dedupeEdges(edges: KnowledgeRelationship[]): KnowledgeRelationship[] {
    const seen = new Set<string>();
    return edges.filter((edge) => {
      const key = `${edge.type}:${edge.sourceId}:${edge.targetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/** Re-export for consumers that need the intrinsic reliability table. */
export { KNOWLEDGE_SOURCE_RELIABILITY };

/** Entity presence helper used by the gateway (same convention as other engines). */
export function requireEntity(value: string | undefined, _field: string): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}
