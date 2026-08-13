// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Search Service
// EI-009 — Enterprise Knowledge Intelligence Platform

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed Record lookups keyed by the closed
   KnowledgeCategory union (KNOWLEDGE_CATEGORY_LABELS[category]) — no runtime
   attacker-controlled keys ever reach them. */

// The eight knowledge search modes:
//   semantic · keyword · category · relationship · dependency
//   consumer · trust · version
//
// Semantic search is a deterministic lexical-semantic ranker (weighted
// term-overlap cosine over title/description/tags/source) — NOT an LLM
// and NOT a vector database. The Knowledge Layer stays a pure platform
// component: deterministic, offline, and fully unit-testable. A future
// embedding provider can be swapped in behind the same interface.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeCategory,
  KnowledgeConsumerType,
  KnowledgeItem,
  KnowledgeMatchType,
  KnowledgeRelationshipType,
  KnowledgeSearchResult,
  KnowledgeSourceType,
  KnowledgeValidationStatus,
  KnowledgeLifecycleStatus,
} from '../../types/knowledge-types.js';
import { KNOWLEDGE_CATEGORIES, KNOWLEDGE_CATEGORY_LABELS } from '../../types/knowledge-types.js';
import { KnowledgeRankingService } from './KnowledgeRankingService.js';

export interface KnowledgeSearchQuery {
  /** Free-text query ('' matches everything when only filters are given). */
  query?: string;
  category?: KnowledgeCategory;
  sourceType?: KnowledgeSourceType;
  lifecycleStatus?: KnowledgeLifecycleStatus;
  validationStatus?: KnowledgeValidationStatus;
  tags?: string[];
  /** Relationship-mode filter: edges of this type. */
  relationshipType?: KnowledgeRelationshipType;
  /** Relationship-mode filter: edges targeting this knowledgeId. */
  relationshipTargetId?: string;
  /** Dependency-mode filter: items depending on this knowledgeId. */
  dependencyTargetId?: string;
  /** Consumer-mode filter: consumers of this type. */
  consumerType?: KnowledgeConsumerType;
  /** Trust-mode filter: only items with trust >= this score. */
  minTrust?: number;
  /** Version-mode filter: items at exactly this version number. */
  versionNumber?: number;
  limit?: number;
  offset?: number;
}

interface TokenVector {
  tokens: Map<string, number>;
  norm: number;
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'for',
  'and',
  'or',
  'to',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'is',
  'are',
  'was',
  'were',
  'this',
  'that',
  'how',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'it',
  'its',
  'our',
  'we',
]);

export class KnowledgeSearchService {
  private readonly ranking: KnowledgeRankingService;

  constructor(ranking: KnowledgeRankingService = new KnowledgeRankingService()) {
    this.ranking = ranking;
  }

  /** Search the registry with all eight modes combined (best match wins). */
  search(items: readonly KnowledgeItem[], query: KnowledgeSearchQuery): KnowledgeSearchResult[] {
    const limit = Math.max(1, Math.min(100, query.limit ?? 20));
    const offset = Math.max(0, query.offset ?? 0);
    const rawQuery = query.query ?? '';
    const queryVector = this.vectorize(`${rawQuery} ${(query.tags ?? []).join(' ')}`);

    // A query that names a knowledge category acts as an implicit category
    // filter (e.g. "SAP Knowledge" searches only the SAP category).
    const effectiveQuery: KnowledgeSearchQuery = query.category
      ? query
      : { ...query, category: this.namedCategory(rawQuery) ?? query.category };

    const scored: KnowledgeSearchResult[] = [];
    for (const item of items) {
      if (!this.passesFilters(item, effectiveQuery)) continue;

      const semantic = this.semanticScore(queryVector, item);
      const keyword = this.keywordScore(rawQuery, item);
      const mode = this.detectMatchMode(item, query, semantic, keyword);

      if (semantic === 0 && keyword === 0 && mode === null) continue;

      const score = round(Math.max(semantic, keyword));
      const matchedFields = this.matchedFields(rawQuery, item, mode);
      scored.push({
        item,
        matchType: mode ?? (semantic >= keyword ? 'semantic' : 'keyword'),
        score,
        matchedFields,
        snippet: this.snippet(item, rawQuery),
      });
    }

    return scored
      .sort((a, b) => b.score - a.score || b.item.trust.score - a.item.trust.score)
      .slice(offset, offset + limit);
  }

