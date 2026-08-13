// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Domain Service: Context Compression
// Builds a pipeline: chunk selection → ranking → merge → strategy
// → minimal context assembly. Architecture supports future integration
// of LLMLingua or equivalent external compression libraries.
// Do NOT integrate external compression libraries yet.
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type {
  CompressionInput,
  CompressionResult,
  CompressionStep,
  CompressionStrategy,
  ContextItem,
} from '../../types/context-types.js';

// ── Service ─────────────────────────────────────────────────────────────────

export class ContextCompressionService {
  /**
   * Run the full compression pipeline on a set of context items.
   * Architecture supports swapping in external compression (e.g. LLMLingua)
   * at the strategy execution step without changing the pipeline.
   */
  compress(input: CompressionInput): CompressionResult {
    const startTime = performance.now();
    const steps: CompressionStep[] = [];
    let items = [...input.items];
    const originalTokens = items.reduce((sum, i) => sum + i.estimatedTokens, 0);
    let currentTokens = originalTokens;

    // Step 1: Preserve critical items if requested
    let preservedCritical: ContextItem[] = [];
    if (input.preserveCritical) {
      preservedCritical = items.filter((i) => i.priority === 'critical');
      const nonCritical = items.filter((i) => i.priority !== 'critical');
      steps.push({
        strategy: 'top_k',
        itemsBefore: items.length,
        itemsAfter: nonCritical.length,
        tokensBefore: currentTokens,
        tokensAfter: nonCritical.reduce((s, i) => s + i.estimatedTokens, 0),
        description: 'Preserved critical-priority items',
      });
      items = nonCritical;
      currentTokens = items.reduce((s, i) => s + i.estimatedTokens, 0);
    }

    // Step 2: Apply the selected strategy
    const strategyResult = this.applyStrategy(
      items,
      input.strategy,
      input.targetTokens,
      input.minConfidence,
    );

    // Record the main strategy step
    steps.push({
      strategy: input.strategy,
      itemsBefore: items.length,
      itemsAfter: strategyResult.items.length,
      tokensBefore: currentTokens,
      tokensAfter: strategyResult.items.reduce((s, i) => s + i.estimatedTokens, 0),
      description: strategyResult.description,
    });

    const compressedTokens =
      strategyResult.items.reduce((s, i) => s + i.estimatedTokens, 0) +
      preservedCritical.reduce((s, i) => s + i.estimatedTokens, 0);
    const allItems = [...preservedCritical, ...strategyResult.items];
    const originalForPct = originalTokens > 0 ? originalTokens : 1;
    const reductionPercent = ((originalTokens - compressedTokens) / originalForPct) * 100;

    const endTime = performance.now();

    return {
      items: allItems,
      originalTokens,
      compressedTokens,
      reductionPercent: Math.round(reductionPercent * 100) / 100,
      strategy: input.strategy,
      confidence: this.estimateConfidence(strategyResult.items, originalTokens, compressedTokens),
      chunksRemoved: originalTokens > 0 ? items.length - strategyResult.items.length : 0,
      chunksMerged: strategyResult.merges,
      compressionTimeMs: Math.round(endTime - startTime),
    };
  }

  /**
   * Estimate token count for a string (rough: ~4 chars per token).
   * This is a quick approximation; actual tokenization depends on the model.
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Apply a specific compression strategy.
   * This is the extension point for external libraries (LLMLingua, etc.).
   */
  private applyStrategy(
    items: ContextItem[],
    strategy: CompressionStrategy,
    targetTokens: number,
    minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    switch (strategy) {
      case 'extractive':
        return this.extractiveCompression(items, targetTokens, minConfidence);
      case 'abstractive':
        return this.abstractiveCompression(items, targetTokens, minConfidence);
      case 'summary':
        return this.summaryCompression(items, targetTokens, minConfidence);
      case 'top_k':
        return this.topKCompression(items, targetTokens, minConfidence);
      case 'threshold':
        return this.thresholdCompression(items, targetTokens, minConfidence);
      case 'hybrid':
        return this.hybridCompression(items, targetTokens, minConfidence);
      default:
        return this.topKCompression(items, targetTokens, minConfidence);
    }
  }

  /**
   * Extractive: keep entire items up to the token budget, sorted by
   * priority then importance. Remove the rest.
   */
  private extractiveCompression(
    items: ContextItem[],
    targetTokens: number,
    _minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    const sorted = this.sortByPriorityAndImportance(items);
    const result: ContextItem[] = [];
    let tokens = 0;
    for (const item of sorted) {
      if (tokens + item.estimatedTokens <= targetTokens) {
        result.push(item);
        tokens += item.estimatedTokens;
      }
    }
    return {
      items: result,
      merges: 0,
      description: `Extractive: kept ${result.length} items within ${targetTokens} token budget`,
    };
  }

