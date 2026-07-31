// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Metrics Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningMetricsDTO } from './LearningDTO.js';

export class LearningMetricsService {
  calculateLearningScore(components: {
    knowledgeRetention: number;
    weeklyProgress: number;
    consistencyScore: number;
    breadthScore: number;
    depthScore: number;
    streak: number;
  }): number {
    return Math.round(
      (components.knowledgeRetention * 0.25 +
        components.weeklyProgress * 0.2 +
        components.consistencyScore * 0.2 +
        components.breadthScore * 0.15 +
        components.depthScore * 0.1 +
        Math.min(components.streak * 2, 10)) *
        10,
    );
  }

  aggregate(components: {
    knowledgeRetention: number;
    weeklyProgress: number;
    monthlyProgress: number;
    streak: number;
    hoursLearnedThisWeek: number;
    hoursLearnedThisMonth: number;
    topicsCompleted: number;
    assessmentsPassed: number;
    projectsCompleted: number;
    consistencyScore: number;
    breadthScore: number;
    depthScore: number;
  }): LearningMetricsDTO {
    const learningScore = this.calculateLearningScore(components);
    return {
      learningScore,
      knowledgeRetention: components.knowledgeRetention,
      weeklyProgress: components.weeklyProgress,
      monthlyProgress: components.monthlyProgress,
      streak: components.streak,
      hoursLearnedThisWeek: components.hoursLearnedThisWeek,
      hoursLearnedThisMonth: components.hoursLearnedThisMonth,
      topicsCompleted: components.topicsCompleted,
      assessmentsPassed: components.assessmentsPassed,
      projectsCompleted: components.projectsCompleted,
      consistencyScore: components.consistencyScore,
      breadthScore: components.breadthScore,
      depthScore: components.depthScore,
      overallProgress: Math.round(
        (learningScore + components.weeklyProgress + components.consistencyScore) / 3,
      ),
    };
  }
}