  /** The category named by a free-text query, if any. */
  private namedCategory(rawQuery: string): KnowledgeCategory | undefined {
    const normalized = rawQuery.trim().toLowerCase();
    return KNOWLEDGE_CATEGORIES.find(
      (category) =>
        normalized === category ||
        normalized === KNOWLEDGE_CATEGORY_LABELS[category].toLowerCase() ||
        normalized.includes(KNOWLEDGE_CATEGORY_LABELS[category].toLowerCase()),
    );
  }

  /** Rank every item by the composite ranking score (search-less explorer). */
  rankAll(items: readonly KnowledgeItem[]): Array<{ item: KnowledgeItem; score: number }> {
    return this.ranking.rank(items).map((r) => ({ item: r.item, score: r.score }));
  }

  // ── Mode detection ────────────────────────────────────────────────────────

  private detectMatchMode(
    item: KnowledgeItem,
    query: KnowledgeSearchQuery,
    semantic: number,
    keyword: number,
  ): KnowledgeMatchType | null {
    const rawQuery = query.query ?? '';

    // Named-mode detection: the query itself names a category or a
    // relationship type — these win regardless of token scores.
    if (this.queryNamesCategory(rawQuery)) return 'category';
    if (this.queryNamesRelationship(rawQuery)) return 'relationship';

    // Filter modes: the query carries an explicit structural filter — the
    // item already passed `passesFilters`, so it matches in that mode even
    // when the free-text score is zero (empty query).
    if (query.category) return 'category';
    if (query.relationshipType || query.relationshipTargetId) return 'relationship';
    if (query.dependencyTargetId) return 'dependency';
    if (query.consumerType) return 'consumer';
    if (query.minTrust !== undefined) return 'trust';
    if (query.versionNumber !== undefined) return 'version';

    // Text modes: no structural signal — semantic wins ties so natural
    // language phrases prefer the lexical-semantic ranker.
    if (semantic === 0 && keyword === 0) return null;
    return semantic >= keyword ? 'semantic' : 'keyword';
  }

  private queryNamesCategory(query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return KNOWLEDGE_CATEGORIES.some(
      (category) =>
        normalized === category ||
        normalized === KNOWLEDGE_CATEGORY_LABELS[category].toLowerCase() ||
        normalized.includes(KNOWLEDGE_CATEGORY_LABELS[category].toLowerCase()),
    );
  }

  private queryNamesRelationship(query: string): boolean {
    const normalized = query.trim().toLowerCase();
    return [
      'parent',
      'child',
      'depends on',
      'related',
      'implements',
      'consumes',
      'produces',
      'supersedes',
      'uses',
      'owned by',
    ].some((label) => normalized.includes(label));
  }

  // ── Scoring ───────────────────────────────────────────────────────────────

  private semanticScore(queryVector: TokenVector, item: KnowledgeItem): number {
    if (queryVector.norm === 0) return 0;
    const itemVector = this.vectorize(
      `${item.title} ${item.description} ${item.tags.join(' ')} ${item.source}`,
    );
    let dot = 0;
    for (const [token, weight] of itemVector.tokens) {
      const qw = queryVector.tokens.get(token);
      if (qw !== undefined) dot += qw * weight;
    }
    if (itemVector.norm === 0) return 0;
    return round(Math.max(0, dot / (queryVector.norm * itemVector.norm)));
  }

