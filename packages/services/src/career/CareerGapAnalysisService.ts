/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Gap Analysis Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { SkillDTO, SkillGapDTO, SkillLevel, SkillCategory } from './CareerDTO.js';

const LEVEL_ORDER: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
  master: 5,
};

export class CareerGapAnalysisService {
  analyzeGaps(
    currentSkills: SkillDTO[],
    requiredSkills: Array<{ name: string; category: SkillCategory; requiredLevel: SkillLevel }>,
  ): SkillGapDTO[] {
    const gaps: SkillGapDTO[] = [];

    for (const required of requiredSkills) {
      const current = currentSkills.find(
        (s) => s.name.toLowerCase() === required.name.toLowerCase(),
      );
      const currentLevel = current?.level ?? 'beginner';
      const gapSize = Math.max(0, LEVEL_ORDER[required.requiredLevel] - LEVEL_ORDER[currentLevel]);

      if (gapSize > 0) {
        gaps.push({
          skillName: required.name,
          category: required.category,
          currentLevel,
          requiredLevel: required.requiredLevel,
          gapSize,
          priority: gapSize >= 3 ? 'critical' : gapSize >= 2 ? 'high' : 'medium',
          recommendedResources: [],
          estimatedTimeToClose: gapSize * 40,
          relevanceToGoal: Math.round(Math.max(0, 100 - gapSize * 25)),
        });
      }
    }

    return gaps.sort((a, b) => b.gapSize - a.gapSize);
  }

  getPriorityGaps(
    gaps: SkillGapDTO[],
    minPriority: 'critical' | 'high' | 'medium' | 'low' = 'high',
  ): SkillGapDTO[] {
    const levels = { critical: 0, high: 1, medium: 2, low: 3 };
    return gaps.filter((g) => levels[g.priority] <= levels[minPriority]);
  }

  calculateGapClosureRate(gaps: SkillGapDTO[]): number {
    if (gaps.length === 0) return 100;
    const totalGap = gaps.reduce((s, g) => s + g.gapSize, 0);
    const maxGap = gaps.reduce((s, g) => s + (LEVEL_ORDER[g.requiredLevel] - 1), 0);
    return maxGap > 0 ? Math.round((1 - totalGap / maxGap) * 100) : 100;
  }
}
