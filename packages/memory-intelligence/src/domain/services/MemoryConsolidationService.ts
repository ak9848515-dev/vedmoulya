// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Consolidation Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage: Consolidation. Detects duplicate /
// overlapping memories and merges them into a single stronger memory:
// importance + confidence are blended by reinforcement, frequency is
// summed, and the audit trail records the consolidation. This is how
// repeated experience becomes durable long-term memory.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed key lookups over the closed union of
   MemoryItem entity keys (relatedGoal, relatedTask, …) — no runtime
   attacker-controlled keys. */

import type { MemoryImportance, MemoryItem } from '../../types/memory-types.js';
import { generateMemoryAuditId } from '../value-objects/MemoryId.js';

export interface ConsolidationCandidate {
  primary: MemoryItem;
  duplicates: MemoryItem[];
}

export interface ConsolidationResult {
  consolidated: MemoryItem;
  mergedCount: number;
}

export class MemoryConsolidationService {
  /**
   * Find consolidation candidates: memories that share a related entity
   * (goal/task/capability/provider/project/user/context) AND an
   * overlapping title (Jaccard token overlap ≥ 0.5). Returns the oldest
   * as primary with the rest as duplicates.
   */
  findCandidates(items: MemoryItem[]): ConsolidationCandidate[] {
    const candidates: ConsolidationCandidate[] = [];
    const used = new Set<string>();
    const sorted = [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (let i = 0; i < sorted.length; i += 1) {
      const primary = sorted[i];
      if (!primary || used.has(primary.memoryId)) continue;
      const duplicates: MemoryItem[] = [];
      for (let j = i + 1; j < sorted.length; j += 1) {
        const other = sorted[j];
        if (!other || used.has(other.memoryId)) continue;
        if (
          this.sharesEntity(primary, other) &&
          this.titleOverlap(primary.title, other.title) >= 0.5
        ) {
          duplicates.push(other);
          used.add(other.memoryId);
        }
      }
      if (duplicates.length > 0) {
        used.add(primary.memoryId);
        candidates.push({ primary, duplicates });
      }
    }
    return candidates;
  }

  private sharesEntity(a: MemoryItem, b: MemoryItem): boolean {
    const keys: Array<keyof MemoryItem> = [
      'relatedGoal',
      'relatedTask',
      'relatedCapability',
      'relatedProvider',
      'relatedProject',
      'relatedUser',
      'relatedContext',
      'relatedDecision',
      'relatedExecution',
    ];
    for (const key of keys) {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string' && va === vb && va.length > 0) return true;
    }
    return false;
  }

  private titleOverlap(a: string, b: string): number {
    const ta = new Set(
      a
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 1),
    );
    const tb = new Set(
      b
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 1),
    );
    if (ta.size === 0 || tb.size === 0) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    return inter / (ta.size + tb.size - inter);
  }

  /**
   * Merge a candidate: pick the most complete content, blend importance
   * and confidence with the duplicate count, sum frequency + retrievals,
   * union tags, and re-score importance.
   */
  consolidate(
    candidate: ConsolidationCandidate,
    now = new Date().toISOString(),
  ): ConsolidationResult {
    const { primary, duplicates } = candidate;
    const n = duplicates.length + 1;

    const content = this.mostComplete([primary, ...duplicates]);
    const tags = [...new Set([primary, ...duplicates].flatMap((m) => m.tags))];
    const importance = this.blend(primary, duplicates);
    const confidence = this.blendConfidence(primary, duplicates);

    const consolidated: MemoryItem = {
      ...primary,
      content: content.content,
      title: content.title,
      tags,
      importance,
      confidence,
      usage: {
        totalRetrievals: [primary, ...duplicates].reduce(
          (sum, m) => sum + m.usage.totalRetrievals,
          0,
        ),
        totalConsumers: Math.max(
          primary.usage.totalConsumers,
          ...duplicates.map((m) => m.usage.totalConsumers),
        ),
        frequency: [primary, ...duplicates].reduce((sum, m) => sum + m.usage.frequency, 0),
        recency: Math.max(primary.usage.recency, ...duplicates.map((m) => m.usage.recency)),
      },
      consumers: this.mergeConsumers(primary, duplicates),
      audit: [
        ...primary.audit,
        ...duplicates.flatMap((d) => d.audit),
        {
          auditId: generateMemoryAuditId(),
          action: 'consolidated',
          actor: 'memory-platform',
          note: `Consolidated ${duplicates.length} duplicate memory(-ies)`,
          timestamp: now,
        },
      ],
      updatedAt: now,
    };
    return { consolidated, mergedCount: n };
  }

  private mostComplete(items: MemoryItem[]): { content: string; title: string } {
    let best: MemoryItem = items[0] as MemoryItem;
    for (const item of items) {
      if (item.content.length > best.content.length) best = item;
    }
    return { content: best.content, title: best.title };
  }

  private blend(primary: MemoryItem, duplicates: MemoryItem[]): MemoryImportance {
    const n = duplicates.length + 1;
    const score =
      (primary.importance.score + duplicates.reduce((s, d) => s + d.importance.score, 0)) / n +
      Math.min(0.2, duplicates.length * 0.05);
    const final = Math.max(0, Math.min(1, score));
    return {
      score: final,
      level: final >= 0.8 ? 'high' : final >= 0.5 ? 'medium' : 'low',
      factors: [...primary.importance.factors, `consolidated from ${n} memories`],
    };
  }

  private blendConfidence(primary: MemoryItem, duplicates: MemoryItem[]): MemoryItem['confidence'] {
    const n = duplicates.length + 1;
    const score =
      (primary.confidence.score + duplicates.reduce((s, d) => s + d.confidence.score, 0)) / n;
    const final = Math.max(0, Math.min(1, score));
    return {
      score: final,
      level: final >= 0.8 ? 'high' : final >= 0.5 ? 'medium' : 'low',
      factors: [...primary.confidence.factors, `reinforced by ${n} observations`],
    };
  }

  private mergeConsumers(primary: MemoryItem, duplicates: MemoryItem[]): MemoryItem['consumers'] {
    const map = new Map<string, MemoryItem['consumers'][number]>();
    for (const consumer of [...primary.consumers, ...duplicates.flatMap((d) => d.consumers)]) {
      const existing = map.get(consumer.consumerId);
      if (existing) {
        existing.usageCount += consumer.usageCount;
        existing.lastUsedAt = consumer.lastUsedAt;
      } else {
        map.set(consumer.consumerId, { ...consumer });
      }
    }
    return [...map.values()];
  }
}
