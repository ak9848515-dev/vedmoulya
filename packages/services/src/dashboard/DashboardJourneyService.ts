// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Journey Service
// Journey tracking for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type { JourneyDTO, JourneyDayDTO, JourneyPeriodDTO } from './DashboardDTO.js';

export class DashboardJourneyService {
  /** Build today's journey */
  buildTodayJourney(
    completedTasks: number,
    totalTasks: number,
    highlights: string[],
    challenges: string[],
  ): JourneyDayDTO {
    return {
      date: new Date().toISOString().split('T')[0] ?? '',
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      highlights,
      challenges,
    };
  }

  /** Build weekly journey period */
  buildWeekJourney(
    dailyCompletions: Array<{ date: string; completed: number; total: number }>,
    missions: Array<{ completed: boolean }>,
  ): JourneyPeriodDTO {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekTasks = dailyCompletions.filter((d) => new Date(d.date) >= weekStart);

    const completedTasks = weekTasks.reduce((sum, d) => sum + d.completed, 0);
    const totalTasks = weekTasks.reduce((sum, d) => sum + d.total, 0);
    const completedMissions = missions.filter((m) => m.completed).length;

    return {
      startDate: weekStart.toISOString(),
      endDate: now.toISOString(),
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completedMissions,
      totalMissions: missions.length,
      trend: this.calculateTrend(dailyCompletions),
    };
  }

  /** Build monthly journey period */
  buildMonthJourney(
    dailyCompletions: Array<{ date: string; completed: number; total: number }>,
    missions: Array<{ completed: boolean }>,
  ): JourneyPeriodDTO {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTasks = dailyCompletions.filter((d) => new Date(d.date) >= monthStart);

    const completedTasks = monthTasks.reduce((sum, d) => sum + d.completed, 0);
    const totalTasks = monthTasks.reduce((sum, d) => sum + d.total, 0);
    const completedMissions = missions.filter((m) => m.completed).length;

    return {
      startDate: monthStart.toISOString(),
      endDate: now.toISOString(),
      completedTasks,
      totalTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      completedMissions,
      totalMissions: missions.length,
      trend: this.calculateTrend(dailyCompletions),
    };
  }

  /** Build full journey */
  buildJourney(
    today: JourneyDayDTO,
    week: JourneyPeriodDTO,
    month: JourneyPeriodDTO,
    dailyCompletionRates: number[],
    dailyCompletions: Array<{ date: string; completed: number; total: number }>,
  ): JourneyDTO {
    const consistency = this.calculateConsistency(dailyCompletionRates);
    const streak = this.calculateStreak(dailyCompletions);
    const momentum = this.calculateMomentum(week.completionRate, month.completionRate, consistency);

    return { today, week, month, momentum, consistency, streak };
  }

  private calculateTrend(
    dailyCompletions: Array<{ date: string; completed: number; total: number }>,
  ): 'improving' | 'declining' | 'stable' {
    const sorted = [...dailyCompletions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    if (sorted.length < 2) return 'stable';

    const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

    const firstAvg =
      firstHalf.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) /
      firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) /
      secondHalf.length;

    if (secondAvg > firstAvg + 0.1) return 'improving';
    if (secondAvg < firstAvg - 0.1) return 'declining';
    return 'stable';
  }

  private calculateConsistency(rates: number[]): number {
    if (rates.length === 0) return 0;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((a, b) => a + (b - avg) ** 2, 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    return Math.round(Math.max(0, 100 - stdDev * 2));
  }

  private calculateStreak(
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

  private calculateMomentum(weekly: number, monthly: number, consistency: number): number {
    if (weekly === 0 && monthly === 0) return 0;
    return Math.round(Math.max(0, Math.min(100, (weekly + monthly + consistency) / 3)));
  }
}
