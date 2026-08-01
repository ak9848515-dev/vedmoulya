/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Progress Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningStreakDTO, SkillProgressDTO } from './LearningDTO.js';

export class LearningProgressService {
  private readonly streaks = new Map<string, LearningStreakDTO>();
  private readonly skillProgress = new Map<string, Map<string, SkillProgressDTO>>();

  getStreak(userId: string): LearningStreakDTO {
    const existing = this.streaks.get(userId);
    if (existing) return existing;
    const streak: LearningStreakDTO = {
      current: 0,
      longest: 0,
      weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
      monthlyActiveDays: 0,
      lastActiveDate: '',
    };
    this.streaks.set(userId, streak);
    return streak;
  }

  recordActivity(userId: string, hours: number): LearningStreakDTO {
    const streak = this.getStreak(userId);
    const today = new Date().toISOString().split('T')[0] ?? '';
    const lastActive = streak.lastActiveDate.split('T')[0];
    if (lastActive !== today) {
      const lastDate = lastActive ? new Date(lastActive) : new Date(0);
      const diff = Math.round((new Date().getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
      if (diff === 1) streak.current++;
      else streak.current = 1;
      if (streak.current > streak.longest) streak.longest = streak.current;
      streak.lastActiveDate = new Date().toISOString();
      const dayOfWeek = new Date().getDay();
      streak.weeklyActivity[dayOfWeek] = (streak.weeklyActivity[dayOfWeek] ?? 0) + hours;
      streak.monthlyActiveDays++;
    }
    return streak;
  }

  getSkillProgress(userId: string): SkillProgressDTO[] {
    const store = this.skillProgress.get(userId);
    return store ? Array.from(store.values()) : [];
  }

  updateSkillProgress(userId: string, skill: SkillProgressDTO): void {
    let store = this.skillProgress.get(userId);
    if (!store) {
      store = new Map();
      this.skillProgress.set(userId, store);
    }
    store.set(skill.skillName, skill);
  }
}
