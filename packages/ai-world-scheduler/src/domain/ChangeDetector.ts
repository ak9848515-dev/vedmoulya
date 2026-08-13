// ──────────────────────────────────────────────────────────────────
// VedMoulya — Scheduler: ChangeDetector
// EPIC-018 — Phase 6 change detection.
//
//   Scheduled run
//    ↓
//   No meaningful change → persist run → NO notification
//
//   New verified model → relevant to user → Brain evaluation →
//   notification gate → notify
//
// Classifications: NO_CHANGE / NEW / UPDATED / REMOVED / CRITICAL_CHANGE.
// A successful run whose summary is NO_CHANGE must never notify.
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryCategory, DiscoveryItem } from '@vedmoulya/ai-world';
import type { ChangeEntry, ChangeKind, ChangeSummary } from '../types/scheduler-types.js';

/** Fields whose change makes an existing item "UPDATED" (evidence-first). */
const MEANINGFUL_FIELDS = [
  'title',
  'summary',
  'recommendation',
  'relevance',
  'freeClass',
  'localAvailability',
  'confidence',
  'publishedAt',
  'capabilities',
  'modelFacts',
  'github',
] as const;

function stableValue(item: DiscoveryItem): Record<string, unknown> {
  return {
    title: item.title,
    summary: item.summary,
    recommendation: item.recommendation,
    relevance: item.relevance,
    freeClass: item.freeClass,
    localAvailability: item.localAvailability,
    confidence: item.confidence,
    publishedAt: item.publishedAt,
    capabilities: [...item.capabilities].sort().join(','),
    modelFacts: item.modelFacts?.modelId ?? item.modelFacts?.providerName ?? '',
    githubFlags: (item.github?.flags ?? []).slice().sort().join(','),
    githubLicense: item.github?.license ?? '',
  };
}

export interface ChangeDetectorOptions {
  itemCategories: DiscoveryCategory[];
  criticalMinRelevance: number;
  nowIso: string;
}

export class ChangeDetector {
  detect(
    before: DiscoveryItem[],
    after: DiscoveryItem[],
    options: ChangeDetectorOptions,
  ): ChangeSummary {
    const beforeFiltered = before.filter((i) => options.itemCategories.includes(i.category));
    const afterFiltered = after.filter((i) => options.itemCategories.includes(i.category));

    const beforeById = new Map(beforeFiltered.map((i) => [i.id, i]));
    const afterById = new Map(afterFiltered.map((i) => [i.id, i]));

    const counts: Record<ChangeKind, number> = {
      NO_CHANGE: 0,
      NEW: 0,
      UPDATED: 0,
      REMOVED: 0,
      CRITICAL_CHANGE: 0,
    };
    const entries: ChangeEntry[] = [];

    // NEW / UPDATED / CRITICAL — items present after the run.
    for (const item of afterFiltered) {
      const previous = beforeById.get(item.id);
      if (!previous) {
        const critical = this.isCritical(item, options.criticalMinRelevance);
        counts[critical ? 'CRITICAL_CHANGE' : 'NEW'] += 1;
        if (critical) {
          entries.push({
            item,
            kind: 'CRITICAL_CHANGE',
            reason: 'New provider/model change with high relevance and verified evidence',
          });
        } else {
          entries.push({ item, kind: 'NEW', reason: 'Newly discovered item' });
        }
        continue;
      }

      const changedFields = this.changedFields(previous, item);
      if (changedFields.length === 0) {
        counts.NO_CHANGE += 1;
        continue;
      }
      const critical = this.isCritical(item, options.criticalMinRelevance);
      counts[critical ? 'CRITICAL_CHANGE' : 'UPDATED'] += 1;
      if (critical) {
        entries.push({
          item,
          kind: 'CRITICAL_CHANGE',
          changedFields,
          reason: 'Critical provider/model change detected',
        });
      } else {
        entries.push({ item, kind: 'UPDATED', changedFields });
      }
    }

    // REMOVED — present before, absent after (full-state sources only;
    // additive sources never remove — honest by construction).
    for (const item of beforeFiltered) {
      if (!afterById.has(item.id)) {
        counts.REMOVED += 1;
        entries.push({ item, kind: 'REMOVED', reason: 'No longer reported by its source' });
      }
    }

    const meaningful =
      counts.NEW > 0 || counts.UPDATED > 0 || counts.REMOVED > 0 || counts.CRITICAL_CHANGE > 0;

    return { ranAt: options.nowIso, meaningful, counts, entries };
  }

  /** CRITICAL_CHANGE: provider/model + high relevance + verified evidence (or a new security flag). */
  private isCritical(item: DiscoveryItem, criticalMinRelevance: number): boolean {
    const categoryCritical = item.category === 'provider' || item.category === 'model';
    if (categoryCritical && item.relevance >= criticalMinRelevance) {
      const strong = item.confidence === 'VERIFIED' || item.confidence === 'MEASURED';
      if (strong) return true;
    }
    // A security-flagged item is always a critical change (evidence-backed).
    if (item.securityFlags.length > 0) return true;
    return false;
  }

  private changedFields(previous: DiscoveryItem, item: DiscoveryItem): string[] {
    const beforeValue = stableValue(previous);
    const afterValue = stableValue(item);
    return MEANINGFUL_FIELDS.filter((field) => beforeValue[field] !== afterValue[field]);
  }
}
