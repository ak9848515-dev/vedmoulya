// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Hybrid Retrieval
// APP-001 — Post-V1 Application Platform Layer
// A strategy-driven retrieval pipeline that can combine keyword
// matching, metadata filtering, graph relationships, memory
// relevance, recency, user relevance and permission filtering.
// The algorithm is NOT hardcoded: `RetrievalStrategy` is the seam so
// ranking can evolve (vector/semantic strategies can be added later
// behind the same interface — the fabric stays provider-independent).
// Everything here is deterministic — no LLM is required for basic
// context retrieval.
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextRelationship,
  ContextRetrievalQuery,
  ContextRetrievalResult,
} from '../../types/fabric-types.js';

export interface RetrievalStrategy {
  readonly id: string;
  /** Score an entity 0–1 for the query under this strategy. */
  score(entity: ContextEntity, query: ContextRetrievalQuery): number;
  /** Human-readable reason the entity matched under this strategy. */
  reason(entity: ContextEntity, query: ContextRetrievalQuery): string;
}

// ── Deterministic lexical keyword strategy ────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1);
}

export class KeywordStrategy implements RetrievalStrategy {
  readonly id = 'keyword';

  score(entity: ContextEntity, query: ContextRetrievalQuery): number {
    if (!query.query.trim()) return 0;
    const queryTokens = tokenize(query.query);
    if (queryTokens.length === 0) return 0;
    const haystack = tokenize(
      `${entity.label} ${entity.description ?? ''} ${entity.tags.join(' ')}`,
    );
    const hits = queryTokens.filter((token) => haystack.includes(token)).length;
    return hits / queryTokens.length;
  }

  reason(_entity: ContextEntity, query: ContextRetrievalQuery): string {
    return `matches keyword "${query.query}"`;
  }
}

// ── Metadata / filter strategy (source, type, tags, confidence) ───

export class MetadataStrategy implements RetrievalStrategy {
  readonly id = 'metadata';

  private matchesFilters(entity: ContextEntity, query: ContextRetrievalQuery): boolean {
    const filters = query.filters;
    if (!filters) return true;
    if (filters.sources && !filters.sources.includes(entity.source)) return false;
    if (filters.types && !filters.types.includes(entity.type)) return false;
    if (filters.tags && !filters.tags.some((tag) => entity.tags.includes(tag))) return false;
    if (filters.minConfidence !== undefined && entity.confidence < filters.minConfidence)
      return false;
    if (filters.dateFrom && entity.updatedAt < filters.dateFrom) return false;
    if (filters.dateTo && entity.updatedAt > filters.dateTo) return false;
    return true;
  }

  score(entity: ContextEntity, query: ContextRetrievalQuery): number {
    return this.matchesFilters(entity, query) ? 1 : 0;
  }

  reason(entity: ContextEntity, query: ContextRetrievalQuery): string {
    return this.matchesFilters(entity, query)
      ? `satisfies the requested filters (source:${entity.source}, type:${entity.type})`
      : 'does not satisfy the requested filters';
  }
}

// ── Graph proximity strategy (related to goal/project/task) ───────

export class GraphProximityStrategy implements RetrievalStrategy {
  readonly id = 'graph_proximity';
  constructor(
    private readonly graph?: {
      neighbors(entityId: string): Promise<unknown[]>;
    },
  ) {}

  score(_entity: ContextEntity, _query: ContextRetrievalQuery): number {
    // Graph traversal is applied by the search service (async); the
    // strategy supplies the reason for the boost applied there.
    return 0.5;
  }

  reason(entity: ContextEntity, query: ContextRetrievalQuery): string {
    const anchor = query.taskId ?? query.projectId ?? query.goalId ?? 'the current goal';
    return `connected to ${anchor} in the ${entity.graph} graph`;
  }
}

// ── Recency strategy (freshness) ──────────────────────────────────

export class RecencyStrategy implements RetrievalStrategy {
  readonly id = 'recency';
  constructor(private readonly now?: string) {}

  score(entity: ContextEntity, _query: ContextRetrievalQuery): number {
    const nowMs = this.now ? Date.parse(this.now) : Date.now();
    const updatedMs = Date.parse(entity.updatedAt);
    if (Number.isNaN(updatedMs)) return 0;
    // 90-day half-life for recency signal.
    const ageDays = Math.max(0, (nowMs - updatedMs) / 86_400_000);
    return Math.max(0, Math.exp(-ageDays / 90));
  }

