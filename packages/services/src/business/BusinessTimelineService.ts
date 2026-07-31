// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Timeline Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessTimelineEntryDTO } from './BusinessDTO.js';

export class BusinessTimelineService {
  buildTimeline(
    entries: Array<{
      id: string;
      type: BusinessTimelineEntryDTO['type'];
      title: string;
      description: string;
      timestamp: string;
      importance: number;
      icon: string;
    }>,
  ): BusinessTimelineEntryDTO[] {
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getRecentEntries(
    entries: BusinessTimelineEntryDTO[],
    days: number = 7,
  ): BusinessTimelineEntryDTO[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }
}
