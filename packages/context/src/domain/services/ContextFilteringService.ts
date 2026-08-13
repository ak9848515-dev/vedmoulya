// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Domain Service: Context Filtering
// Removes duplicates, irrelevant items, and applies business/
// capability/time/user filters. No execution decisions — filtering
// reduces the context set for downstream assembly.
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type {
  ContextFilterCriteria,
  ContextFilterResult,
  ContextItem,
} from '../../types/context-types.js';

// ── Duplicate Detection ─────────────────────────────────────────────────────

interface DuplicateKey {
  sourceId: string;
  source: string;
  contentHash: string;
}

/**
 * Simple content hash for duplicate detection. Uses a basic string
 * hash rather than crypto to keep it fast and dependency-free.
 */
function contentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
}

// ── Service ─────────────────────────────────────────────────────────────────

export class ContextFilteringService {
  /**
   * Remove duplicate context items (same sourceId + source + content).
   * Keeps the first occurrence (highest priority wins).
   */
  removeDuplicates(items: ContextItem[]): ContextFilterResult {
    const seen = new Set<string>();
    const retained: ContextItem[] = [];
    const removed: ContextFilterResult['removed'] = [];

    // Sort by priority so higher-priority items are kept on conflict
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, background: 4 };
    const sorted = [...items].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    for (const item of sorted) {
      const key: DuplicateKey = {
        sourceId: item.sourceId,
        source: item.source,
        contentHash: contentHash(item.content),
      };
      const keyStr = JSON.stringify(key);
      if (seen.has(keyStr)) {
        removed.push({ item, reason: 'Duplicate (same sourceId + source + content)' });
      } else {
        seen.add(keyStr);
        retained.push(item);
      }
    }

    return { retained, removed };
  }

  /**
   * Apply all filters from a ContextFilterCriteria.
   */
  filter(items: ContextItem[], criteria: ContextFilterCriteria): ContextFilterResult {
    const removed: ContextFilterResult['removed'] = [];
    const retained: ContextItem[] = [];

    for (const item of items) {
      const reason = this.checkFilters(item, criteria);
      if (reason) {
        removed.push({ item, reason });
      } else {
        retained.push(item);
      }
    }

    return { retained, removed };
  }

  /**
   * Full pipeline: deduplicate + filter.
   */
  process(items: ContextItem[], criteria: ContextFilterCriteria): ContextFilterResult {
    const deduped = this.removeDuplicates(items);
    return this.filter(deduped.retained, criteria);
  }

  // ── Individual filter checks ──────────────────────────────────────────────

  private checkFilters(item: ContextItem, criteria: ContextFilterCriteria): string | null {
    // Source filter
    if (
      criteria.sources &&
      criteria.sources.length > 0 &&
      !criteria.sources.includes(item.source)
    ) {
      return `Source "${item.source}" not in allowed sources`;
    }

    // Category filter
    if (
      criteria.categories &&
      criteria.categories.length > 0 &&
      !criteria.categories.includes(item.category)
    ) {
      return `Category "${item.category}" not in allowed categories`;
    }

    // Priority filter
    if (
      criteria.priorities &&
      criteria.priorities.length > 0 &&
      !criteria.priorities.includes(item.priority)
    ) {
      return `Priority "${item.priority}" not in allowed priorities`;
    }

    // Capability filter
    if (
      criteria.capabilities &&
      criteria.capabilities.length > 0 &&
      !criteria.capabilities.some((c) => item.capability.includes(c))
    ) {
      return 'No matching capability';
    }

    // Business filter
    if (
      criteria.business &&
      criteria.business.length > 0 &&
      !criteria.business.some((b) => item.business.includes(b))
    ) {
      return 'No matching business module';
    }

    // Tag filter
    if (
      criteria.tags &&
      criteria.tags.length > 0 &&
      !criteria.tags.some((t) => item.tags.includes(t))
    ) {
      return 'No matching tags';
    }

    // Confidence filter
    if (criteria.minConfidence !== undefined && item.confidence < criteria.minConfidence) {
      return `Confidence ${item.confidence.toFixed(2)} below minimum ${criteria.minConfidence}`;
    }

    // Importance filter
    if (criteria.minImportance !== undefined && item.importance < criteria.minImportance) {
      return `Importance ${item.importance.toFixed(2)} below minimum ${criteria.minImportance}`;
    }

    // Token budget filter
    if (criteria.maxTokens !== undefined && item.estimatedTokens > criteria.maxTokens) {
      return `Estimated tokens ${item.estimatedTokens} exceeds max ${criteria.maxTokens}`;
    }

    // Time range filter
    if (criteria.timeRange) {
      const itemTime = new Date(item.createdAt).getTime();
      const start = new Date(criteria.timeRange.start).getTime();
      const end = new Date(criteria.timeRange.end).getTime();
      if (itemTime < start || itemTime > end) {
        return 'Outside time range';
      }
    }

    // Exclude IDs
    if (criteria.excludeIds && criteria.excludeIds.includes(item.contextId)) {
      return 'Excluded by ID';
    }

    // User filter (simplified — checks if user tag exists)
    if (criteria.userFilter && !item.tags.includes(criteria.userFilter)) {
      return 'Does not match user filter';
    }

    return null; // Item passes all filters
  }
}