  reason(_entity: ContextEntity, _query: ContextRetrievalQuery): string {
    return 'recently updated';
  }
}

// ── Confidence strategy (data quality) ────────────────────────────

export class ConfidenceStrategy implements RetrievalStrategy {
  readonly id = 'confidence';

  score(entity: ContextEntity, _query: ContextRetrievalQuery): number {
    return entity.confidence;
  }

  reason(entity: ContextEntity, _query: ContextRetrievalQuery): string {
    return `high confidence (${Math.round(entity.confidence * 100)}%)`;
  }
}

// ── Memory relevance strategy (recall weight from memory engine) ──

export class MemoryRelevanceStrategy implements RetrievalStrategy {
  readonly id = 'memory_relevance';
  constructor(private readonly relevanceById: Map<string, number> = new Map()) {}

  score(entity: ContextEntity, _query: ContextRetrievalQuery): number {
    return this.relevanceById.get(entity.entityId) ?? 0;
  }

  reason(_entity: ContextEntity, _query: ContextRetrievalQuery): string {
    return 'high relevance in memory';
  }
}

// ── The search service (strategy composition) ─────────────────────

export interface SearchServiceOptions {
  strategies?: RetrievalStrategy[];
  defaultLimit?: number;
  /** Token budget applied before returning the candidate set. */
}

export class ContextSearchService {
  private readonly strategies: RetrievalStrategy[];

  constructor(
    private readonly graph?: {
      neighbors(entityId: string): Promise<ContextRelationship[]>;
    },
    options: SearchServiceOptions = {},
  ) {
    this.strategies = options.strategies ?? [
      new KeywordStrategy(),
      new MetadataStrategy(),
      new RecencyStrategy(),
      new ConfidenceStrategy(),
    ];
  }

  /**
   * Hybrid retrieval: score every eligible entity across all
   * strategies, apply a deterministic weighted blend (with a
   * mandatory permission gate applied by the caller), and return the
   * ranked candidates with per-entity reasons.
   */
  async search(
    entities: ContextEntity[],
    query: ContextRetrievalQuery,
    weights: Record<string, number> = {
      keyword: 0.5,
      metadata: 0.2,
      recency: 0.15,
      confidence: 0.15,
    },
  ): Promise<ContextRetrievalResult> {
    const startedAt = performance.now();
    const limit = query.limit ?? 20;

    const ranked = await Promise.all(
      entities.map(async (entity) => {
        const components: Record<string, number> = {};
        const reasons: string[] = [];
        let score = 0;
        let weightTotal = 0;
        for (const strategy of this.strategies) {
          const weight = weights[strategy.id] ?? 0;
          if (weight <= 0) continue;
          const s = strategy.score(entity, query);
          if (s > 0) {
            components[strategy.id] = s;
            reasons.push(strategy.reason(entity, query));
            score += s * weight;
            weightTotal += weight;
          }
        }
        // Graph proximity boost (async traversal) — a bounded additive
        // bonus on top of the blended base score (never dilutes it).
        let finalScore = weightTotal > 0 ? Math.min(1, score / weightTotal) : 0;
        if (this.graph && (query.goalId || query.projectId || query.taskId)) {
          const edges = await this.graph.neighbors(entity.entityId);
          if (edges.length > 0) {
            const proximity = Math.min(1, edges.length / 3);
            finalScore = Math.min(1, finalScore + proximity * (weights.graph_proximity ?? 0.1));
            components.graph_proximity = proximity;
            reasons.push(`connected to ${query.goalId ?? query.projectId ?? query.taskId}`);
          }
        }

        return { entity, score: finalScore, components, reasons };
      }),
    );

    ranked.sort((a, b) => b.score - a.score);
    const selected = ranked.slice(0, limit);

    return {
      query,
      entities: selected.map((r) => r.entity),
      relationships: [],
      ranking: selected.map((r) => ({
        entityId: r.entity.entityId,
        score: r.score,
        components: r.components,
        reasons: r.reasons,
      })),
      total: ranked.length,
      latencyMs: performance.now() - startedAt,
    };
  }
}
