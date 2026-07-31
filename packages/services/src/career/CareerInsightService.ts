// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Insight Service
// Generates career insights by analyzing patterns
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  CareerInsightDTO,
  SkillGapDTO,
  InterviewReadinessDTO,
  ResumeHealthDTO,
  CareerMetricsDTO,
  JobMatchDTO,
} from './CareerDTO.js';

export class CareerInsightService {
  generateInsights(input: {
    gaps: SkillGapDTO[];
    interview: InterviewReadinessDTO;
    resume: ResumeHealthDTO;
    metrics: CareerMetricsDTO;
    jobMatches: JobMatchDTO[];
    skillCount: number;
  }): CareerInsightDTO[] {
    const insights: CareerInsightDTO[] = [];
    const now = new Date().toISOString();

    // Gap pattern insights
    const criticalGaps = input.gaps.filter((g) => g.priority === 'critical');
    if (criticalGaps.length >= 3) {
      insights.push({
        id: `cinsight_gaps_${String(Date.now())}`,
        type: 'warning',
        title: 'Significant Skill Gaps Detected',
        description: `You have ${String(criticalGaps.length)} critical skill gaps to address. Prioritize learning ${criticalGaps[0]?.skillName ?? ''}.`,
        severity: 'warning',
        source: 'skills',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Gaps',
        actionRoute: '/career/skills',
      });
    }

    // Achievement insights
    if (input.skillCount >= 10) {
      insights.push({
        id: `cinsight_skills_${String(Date.now())}`,
        type: 'achievement',
        title: 'Diverse Skill Set',
        description: `You've built ${String(input.skillCount)} skills across your career. This diversity increases market adaptability.`,
        severity: 'positive',
        source: 'skills',
        timestamp: now,
        actionable: false,
      });
    }

    if (input.interview.overallScore >= 70) {
      insights.push({
        id: `cinsight_interview_${String(Date.now())}`,
        type: 'achievement',
        title: 'Interview Ready',
        description:
          'Your interview readiness score indicates you are well-prepared for interviews.',
        severity: 'positive',
        source: 'interview',
        timestamp: now,
        actionable: false,
      });
    }

    // Market trend insights
    if (input.jobMatches.length >= 5) {
      insights.push({
        id: `cinsight_market_${String(Date.now())}`,
        type: 'trend',
        title: 'Strong Market Demand',
        description: `${String(input.jobMatches.length)} jobs match your profile. The market is actively seeking your skills.`,
        severity: 'positive',
        source: 'market',
        timestamp: now,
        actionable: true,
        actionLabel: 'View Jobs',
        actionRoute: '/career/jobs',
      });
    }

    if (input.jobMatches.length === 0 && input.skillCount > 0) {
      insights.push({
        id: `cinsight_nomatches_${String(Date.now())}`,
        type: 'prediction',
        title: 'Job Market Mismatch',
        description:
          'No jobs currently match your profile. Consider expanding your skill set or adjusting your target role.',
        severity: 'info',
        source: 'market',
        timestamp: now,
        actionable: true,
        actionLabel: 'Explore Skills',
        actionRoute: '/career/skills',
      });
    }

    // Resume insights
    if (input.resume.completeness < 50) {
      insights.push({
        id: `cinsight_resume_${String(Date.now())}`,
        type: 'warning',
        title: 'Resume Needs Major Improvement',
        description: `Your resume completeness is ${String(input.resume.completeness)}%. A weak resume reduces interview chances regardless of qualifications.`,
        severity: 'warning',
        source: 'resume',
        timestamp: now,
        actionable: true,
        actionLabel: 'Improve Resume',
        actionRoute: '/career/resume',
      });
    }

    // Growth trajectory insight
    if (input.metrics.overallProgress > 50) {
      insights.push({
        id: `cinsight_growth_${String(Date.now())}`,
        type: 'trend',
        title: 'Strong Career Trajectory',
        description:
          'Your career metrics show solid progress. Continue building on your strengths.',
        severity: 'positive',
        source: 'career',
        timestamp: now,
        actionable: false,
      });
    }

    return insights.sort((a, b) => {
      const order: Record<string, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
      return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    });
  }

  getActionableInsights(insights: CareerInsightDTO[]): CareerInsightDTO[] {
    return insights.filter((i) => i.actionable);
  }
}
