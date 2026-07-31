// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Timeline Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerTimelineEntryDTO } from './CareerDTO.js';

export class CareerTimelineService {
  buildTimeline(
    experiences: Array<{
      id: string;
      title: string;
      description: string;
      startDate: string;
      endDate?: string;
    }>,
  ): CareerTimelineEntryDTO[] {
    const entries: CareerTimelineEntryDTO[] = [];

    for (const exp of experiences) {
      entries.push({
        id: `ct_exp_${exp.id}`,
        type: 'experience',
        title: exp.title,
        description: exp.description.slice(0, 200),
        date: exp.startDate,
        endDate: exp.endDate,
        importance: 8,
        icon: 'briefcase',
        metadata: { type: 'experience' },
      });
    }

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }

  getRecentEntries(entries: CareerTimelineEntryDTO[], days: number = 30): CareerTimelineEntryDTO[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.date).getTime() > cutoff);
  }

  getEntryCounts(entries: CareerTimelineEntryDTO[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
    }
    return counts;
  }
}
