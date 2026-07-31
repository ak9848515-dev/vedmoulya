import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardJourneyService } from '../DashboardJourneyService.js';

describe('DashboardJourneyService', () => {
  let service: DashboardJourneyService;

  beforeEach(() => {
    service = new DashboardJourneyService();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildTodayJourney', () => {
    it('builds today journey with completion rate', () => {
      const today = service.buildTodayJourney(3, 5, ['Good progress'], ['Need more focus']);
      expect(today.date).toBe('2026-06-15');
      expect(today.completedTasks).toBe(3);
      expect(today.totalTasks).toBe(5);
      expect(today.completionRate).toBe(60);
      expect(today.highlights).toContain('Good progress');
      expect(today.challenges).toContain('Need more focus');
    });

    it('handles zero tasks', () => {
      const today = service.buildTodayJourney(0, 0, [], []);
      expect(today.completionRate).toBe(0);
    });

    it('handles all completed', () => {
      const today = service.buildTodayJourney(5, 5, [], []);
      expect(today.completionRate).toBe(100);
    });
  });

  describe('buildWeekJourney', () => {
    it('builds weekly period with trend', () => {
      const weekly = service.buildWeekJourney(
        [
          { date: '2026-06-08', completed: 3, total: 5 },
          { date: '2026-06-09', completed: 4, total: 5 },
          { date: '2026-06-10', completed: 5, total: 5 },
        ],
        [{ completed: true }, { completed: false }],
      );
      expect(weekly.completedMissions).toBe(1);
      expect(weekly.totalMissions).toBe(2);
      expect(['improving', 'declining', 'stable']).toContain(weekly.trend);
    });

    it('handles empty data', () => {
      const weekly = service.buildWeekJourney([], []);
      expect(weekly.completedTasks).toBe(0);
      expect(weekly.completionRate).toBe(0);
    });
  });

  describe('buildMonthJourney', () => {
    it('builds monthly period', () => {
      const monthly = service.buildMonthJourney(
        [
          { date: '2026-06-01', completed: 10, total: 15 },
          { date: '2026-06-02', completed: 8, total: 10 },
        ],
        [{ completed: true }, { completed: true }, { completed: false }],
      );
      expect(monthly.completedTasks).toBe(18);
      expect(monthly.totalTasks).toBe(25);
      expect(monthly.completedMissions).toBe(2);
    });
  });

  describe('buildJourney', () => {
    it('builds full journey with momentum and consistency', () => {
      const today = service.buildTodayJourney(3, 5, [], []);
      const week = service.buildWeekJourney([{ date: '2026-06-08', completed: 3, total: 5 }], []);
      const month = service.buildMonthJourney(
        [{ date: '2026-06-01', completed: 10, total: 15 }],
        [],
      );

      const journey = service.buildJourney(
        today,
        week,
        month,
        [80, 90, 100],
        [{ date: '2026-06-13', completed: 4, total: 5 }],
      );
      expect(journey.today.completedTasks).toBe(3);
      expect(journey.consistency).toBeGreaterThan(0);
      expect(journey.streak).toBeGreaterThanOrEqual(0);
      expect(journey.momentum).toBeGreaterThan(0);
    });

    it('handles empty completion rates', () => {
      const today = service.buildTodayJourney(0, 0, [], []);
      const week = service.buildWeekJourney([], []);
      const month = service.buildMonthJourney([], []);

      const journey = service.buildJourney(today, week, month, [], []);
      expect(journey.consistency).toBe(0);
      expect(journey.streak).toBe(0);
      expect(journey.momentum).toBe(0);
    });
  });
});
