// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Retrieval Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage: Retrieval. The Retrieval Console surface —
// recall memories By Goal, Project, User, Capability, Provider,
// Context, Time, Importance, Similarity, or Business Module. Similarity
// is a deterministic lexical token-overlap scorer (no LLM, no vector
// DB), the same philosophy as the EI-009 semantic search.
// ──────────────────────────────────────────────────────────────────

import type { MemoryItem, MemoryMatchType, MemorySearchResult } from '../../types/memory-types.js';
import { MemoryRankingService } from './MemoryRankingService.js';

export interface MemoryRetrievalQuery {
  query?: string;
  relatedGoal?: string;
  relatedProject?: string;
  relatedUser?: string;
  relatedCapability?: string;
  relatedProvider?: string;
  relatedContext?: string;
  relatedDecision?: string;
  relatedExecution?: string;
  from?: string;
  to?: string;
  minImportance?: number;
  /** 'active' only by default; include archived/expired when true. */
  includeInactive?: boolean;
  limit?: number;
}

const BUSINESS_MODULE_KEYWORDS: Array<{ keyword: string; module: string }> = [
  { keyword: 'career', module: 'career' },
  { keyword: 'job', module: 'career' },
  { keyword: 'resume', module: 'career' },
  { keyword: 'learning', module: 'learning' },
  { keyword: 'course', module: 'learning' },
  { keyword: 'business', module: 'business' },
  { keyword: 'client', module: 'business' },
  { keyword: 'marketplace', module: 'marketplace' },
  { keyword: 'provider', module: 'marketplace' },
  { keyword: 'content', module: 'content-agency' },
  { keyword: 'blog', module: 'content-agency' },
];

export class MemoryRetrievalService {
  constructor(private readonly ranking: MemoryRankingService = new MemoryRankingService()) {}

  /** Tokenize for lexical similarity (lowercase, alphanumeric, ≥2 chars). */
  private tokens(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 2),
    );
  }

  /** Jaccard-style token overlap in [0, 1] between two strings. */
  similarity(a: string, b: string): number {
    const ta = this.tokens(a);
    const tb = this.tokens(b);
    if (ta.size === 0 || tb.size === 0) return 0;
    let intersection = 0;
    for (const token of ta) {
      if (tb.has(token)) intersection += 1;
    }
    return intersection / (ta.size + tb.size - intersection);
  }

  /**
   * Retrieve memories matching the query. Every match is annotated with
   * its match type and a composite score:
   *   relatedEntity match 0.9 · importance-weighted 0.85 · similarity 0.8
   *   time range 0.75 · keyword 0.7 · business module 0.7
   * Results are then re-ranked by the MemoryRankingService.
   */
  retrieve(items: MemoryItem[], query: MemoryRetrievalQuery = {}): MemorySearchResult[] {
    const limit = Math.max(1, query.limit ?? 20);
    let pool = items;
    if (!query.includeInactive) {
      pool = pool.filter(
        (m) =>
          m.lifecycleStatus === 'active' ||
          m.lifecycleStatus === 'compressed' ||
          m.lifecycleStatus === 'ranked',
      );
    }
    if (query.relatedGoal) pool = pool.filter((m) => m.relatedGoal === query.relatedGoal);
    if (query.relatedProject) pool = pool.filter((m) => m.relatedProject === query.relatedProject);
    if (query.relatedUser) pool = pool.filter((m) => m.relatedUser === query.relatedUser);
    if (query.relatedCapability)
      pool = pool.filter((m) => m.relatedCapability === query.relatedCapability);
    if (query.relatedProvider)
      pool = pool.filter((m) => m.relatedProvider === query.relatedProvider);
    if (query.relatedContext) pool = pool.filter((m) => m.relatedContext === query.relatedContext);
    if (query.relatedDecision)
      pool = pool.filter((m) => m.relatedDecision === query.relatedDecision);
    if (query.relatedExecution)
      pool = pool.filter((m) => m.relatedExecution === query.relatedExecution);
    if (query.minImportance !== undefined) {
      pool = pool.filter((m) => m.importance.score >= (query.minImportance as number));
    }
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from).getTime() : -Infinity;
      const to = query.to ? new Date(query.to).getTime() : Infinity;
      pool = pool.filter((m) => {
        const t = new Date(m.createdAt).getTime();
        return t >= from && t <= to;
      });
    }

    const results: MemorySearchResult[] = [];
    for (const memory of pool) {
      let matched = false;
      let matchType: MemoryMatchType = 'keyword';
      let rawScore = 0;
      const matchedFields: string[] = [];

      // Entity matches (By Goal / Project / User / Capability / Provider / Context).
      const entityPairs: Array<[string | undefined, MemoryMatchType]> = [
        [query.relatedGoal, 'goal'],
        [query.relatedProject, 'project'],
        [query.relatedUser, 'user'],
        [query.relatedCapability, 'capability'],
        [query.relatedProvider, 'provider'],
        [query.relatedContext, 'context'],
        [query.relatedDecision, 'importance'],
        [query.relatedExecution, 'importance'],
      ];
      for (const [value, type] of entityPairs) {
        if (value) {
          matched = true;
          matchType = type;
          rawScore = Math.max(rawScore, 0.9);
          matchedFields.push(type);
        }
      }

      // Time match.
      if (query.from || query.to) {
        matched = true;
        rawScore = Math.max(rawScore, 0.75);
        matchedFields.push('time');
      }

      // Similarity match against the free-text query.
      if (query.query) {
        const sim = Math.max(
          this.similarity(memory.title, query.query),
          this.similarity(memory.content, query.query),
          this.similarity(memory.summary ?? '', query.query),
          memory.tags.some((t) => query.query?.toLowerCase().includes(t)) ? 0.85 : 0,
        );
        if (sim > 0) {
          matched = true;
          matchType = sim >= 0.4 ? 'similarity' : 'keyword';
          rawScore = Math.max(rawScore, sim >= 0.4 ? 0.8 : 0.7);
          matchedFields.push('similarity');
        }
      }

      // Business module match (from content keywords).
      const lower = `${memory.title} ${memory.content} ${memory.summary ?? ''}`.toLowerCase();
      const module = BUSINESS_MODULE_KEYWORDS.find(({ keyword }) =>
        lower.includes(keyword),
      )?.module;
      if (module && lower.includes(module)) {
        matched = true;
        matchType = 'business_module';
        rawScore = Math.max(rawScore, 0.7);
        matchedFields.push('business_module');
      }

      if (!matched) continue;

      const ranked = this.ranking.rank(memory);
      const score = Math.max(0, Math.min(1, 0.6 * rawScore + 0.4 * ranked.score));
      results.push({
        memory,
        matchType,
        score,
        matchedFields: [...new Set(matchedFields)],
        snippet: memory.summary ?? memory.content.slice(0, 180),
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
