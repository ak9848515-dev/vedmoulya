// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Unified Timeline Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSTimelineEntryDTO, LifeOSUnifiedTimelineDTO } from './LifeOSDTO.js';

export class LifeOSTimelineService {
  buildUnifiedTimeline(
    entries: LifeOSTimelineEntryDTO[],
    filter: 'today' | 'week' | 'month' | 'all' = 'all',
  ): LifeOSUnifiedTimelineDTO {
    const sorted = entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const filtered = this.applyFilter(sorted, filter);
    return {
      entries: filtered,
      totalEntries: sorted.length,
      hasMore: filtered.length < sorted.length,
      filter,
    };
  }

  mergeTimelines(
    sources: Array<{ entries: LifeOSTimelineEntryDTO[] }>,
    filter: 'today' | 'week' | 'month' | 'all' = 'all',
  ): LifeOSUnifiedTimelineDTO {
    const allEntries: LifeOSTimelineEntryDTO[] = [];
    for (const source of sources) {
      allEntries.push(...source.entries);
    }
    return this.buildUnifiedTimeline(allEntries, filter);
  }

  getRecentEntries(entries: LifeOSTimelineEntryDTO[], days: number = 7): LifeOSTimelineEntryDTO[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }

  getEntriesBySource(entries: LifeOSTimelineEntryDTO[], source: string): LifeOSTimelineEntryDTO[] {
    return entries.filter((e) => e.source === source);
  }

  private applyFilter(
    entries: LifeOSTimelineEntryDTO[],
    filter: 'today' | 'week' | 'month' | 'all',
  ): LifeOSTimelineEntryDTO[] {
    if (filter === 'all') return entries;
    const now = Date.now();
    const periods = { today: 1, week: 7, month: 30 };
    const days = periods[filter];
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }
}
