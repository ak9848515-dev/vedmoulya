// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Metrics Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerMetricsDTO } from './CareerDTO.js';

export class CareerMetricsService {
  calculateCareerScore(components: {
    skillProficiency: number;
    experienceRelevance: number;
    interviewReadiness: number;
    resumeQuality: number;
    marketFit: number;
    certificationProgress: number;
    networkingScore: number;
  }): number {
    const weights = {
      skillProficiency: 0.25,
      experienceRelevance: 0.2,
      interviewReadiness: 0.15,
      resumeQuality: 0.1,
      marketFit: 0.1,
      certificationProgress: 0.1,
      networkingScore: 0.1,
    };
    let score = 0;
    score += (components.skillProficiency / 100) * weights.skillProficiency;
    score += (components.experienceRelevance / 100) * weights.experienceRelevance;
    score += (components.interviewReadiness / 100) * weights.interviewReadiness;
    score += (components.resumeQuality / 100) * weights.resumeQuality;
    score += (components.marketFit / 100) * weights.marketFit;
    score += (components.certificationProgress / 100) * weights.certificationProgress;
    score += (components.networkingScore / 100) * weights.networkingScore;
    return Math.round(score * 100);
  }

  calculateSkillGrowthRate(skills: Array<{ level: string; yearsOfExperience: number }>): number {
    if (skills.length === 0) return 0;
    const totalLevel = skills.reduce((s, sk) => {
      const levelVal: Record<string, number | undefined> = {
        beginner: 1,
        intermediate: 2,
        advanced: 3,
        expert: 4,
        master: 5,
      };
      // Unknown levels default to weight 1 (beginner) instead of NaN
      return s + (levelVal[sk.level] ?? 1);
    }, 0);
    return Math.min(100, Math.round((totalLevel / skills.length) * 20));
  }

  aggregate(components: {
    skillProficiency: number;
    experienceRelevance: number;
    interviewReadiness: number;
    resumeQuality: number;
    marketFit: number;
    certificationProgress: number;
    networkingScore: number;
    learningHoursThisMonth: number;
    applicationsThisMonth: number;
    interviewConversionRate: number;
    skillGrowthRate: number;
    jobMatchCount: number;
  }): CareerMetricsDTO {
    const careerScore = this.calculateCareerScore(components);
    return {
      careerScore,
      skillGrowthRate: components.skillGrowthRate,
      interviewReadiness: components.interviewReadiness,
      resumeHealth: components.resumeQuality,
      portfolioHealth: components.marketFit,
      jobMatchCount: components.jobMatchCount,
      marketFitScore: components.marketFit,
      certificationProgress: components.certificationProgress,
      networkingScore: components.networkingScore,
      learningHoursThisMonth: components.learningHoursThisMonth,
      applicationsThisMonth: components.applicationsThisMonth,
      interviewConversionRate: components.interviewConversionRate,
      overallProgress: Math.round(
        (careerScore + components.interviewReadiness + components.resumeQuality) / 3,
      ),
    };
  }
}