  private keywordScore(query: string, item: KnowledgeItem): number {
    if (!query.trim()) return 0;
    const tokens = this.tokenize(query);
    if (tokens.length === 0) return 0;
    const text =
      `${item.title} ${item.title} ${item.title} ${item.description} ${item.tags.join(' ')} ${item.source} ${item.owner}`.toLowerCase();
    const hits = tokens.filter((token) => text.includes(token)).length;
    return round(hits / tokens.length);
  }

  private matchedFields(
    query: string,
    item: KnowledgeItem,
    mode: KnowledgeMatchType | null,
  ): string[] {
    const fields: string[] = [];
    const q = query.trim().toLowerCase();
    if (q && item.title.toLowerCase().includes(q)) fields.push('title');
    if (q && item.description.toLowerCase().includes(q)) fields.push('description');
    if (q && item.tags.some((tag) => tag.toLowerCase().includes(q))) fields.push('tags');
    if (q && item.source.toLowerCase().includes(q)) fields.push('source');
    if (q && item.owner.toLowerCase().includes(q)) fields.push('owner');
    if (mode === 'category') fields.push('category');
    if (mode === 'relationship') fields.push('relationships');
    if (mode === 'dependency') fields.push('dependencies');
    if (mode === 'consumer') fields.push('consumers');
    if (mode === 'trust') fields.push('trust');
    if (mode === 'version') fields.push('version');
    if (fields.length === 0 && q) fields.push('content');
    return fields;
  }

  private snippet(item: KnowledgeItem, query: string): string {
    const description = item.description;
    const q = query.trim().toLowerCase();
    if (q) {
      const index = description.toLowerCase().indexOf(q);
      if (index >= 0) {
        const start = Math.max(0, index - 40);
        const end = Math.min(description.length, index + q.length + 80);
        return `${start > 0 ? '…' : ''}${description.slice(start, end)}${end < description.length ? '…' : ''}`;
      }
    }
    return description.length > 120 ? `${description.slice(0, 120)}…` : description;
  }

  private passesFilters(item: KnowledgeItem, query: KnowledgeSearchQuery): boolean {
    if (query.category && item.category !== query.category) return false;
    if (query.sourceType && item.sourceType !== query.sourceType) return false;
    if (query.lifecycleStatus && item.lifecycleStatus !== query.lifecycleStatus) return false;
    if (query.validationStatus && item.validationStatus !== query.validationStatus) return false;
    if (query.minTrust !== undefined && item.trust.score < query.minTrust) return false;
    if (query.versionNumber !== undefined && item.version !== query.versionNumber) return false;
    if (query.tags && query.tags.length > 0 && !query.tags.every((tag) => item.tags.includes(tag)))
      return false;
    if (
      query.relationshipType &&
      !item.relationships.some((r) => r.type === query.relationshipType)
    )
      return false;
    if (
      query.relationshipTargetId &&
      !item.relationships.some((r) => r.targetId === query.relationshipTargetId)
    )
      return false;
    // Dependencies are DERIVED from outgoing depends_on/consumes/uses edges, so
    // the filter accepts either a stored dependency or the equivalent edge.
    if (
      query.dependencyTargetId &&
      !item.dependencies.some((d) => d.targetId === query.dependencyTargetId) &&
      !item.relationships.some(
        (r) =>
          r.targetId === query.dependencyTargetId &&
          (r.type === 'depends_on' || r.type === 'consumes' || r.type === 'uses'),
      )
    ) {
      return false;
    }
    if (query.consumerType && !item.consumers.some((c) => c.consumerType === query.consumerType))
      return false;
    return true;
  }

  // ── Tokenization ──────────────────────────────────────────────────────────

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  }

  private vectorize(text: string): TokenVector {
    const tokens = new Map<string, number>();
    for (const token of this.tokenize(text)) {
      tokens.set(token, (tokens.get(token) ?? 0) + 1);
    }
    let norm = 0;
    for (const weight of tokens.values()) {
      norm += weight * weight;
    }
    return { tokens, norm: Math.sqrt(norm) };
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
