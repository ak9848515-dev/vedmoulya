// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Timeline Service
// Builds timeline entries from all frozen modules
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { TimelineEntryDTO } from './DashboardDTO.js';
import type { MemoryDTO } from '../memory/MemoryDTO.js';
import type { DecisionDTO } from '../decision/DecisionDTO.js';
import type { PlanDTO } from '../execution/ExecutionDTO.js';
import type { KnowledgeNodeDTO } from '../knowledge/KnowledgeDTO.js';

export class DashboardTimelineService {
  /** Build timeline entries from all available module data */
  buildTimeline(
    memories: MemoryDTO[],
    decisions: DecisionDTO[],
    plans: PlanDTO[],
    knowledgeNodes: KnowledgeNodeDTO[] = [],
  ): TimelineEntryDTO[] {
    const entries: TimelineEntryDTO[] = [];

    // Memory entries
    for (const memory of memories) {
      entries.push({
        id: `timeline_mem_${memory.id}`,
        type: 'memory',
        title: memory.title,
        description: memory.content.slice(0, 150),
        timestamp: memory.createdAt,
        importance: memory.importance.score,
        icon: this.getMemoryIcon(memory.category),
        metadata: { category: memory.category, strength: memory.strength.value },
      });
    }

    // Decision entries
    for (const decision of decisions) {
      const isRecent = this.isRecent(decision.updatedAt);
      if (isRecent || decision.status !== 'draft') {
        entries.push({
          id: `timeline_dec_${decision.id}`,
          type: 'decision',
          title: decision.title,
          description: `Decision ${decision.status} — ${decision.confidence.level} confidence`,
          timestamp: decision.updatedAt,
          importance: decision.priority.score,
          icon: 'scale',
          metadata: { status: decision.status, confidence: decision.confidence.score },
        });
      }
    }

    // Plan/Task entries
    for (const plan of plans) {
      for (const task of plan.tasks) {
        entries.push({
          id: `timeline_task_${task.id}`,
          type: 'task',
          title: task.label,
          description: `Task in plan: ${plan.title} — ${task.status}`,
          timestamp: plan.updatedAt,
          importance: task.priority.score,
          icon: this.getTaskIcon(task.status),
          metadata: { planId: plan.id, status: task.status },
        });
      }

      for (const mission of plan.missions) {
        entries.push({
          id: `timeline_mission_${mission.id}`,
          type: 'mission',
          title: mission.label,
          description: `Mission in plan: ${plan.title} — ${mission.status}`,
          timestamp: plan.updatedAt,
          importance: mission.priority.score,
          icon: 'flag',
          metadata: { planId: plan.id, status: mission.status },
        });
      }
    }

    // Knowledge entries (if recent)
    for (const node of knowledgeNodes) {
      if (this.isRecent(node.updatedAt)) {
        entries.push({
          id: `timeline_know_${node.id}`,
          type: 'learning',
          title: node.label,
          description: `Knowledge node added — ${node.category}`,
          timestamp: node.updatedAt,
          importance: 5,
          icon: 'bookmark',
          metadata: { category: node.category, tags: node.tags },
        });
      }
    }

    // Sort by timestamp descending, then by importance
    entries.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.importance - a.importance;
    });

    return entries;
  }

  /** Get recent entries (within last 24 hours) */
  getRecentEntries(entries: TimelineEntryDTO[], hours: number = 24): TimelineEntryDTO[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }

  /** Get important entries (importance >= threshold) */
  getImportantEntries(entries: TimelineEntryDTO[], threshold: number = 7): TimelineEntryDTO[] {
    return entries.filter((e) => e.importance >= threshold);
  }

  /** Get entries by type */
  getEntriesByType(
    entries: TimelineEntryDTO[],
    type: TimelineEntryDTO['type'],
  ): TimelineEntryDTO[] {
    return entries.filter((e) => e.type === type);
  }

  /** Get entry counts by type */
  getEntryCounts(entries: TimelineEntryDTO[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    }
    return counts;
  }

  private isRecent(timestamp: string, days: number = 7): boolean {
    const age = Date.now() - new Date(timestamp).getTime();
    return age < days * 24 * 60 * 60 * 1000;
  }

  private getMemoryIcon(category: string): string {
    const icons: Record<string, string> = {
      personal: 'user',
      work: 'briefcase',
      learning: 'book',
      milestone: 'award',
      reflection: 'feather',
      idea: 'lightbulb',
      event: 'calendar',
      achievement: 'trophy',
    };
    return icons[category.toLowerCase()] ?? 'file-text';
  }

  private getTaskIcon(status: string): string {
    const icons: Record<string, string> = {
      completed: 'check-circle',
      in_progress: 'loader',
      blocked: 'alert-circle',
      cancelled: 'x-circle',
      pending: 'circle',
    };
    return icons[status] ?? 'circle';
  }
}
