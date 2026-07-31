// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Insight Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  LearningInsightDTO,
  RevisionScheduleDTO,
  LearningStreakDTO,
  LearningMetricsDTO,
} from './LearningDTO.js';

export class LearningInsightService {
  generateInsights(input: {
    revision: RevisionScheduleDTO;
    streak: LearningStreakDTO;
    metrics: LearningMetricsDTO;
    topicsCompleted: number;
    assessmentsPassed: number;
  }): LearningInsightDTO[] {
    const insights: LearningInsightDTO[] = [];
    const now = new Date().toISOString();

    if (input.revision.dueToday.length >= 3) {
      insights.push({
        id: `linsight_revision_${String(Date.now())}`,
        type: 'warning',
        title: 'Revision Backlog',
        description: `You have ${String(input.revision.dueToday.length)} items due for revision today.`,
        severity: 'warning',
        source: 'revision',
        timestamp: now,
        actionable: true,
        actionLabel: 'Start Revision',
        actionRoute: '/learning/revision',
      });
    }

    if (input.streak.current >= 7) {
      insights.push({
        id: `linsight_streak_${String(Date.now())}`,
        type: 'achievement',
        title: `${String(input.streak.current)}-Day Streak!`,
        description: `You've maintained a ${String(input.streak.current)}-day learning streak. Consistency is building powerful habits.`,
        severity: 'positive',
        source: 'progress',
        timestamp: now,
        actionable: false,
      });
    }

    if (input.metrics.weeklyProgress > 80) {
      insights.push({
        id: `linsight_progress_${String(Date.now())}`,
        type: 'achievement',
        title: 'Excellent Weekly Progress',
        description: `You've achieved ${String(input.metrics.weeklyProgress)}% of your weekly goals. Outstanding dedication!`,
        severity: 'positive',
        source: 'metrics',
        timestamp: now,
        actionable: false,
      });
    }

    if (input.metrics.weeklyProgress < 20 && input.topicsCompleted > 0) {
      insights.push({
        id: `linsight_low_${String(Date.now())}`,
        type: 'warning',
        title: 'Weekly Progress Lagging',
        description: 'Your weekly progress is below target. Consider adjusting your weekly goals.',
        severity: 'warning',
        source: 'metrics',
        timestamp: now,
        actionable: true,
        actionLabel: 'Adjust Goals',
        actionRoute: '/learning/goals',
      });
    }

    if (input.assessmentsPassed >= 3) {
      insights.push({
        id: `linsight_assess_${String(Date.now())}`,
        type: 'achievement',
        title: 'Assessment Milestone',
        description: `You've passed ${String(input.assessmentsPassed)} assessments. Knowledge is solidifying!`,
        severity: 'positive',
        source: 'assessment',
        timestamp: now,
        actionable: false,
      });
    }

    if (input.topicsCompleted >= 10) {
      insights.push({
        id: `linsight_topics_${String(Date.now())}`,
        type: 'achievement',
        title: 'Topics Mastered',
        description: `You've completed ${String(input.topicsCompleted)} learning topics. Building deep expertise.`,
        severity: 'positive',
        source: 'learning',
        timestamp: now,
        actionable: false,
      });
    }

    return insights.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
      return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });
  }

  getActionableInsights(insights: LearningInsightDTO[]): LearningInsightDTO[] {
    return insights.filter((i) => i.actionable);
  }
}
