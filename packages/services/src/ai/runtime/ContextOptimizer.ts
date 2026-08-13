// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Optimizer
// AI input-optimization pipeline that ACTIVATES the frozen EI-003
// Context Intelligence contracts in the real runtime path:
//
//   raw context → EI-003 ranking → relevance filtering →
//   deduplication → EI-003 compression → token estimation →
//   budget check → final context
//
// No duplicated Context Intelligence logic: ContextRankingService /
// ContextFilteringService / ContextCompressionService are consumed
// directly from @vedmoulya/context. Every stage is measured into a
// TokenOptimizationResult so the runtime can prove the economics.
// AI-RUNTIME-002 — AI Input Optimization.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import {
  ContextCompressionService,
  ContextFilteringService,
  ContextRankingService,
} from '@vedmoulya/context';
import type {
  ContextCategory,
  ContextItem,
  ContextPriority,
  ContextSource,
} from '@vedmoulya/context';
import { TokenEstimationService } from '@vedmoulya/ai';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  OptimizationStageTokens,
  TokenOptimizationResult,
} from './TokenOptimizationResult.js';

export interface ContextSection {
  /** EI-003 source classification (drives ranking provenance). */
  source: ContextSource;
  /** EI-003 category classification. */
  category: ContextCategory;
  content: string;
}

/**
 * AI-SELECT (AI-RUNTIME-002 Phase 3): typed per-item explanation of why a
 * context item was selected for the model or excluded from it — relevance
 * score, token cost and the deciding reasons.
 */
export interface ContextSelectionExplanation {
  itemId: string;
  source: ContextSource;
  category: ContextCategory;
  /** Truncated preview of the item content (telemetry safe). */
  content: string;
  selected: boolean;
  score: number;
  tokens: number;
  reasons: string[];
}

export interface ContextOptimizationInput {
  capability: CapabilityType;
  userInput: string;
  /** Stable system instructions — never optimized away. */
  systemPrompt?: string;
  /** Context sections to rank/filter/deduplicate/compress. */
  sections: ContextSection[];
  /** Caller input-token budget. When exceeded even after compression, budgetBreached=true. */
  maxInputTokens?: number;
  /** EI-003 business-context tags (e.g. ['content-agency']). */
  businessContext?: string[];
  /** Estimated output tokens used for the cost estimate. */
  requestedOutputTokens?: number;
}

/** Minimum relevance score (0..1) for a context item to survive filtering. */
const RELEVANCE_THRESHOLD = 0.1;

/** Default target for the compression stage when no budget is supplied. */
const DEFAULT_TARGET_TOKENS = 8_000;

/** Rough USD per-1K-token pricing used for the deterministic cost estimate. */
const ESTIMATED_INPUT_PER_1K = 0.15;
const ESTIMATED_OUTPUT_PER_1K = 0.6;

export class ContextOptimizer {
  private readonly ranking = new ContextRankingService();
  private readonly filtering = new ContextFilteringService();
  private readonly compression = new ContextCompressionService();

