// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence Mapper
// EI-010 — Enterprise Memory Intelligence Platform
// Maps domain entities to JSON-safe DTOs (the entities already carry
// ISO-string dates; this layer is the explicit contract seam). Also
// assembles the dashboard aggregate and flattens the audit trail into
// a timeline feed. Plain-object mapper matching the KnowledgeMapper /
// LearningMapper / BrainMapper convention.
// ──────────────────────────────────────────────────────────────────

import type { MemoryAnalytics, MemoryItem, MemoryRelationship } from '../types/memory-types.js';
import { MEMORY_RETENTION_POLICIES } from '../types/memory-types.js';
import type {
  MemoryAnalyticsDTO,
  MemoryDashboardDTO,
  MemoryItemDTO,
  MemoryRelationshipDTO,
  MemoryTimelineEntryDTO,
} from './MemoryDTO.js';

export const MemoryMapper = {
  itemToDTO(item: MemoryItem): MemoryItemDTO {
    return item;
  },

  relationshipToDTO(relationship: MemoryRelationship): MemoryRelationshipDTO {
    return relationship;
  },

  analyticsToDTO(analytics: MemoryAnalytics): MemoryAnalyticsDTO {
    return analytics;
  },

  /** Flatten every item's audit trail into one chronological timeline feed. */
  timelineToDTO(items: MemoryItem[], limit = 50): MemoryTimelineEntryDTO[] {
    const entries: MemoryTimelineEntryDTO[] = [];
    for (const item of items) {
      for (const entry of item.audit) {
        entries.push({
          memoryId: item.memoryId,
          title: item.title,
          action: entry.action,
          actor: entry.actor,
          note: entry.note,
          timestamp: entry.timestamp,
        });
      }
    }
    return entries
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Math.max(1, limit));
  },

  dashboardToDTO(data: { analytics: MemoryAnalytics; items: MemoryItem[] }): MemoryDashboardDTO {
    const sortedByUpdated = [...data.items].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const mostImportant = [...data.items].sort(
      (a, b) =>
        b.importance.score - a.importance.score ||
        b.usage.totalRetrievals - a.usage.totalRetrievals,
    );
    const mostRetrieved = [...data.items].sort(
      (a, b) =>
        b.usage.totalRetrievals - a.usage.totalRetrievals ||
        b.importance.score - a.importance.score,
    );
    const retentionCountdown = MEMORY_RETENTION_POLICIES.map((policy) => ({
      policy,
      count: data.items.filter(
        (i) => i.retentionPolicy === policy && i.lifecycleStatus !== 'expired',
      ).length,
    }));

    return {
      totals: {
        memories: data.analytics.totals.memories,
        active: data.analytics.totals.active,
        archived: data.analytics.totals.archived,
        expired: data.analytics.totals.expired,
        relationships: data.analytics.totals.relationships,
        citations: data.analytics.totals.citations,
        consumers: data.analytics.totals.consumers,
        totalRetrievals: data.analytics.totals.totalRetrievals,
        avgImportance: data.analytics.totals.avgImportance,
        avgConfidence: data.analytics.totals.avgConfidence,
        avgRecency: data.analytics.totals.avgRecency,
      },
      byType: data.analytics.byType,
      byLifecycle: data.analytics.byLifecycle,
      byCompression: data.analytics.byCompression,
      importanceDistribution: data.analytics.importanceDistribution,
      retentionCountdown,
      trend: data.analytics.trend,
      recentMemories: sortedByUpdated.slice(0, 10).map((i) => MemoryMapper.itemToDTO(i)),
      mostImportant: mostImportant.slice(0, 5).map((i) => MemoryMapper.itemToDTO(i)),
      mostRetrieved: mostRetrieved.slice(0, 5).map((i) => MemoryMapper.itemToDTO(i)),
    };
  },
};
