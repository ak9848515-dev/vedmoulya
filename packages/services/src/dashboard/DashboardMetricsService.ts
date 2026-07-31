// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Metrics Service
// Metrics computation for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { DashboardMetricsDTO } from './DashboardDTO.js';

export class DashboardMetricsService {
  /** Calculate life score from component scores */
  calculateLifeScore(components: {
    goalProgress: number;
    missionProgress: number;
    executionRate: number;
    decisionQuality: number;
    learningHours: number;
    careerGrowth: number;
    consistency: number;
  }): number {
    const weights = {
      goalProgress: 0.2,
      missionProgress: 0.15,
      executionRate: 0.15,
      decisionQuality: 0.1,
      learningHours: 0.1,
      careerGrowth: 0.1,
      consistency: 0.2,
    };

    let score = 0;
    score += (components.goalProgress / 100) * weights.goalProgress;
    score += (components.missionProgress / 100) * weights.missionProgress;
    score += (components.executionRate / 100) * weights.executionRate;
    score += (components.decisionQuality / 100) * weights.decisionQuality;
    score += Math.min(components.learningHours / 40, 1) * weights.learningHours;
    score += Math.min(components.careerGrowth / 100, 1) * weights.careerGrowth;
    score += (components.consistency / 100) * weights.consistency;

    return Math.round(score * 100);
  }

  /** Calculate momentum based on recent trends */
  calculateMomentum(
    weeklyCompletion: number,
    monthlyCompletion: number,
    previousWeeklyCompletion: number,
  ): number {
    if (weeklyCompletion === 0 && monthlyCompletion === 0) return 0;
    const trend = weeklyCompletion - previousWeeklyCompletion;
    const base = (weeklyCompletion + monthlyCompletion) / 2;
    return Math.round(Math.max(0, Math.min(100, base + trend)));
  }

  /** Calculate consistency score */
  calculateConsistency(dailyCompletionRates: number[]): number {
    if (dailyCompletionRates.length === 0) return 0;
    const avg = dailyCompletionRates.reduce((a, b) => a + b, 0) / dailyCompletionRates.length;
    const variance =
      dailyCompletionRates.reduce((a, b) => a + (b - avg) ** 2, 0) / dailyCompletionRates.length;
    const stdDev = Math.sqrt(variance);
    // Lower stdDev = higher consistency
    const consistency = Math.max(0, 100 - stdDev * 2);
    return Math.round(consistency);
  }

  /** Calculate streak */
  calculateStreak(
    dailyCompletions: Array<{ date: string; completed: number; total: number }>,
  ): number {
    let streak = 0;
    const sorted = [...dailyCompletions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    for (const day of sorted) {
      if (day.total > 0 && day.completed / day.total >= 0.5) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /** Aggregate all metrics */
  aggregate(components: {
    goalProgress: number;
    missionProgress: number;
    executionRate: number;
    decisionQuality: number;
    learningHours: number;
    careerGrowth: number;
    weeklyCompletion: number;
    monthlyCompletion: number;
    previousWeeklyCompletion: number;
    dailyCompletionRates: number[];
    dailyCompletions: Array<{ date: string; completed: number; total: number }>;
    consistency: number;
  }): DashboardMetricsDTO {
    return {
      lifeScore: this.calculateLifeScore(components),
      goalProgress: components.goalProgress,
      missionProgress: components.missionProgress,
      executionRate: components.executionRate,
      decisionQuality: components.decisionQuality,
      learningHours: components.learningHours,
      careerGrowth: components.careerGrowth,
      consistency: components.consistency,
      momentum: this.calculateMomentum(
        components.weeklyCompletion,
        components.monthlyCompletion,
        components.previousWeeklyCompletion,
      ),
      streak: this.calculateStreak(components.dailyCompletions),
      weeklyCompletion: components.weeklyCompletion,
      monthlyCompletion: components.monthlyCompletion,
    };
  }
}