  /**
   * Run the full optimization pipeline over the request context sections.
   * The returned result carries the final section contents (already grouped
   * by source), the staged token measurement, and a per-item AI-SELECT
   * explanation (why each context item was kept or excluded).
   */
  optimize(input: ContextOptimizationInput): {
    result: TokenOptimizationResult;
    optimizedSections: ContextSection[];
    selection: ContextSelectionExplanation[];
  } {
    const originalItems = this.buildItems(input);
    const originalTokens = this.countTokens(originalItems);

    // 1. EI-003 ranking.
    const scores = this.ranking.scoreItems(
      originalItems,
      input.capability,
      input.userInput,
      input.businessContext,
    );
    const ranked = this.ranking.rankItems(originalItems, scores);
    const rankedTokens = this.countTokens(ranked);

    // AI-SELECT (Phase 3): deterministic per-item explanation of WHY each
    // context item was selected or excluded — relevance, budget, dedupe.
    const keptIds = new Set<string>();
    const selection: ContextSelectionExplanation[] = [];

    // 2. EI-003 relevance filtering + deduplication.
    const filtered = this.filtering.process(ranked, {
      minConfidence: 0.5,
      maxTokens: input.maxInputTokens ?? DEFAULT_TARGET_TOKENS,
    });
    const droppedByFilter = new Set(filtered.removed.map((d) => d.item.contextId));
    const kept = filtered.retained.filter((item) => {
      const score = scores.get(item.contextId)?.finalScore ?? 0;
      return score >= RELEVANCE_THRESHOLD;
    });
    for (const item of kept) keptIds.add(item.contextId);
    const filteredTokens = this.countTokens(kept);

    // AI-SELECT explanations for the filtered set.
    for (const item of ranked) {
      const score = scores.get(item.contextId)?.finalScore ?? 0;
      if (keptIds.has(item.contextId)) {
        selection.push({
          itemId: item.contextId,
          source: item.source,
          category: item.category,
          content: item.content.slice(0, 160),
          selected: true,
          score,
          tokens: item.estimatedTokens,
          reasons: [
            `relevance ${score.toFixed(2)} above threshold`,
            this.priorityReason(item.priority),
          ],
        });
      } else if (score < RELEVANCE_THRESHOLD) {
        selection.push({
          itemId: item.contextId,
          source: item.source,
          category: item.category,
          content: item.content.slice(0, 160),
          selected: false,
          score,
          tokens: item.estimatedTokens,
          reasons: [
            `excluded: relevance ${score.toFixed(2)} below threshold (${RELEVANCE_THRESHOLD})`,
          ],
        });
      } else {
        selection.push({
          itemId: item.contextId,
          source: item.source,
          category: item.category,
          content: item.content.slice(0, 160),
          selected: false,
          score,
          tokens: item.estimatedTokens,
          reasons: [
            droppedByFilter.has(item.contextId)
              ? 'excluded: deduplicated or low confidence by EI-003 filtering'
              : 'excluded: dropped by EI-003 token-budget filtering',
          ],
        });
      }
    }

    // 3. EI-003 compression when the filtered context still exceeds budget.
    const target = input.maxInputTokens ?? DEFAULT_TARGET_TOKENS;
    let compressed = kept;
    let compressedTokens = filteredTokens;
    const itemsBeforeCompression = kept.length;
    if (compressedTokens > target && kept.length > 0) {
      const compressionResult = this.compression.compress({
        items: kept,
        targetTokens: target,
        strategy: 'extractive',
        preserveCritical: true,
      });
      compressed = compressionResult.items;
      compressedTokens = compressionResult.compressedTokens;
    }

    // 4. Reassemble sections grouped by source/category, preserving order.
    const optimizedSections = this.reassemble(input, compressed);
    const finalTokens =
      TokenEstimationService.estimateTokens(input.systemPrompt ?? '') +
      compressedTokens +
      TokenEstimationService.estimateTokens(input.userInput);

    const stages: OptimizationStageTokens[] = [
      { stage: 'raw', tokens: originalTokens, items: originalItems.length },
      { stage: 'ranked', tokens: rankedTokens, items: ranked.length },
      { stage: 'filtered', tokens: filteredTokens, items: kept.length },
      { stage: 'compressed', tokens: compressedTokens, items: compressed.length },
      { stage: 'final', tokens: finalTokens, items: compressed.length },
    ];

    const tokensRemoved = originalTokens - compressedTokens;
    const compressionRatio = originalTokens === 0 ? 0 : 1 - compressedTokens / originalTokens;
    const estimatedInputCost = (compressedTokens / 1000) * ESTIMATED_INPUT_PER_1K;
    const estimatedOutputCost =
      ((input.requestedOutputTokens ?? 1024) / 1000) * ESTIMATED_OUTPUT_PER_1K;

    const result: TokenOptimizationResult = {
      originalTokens,
      rankedTokens,
      filteredTokens,
      compressedTokens,
      finalTokens,
      tokensRemoved,
      compressionRatio: Math.max(0, Math.min(1, compressionRatio)),
      itemsRemoved: originalItems.length - compressed.length,
      strategyUsed:
        itemsBeforeCompression === compressed.length
          ? 'none-needed'
          : 'rank-filter-dedupe-compress',
      estimatedInputCost,
      estimatedOutputCost,
      estimatedTotalCost: estimatedInputCost + estimatedOutputCost,
      // Budget breach uses the same accounting as the runtime budget guard:
      // content + per-message framing + priming (estimateMessagesTokens).
      budgetBreached:
        input.maxInputTokens !== undefined &&
        TokenEstimationService.estimateTokens(input.systemPrompt ?? '') +
          compressedTokens +
          TokenEstimationService.estimateTokens(input.userInput) +
          4 * 4 +
          2 >
          input.maxInputTokens,
      stages,
    };

    return { result, optimizedSections, selection };
  }

