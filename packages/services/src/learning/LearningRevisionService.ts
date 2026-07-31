// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Revision Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { RevisionScheduleDTO, RevisionItemDTO, RetentionIndicatorDTO } from './LearningDTO.js';

export class LearningRevisionService {
  buildSchedule(items: RevisionItemDTO[]): RevisionScheduleDTO {
    const now = Date.now();
    const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
    const dueToday = items.filter(
      (i) => new Date(i.dueDate).getTime() <= now && i.status !== 'completed',
    );
    const dueThisWeek = items.filter((i) => {
      const t = new Date(i.dueDate).getTime();
      return t > now && t <= weekFromNow && i.status !== 'completed';
    });
    const upcoming = items.filter(
      (i) => new Date(i.dueDate).getTime() > weekFromNow && i.status !== 'completed',
    );
    return {
      dueToday,
      dueThisWeek,
      upcoming,
      totalForReview: dueToday.length + dueThisWeek.length + upcoming.length,
    };
  }

  markCompleted(items: RevisionItemDTO[], id: string): RevisionItemDTO[] {
    return items.map((i) =>
      i.id === id ? { ...i, status: 'completed', lastReviewed: new Date().toISOString() } : i,
    );
  }

  getRetentionIndicators(items: RevisionItemDTO[]): RetentionIndicatorDTO[] {
    return items.map((item) => {
      const daysSinceReview = item.lastReviewed
        ? Math.round((Date.now() - new Date(item.lastReviewed).getTime()) / (24 * 60 * 60 * 1000))
        : 999;
      const retentionDecay = Math.max(0, 100 - daysSinceReview * 5);
      return {
        topic: item.topic,
        currentRetention: retentionDecay,
        targetRetention: 80,
        daysSinceReview,
        riskLevel: retentionDecay < 40 ? 'high' : retentionDecay < 60 ? 'medium' : 'low',
        nextReviewDue: item.dueDate,
      };
    });
  }

  getHighRiskTopics(indicators: RetentionIndicatorDTO[]): RetentionIndicatorDTO[] {
    return indicators.filter((i) => i.riskLevel === 'high');
  }
}