  /**
   * Abstractive: placeholder for future LLMLingua integration.
   * Currently falls back to extractive with a note.
   */
  private abstractiveCompression(
    items: ContextItem[],
    targetTokens: number,
    minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    // Future: integrate LLMLingua or similar abstractive compression here.
    // For now, extractive + merge smaller items.
    const extracted = this.extractiveCompression(items, targetTokens, minConfidence);
    const merged = this.mergeSmallItems(extracted.items, targetTokens);
    return {
      items: merged.items,
      merges: merged.merges,
      description: 'Abstractive (placeholder) — fell back to extractive + merge',
    };
  }

  /**
   * Summary: keep a representative sample per category.
   */
  private summaryCompression(
    items: ContextItem[],
    targetTokens: number,
    _minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    // Group by category, pick top item per category within budget
    const byCategory = new Map<string, ContextItem[]>();
    for (const item of items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const result: ContextItem[] = [];
    let tokens = 0;

    for (const [, categoryItems] of byCategory) {
      const sorted = this.sortByPriorityAndImportance(categoryItems);
      for (const item of sorted) {
        if (tokens + item.estimatedTokens <= targetTokens) {
          result.push(item);
          tokens += item.estimatedTokens;
          break; // Only take the top item per category
        }
      }
    }

    return {
      items: result,
      merges: 0,
      description: `Summary: selected top item from ${result.length} categories`,
    };
  }

  /**
   * Top-K: keep the highest-priority items up to the token budget.
   */
  private topKCompression(
    items: ContextItem[],
    targetTokens: number,
    _minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    return this.extractiveCompression(items, targetTokens, _minConfidence);
  }

  /**
   * Threshold: keep items with importance above a dynamic threshold.
   * The threshold is adjusted so the total fits within the token budget.
   */
  private thresholdCompression(
    items: ContextItem[],
    targetTokens: number,
    minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    const sorted = this.sortByPriorityAndImportance(items);
    const result: ContextItem[] = [];
    let tokens = 0;

    for (const item of sorted) {
      if (minConfidence !== undefined && item.confidence < minConfidence) continue;
      if (tokens + item.estimatedTokens <= targetTokens) {
        result.push(item);
        tokens += item.estimatedTokens;
      }
    }

    return {
      items: result,
      merges: 0,
      description: `Threshold: kept ${result.length} items above dynamic threshold`,
    };
  }

  /**
   * Hybrid: extractive + threshold for a balanced approach.
   */
  private hybridCompression(
    items: ContextItem[],
    targetTokens: number,
    minConfidence?: number,
  ): { items: ContextItem[]; merges: number; description: string } {
    const half = Math.floor(targetTokens / 2);
    const extractive = this.extractiveCompression(items, half, minConfidence);
    const threshold = this.thresholdCompression(
      items.filter((i) => !extractive.items.some((e) => e.contextId === i.contextId)),
      half,
      minConfidence,
    );
    const merged = [...extractive.items, ...threshold.items];
    return {
      items: merged,
      merges: 0,
      description: `Hybrid: ${extractive.items.length} extracted + ${threshold.items.length} threshold`,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sortByPriorityAndImportance(items: ContextItem[]): ContextItem[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, background: 4 };
    return [...items].sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.importance - a.importance;
    });
  }

  /**
   * Merge small items (under 100 tokens) into a single item.
   * This is a basic merge strategy; future versions can use semantic merging.
   */
  private mergeSmallItems(
    items: ContextItem[],
    _targetTokens: number,
  ): { items: ContextItem[]; merges: number } {
    const large: ContextItem[] = [];
    const small: ContextItem[] = [];

    for (const item of items) {
      if (item.estimatedTokens < 100) {
        small.push(item);
      } else {
        large.push(item);
      }
    }

    if (small.length <= 1) {
      return { items, merges: 0 };
    }

    // Merge small items into a single combined item
    const primary = small[0];
    if (primary === undefined) {
      return { items, merges: 0 };
    }
    const mergedContent = small.map((s) => s.content).join('\n\n');
    const mergedItem: ContextItem = {
      ...primary,
      contextId: `merged_${primary.contextId}`,
      content: mergedContent,
      estimatedTokens: this.estimateTokens(mergedContent),
      size: mergedContent.length,
      tags: [...new Set(small.flatMap((s) => s.tags))],
      business: [...new Set(small.flatMap((s) => s.business))],
      capability: [...new Set(small.flatMap((s) => s.capability))],
    };

    return {
      items: [...large, mergedItem],
      merges: small.length - 1,
    };
  }

  /**
   * Estimate quality confidence after compression.
   * Higher reduction = lower confidence (more information loss).
   */
  private estimateConfidence(
    compressedItems: ContextItem[],
    originalTokens: number,
    compressedTokens: number,
  ): number {
    if (originalTokens === 0) return 1;
    const retentionRatio = compressedTokens / originalTokens;
    // Compression quality curve: 100% retention = 1.0, 50% retention = 0.85, 10% = 0.5
    return Math.max(0.1, Math.min(1, 0.5 + 0.5 * Math.sqrt(retentionRatio)));
  }
}