  private priorityReason(priority: ContextPriority): string {
    switch (priority) {
      case 'critical':
        return 'critical priority preserved';
      case 'high':
        return 'high priority preserved';
      case 'medium':
        return 'medium priority';
      default:
        return 'low priority';
    }
  }

  // ── Item construction ─────────────────────────────────────────────────────

  /** Significant tokens: lowercase, length > 3, stop-words removed. */
  private significant(text: string): string[] {
    const stop = new Set([
      'that',
      'with',
      'this',
      'have',
      'from',
      'they',
      'will',
      'were',
      'been',
      'what',
      'which',
      'when',
      'where',
      'there',
      'their',
      'about',
      'would',
      'could',
      'should',
      'long',
      'your',
      'into',
      'over',
      'only',
      'then',
      'them',
      'than',
      'very',
      'just',
      'also',
      'does',
      'more',
    ]);
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !stop.has(w));
  }

  /**
   * Deterministic lexical relevance of one context line to the request: the
   * fraction of the request's significant terms (user input + capability +
   * business context) that appear in the line. A term matches when the word
   * appears verbatim OR shares a 4-char prefix (morphology-aware: onboards /
   * onboarding / onboarded all match "onboard"). Query-coverage, not
   * line-coverage: a short evidence line can be fully on-topic, and a long
   * noisy line with one shared word scores low. Drives per-item
   * importance/confidence so the frozen EI-003 ranking + filtering +
   * compression can genuinely discriminate on-topic content from noise
   * (AI-SELECT).
   */
  private relevanceOf(line: string, input: ContextOptimizationInput): number {
    const query = [
      ...new Set([
        ...this.significant(input.userInput),
        ...this.significant(input.capability),
        ...(input.businessContext ?? []).flatMap((b) => this.significant(b)),
      ]),
    ];
    if (query.length === 0) return 0;
    const lineWords = new Set(this.significant(line));
    const hits = query.filter((term) =>
      [...lineWords].some((word) => word === term || word.slice(0, 4) === term.slice(0, 4)),
    ).length;
    return Math.min(1, hits / query.length);
  }

  private buildItems(input: ContextOptimizationInput): ContextItem[] {
    const now = new Date().toISOString();
    const items: ContextItem[] = [];
    for (const section of input.sections) {
      const lines = section.content
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const priority = this.priorityFor(section.category);
      for (const line of lines) {
        const relevance = this.relevanceOf(line, input);
        // On-topic lines get high importance + confidence (survive the EI-003
        // filter and rank first); noise lines get low confidence so the
        // filtering stage drops them before compression. Critical categories
        // are preserved regardless (preserveCritical contract). The evidence
        // threshold is deliberately low (>= 0.15): a line that shares even
        // one significant topic term with the request is on-topic evidence,
        // while lines sharing none (relevance 0) are dropped.
        const importance = priority === 'critical' ? 0.9 : 0.35 + relevance * 0.55;
        const confidence = relevance >= 0.15 ? 0.8 : 0.35;
        items.push({
          contextId: generateId(),
          source: section.source,
          category: section.category,
          priority,
          importance,
          confidence,
          freshness: 0.7,
          size: line.length,
          estimatedTokens: TokenEstimationService.estimateTokens(line),
          language: 'en',
          tags: [],
          business: input.businessContext ?? [],
          capability: [input.capability],
          version: '1',
          content: line,
          metadata: { section: section.source },
          createdAt: now,
          updatedAt: now,
          sourceId: `${section.source}:${section.category}`,
        });
      }
    }
    return items;
  }

  private priorityFor(category: ContextCategory): ContextPriority {
    if (category === 'user_profile' || category === 'business' || category === 'project') {
      return 'high';
    }
    if (category === 'conversation') {
      return 'low';
    }
    return 'medium';
  }

  private countTokens(items: ContextItem[]): number {
    return items.reduce((sum, item) => sum + item.estimatedTokens, 0);
  }

  /** Group surviving items back into source sections (preserving original order). */
  private reassemble(input: ContextOptimizationInput, items: ContextItem[]): ContextSection[] {
    const grouped = new Map<string, ContextSection>();
    for (const section of input.sections) {
      grouped.set(section.source, {
        source: section.source,
        category: section.category,
        content: '',
      });
    }
    for (const item of items) {
      const entry = grouped.get(item.source);
      if (!entry) continue;
      entry.content =
        entry.content.length === 0 ? item.content : `${entry.content}\n${item.content}`;
    }
    return Array.from(grouped.values()).filter((s) => s.content.length > 0);
  }
}
