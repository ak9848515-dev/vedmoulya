// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Timeline Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningTimelineEntryDTO } from './LearningDTO.js';

export class LearningTimelineService {
  buildTimeline(
    entries: Array<{
      id: string;
      type: LearningTimelineEntryDTO['type'];
      title: string;
      description: string;
      timestamp: string;
      importance: number;
      icon: string;
    }>,
  ): LearningTimelineEntryDTO[] {
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getRecentEntries(
    entries: LearningTimelineEntryDTO[],
    days: number = 7,
  ): LearningTimelineEntryDTO[] {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }
}
