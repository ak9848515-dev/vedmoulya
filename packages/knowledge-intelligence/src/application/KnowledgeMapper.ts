// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence Mapper
// EI-009 — Enterprise Knowledge Intelligence Platform
// Maps domain entities to JSON-safe DTOs (the entities already carry
// ISO-string dates; this layer is the explicit contract seam). Also
// assembles the dashboard aggregate and flattens the audit trail into
// a timeline feed. Plain-object mapper matching the CapabilityMapper /
// LearningMapper / BrainMapper convention.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeAnalytics,
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeVersion,
} from '../types/knowledge-types.js';
import type {
  KnowledgeAnalyticsDTO,
  KnowledgeDashboardDTO,
  KnowledgeItemDTO,
  KnowledgeRelationshipDTO,
  KnowledgeTimelineEntryDTO,
  KnowledgeVersionDTO,
} from './KnowledgeDTO.js';

export const KnowledgeMapper = {
  itemToDTO(item: KnowledgeItem): KnowledgeItemDTO {
    return item;
  },

  relationshipToDTO(relationship: KnowledgeRelationship): KnowledgeRelationshipDTO {
    return relationship;
  },

  versionToDTO(version: KnowledgeVersion): KnowledgeVersionDTO {
    return version;
  },

  analyticsToDTO(analytics: KnowledgeAnalytics): KnowledgeAnalyticsDTO {
    return analytics;
  },

  /** Flatten every item's audit trail into one chronological timeline feed. */
  timelineToDTO(items: KnowledgeItem[], limit = 50): KnowledgeTimelineEntryDTO[] {
    const entries: KnowledgeTimelineEntryDTO[] = [];
    for (const item of items) {
      for (const entry of item.audit) {
        entries.push({
          knowledgeId: item.knowledgeId,
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

  dashboardToDTO(data: {
    analytics: KnowledgeAnalytics;
    items: KnowledgeItem[];
  }): KnowledgeDashboardDTO {
    const sortedByUpdated = [...data.items].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    const topTrusted = [...data.items].sort(
      (a, b) => b.trust.score - a.trust.score || b.usage.totalReads - a.usage.totalReads,
    );
    const mostConsumed = [...data.items].sort(
      (a, b) => b.usage.totalReads - a.usage.totalReads || b.consumers.length - a.consumers.length,
    );

    return {
      totals: {
        items: data.analytics.totals.items,
        active: data.analytics.totals.active,
        review: data.analytics.byLifecycle.review,
        validated: data.analytics.totals.validated,
        deprecated: data.analytics.byLifecycle.deprecated,
        relationships: data.analytics.totals.relationships,
        citations: data.analytics.totals.citations,
        consumers: data.analytics.totals.consumers,
        totalReads: data.analytics.totals.totalReads,
        avgTrust: data.analytics.totals.avgTrust,
        avgConfidence: data.analytics.totals.avgConfidence,
      },
      byCategory: data.analytics.byCategory,
      byLifecycle: data.analytics.byLifecycle,
      byValidation: data.analytics.byValidation,
      trustDistribution: data.analytics.trustDistribution,
      trend: data.analytics.trend,
      recentItems: sortedByUpdated.slice(0, 10).map((i) => KnowledgeMapper.itemToDTO(i)),
      topTrusted: topTrusted.slice(0, 5).map((i) => KnowledgeMapper.itemToDTO(i)),
      mostConsumed: mostConsumed.slice(0, 5).map((i) => KnowledgeMapper.itemToDTO(i)),
    };
  },
};
