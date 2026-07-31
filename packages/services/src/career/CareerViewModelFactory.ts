// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career ViewModel Factory
// Creates view models from career DTOs for the UI layer
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  CareerSnapshotDTO,
  CareerProfileDTO,
  SkillDTO,
  SkillGapDTO,
  CareerRoadmapDTO,
  ResumeHealthDTO,
  InterviewReadinessDTO,
  JobMatchDTO,
  MarketInsightDTO,
  CertificationDTO,
  CareerTimelineDTO,
  CareerInsightDTO,
  CareerRecommendationDTO,
  CareerNotificationDTO,
  QuickActionDTO,
  CareerMetricsDTO,
  CareerHealthIndicatorDTO,
} from './CareerDTO.js';

export interface ProfileViewModel {
  displayName: string;
  currentTitle: string;
  industry: string;
  yearsOfExperience: number;
  summary: string;
  strengthCount: number;
  growthAreaCount: number;
  careerStage: string;
  stageLabel: string;
  targetRole: string;
}

export interface SkillViewModel {
  totalSkills: number;
  topSkills: Array<{ name: string; level: string; category: string }>;
  missingSkills: number;
  criticalGaps: number;
  learningProgress: number;
}

export interface RoadmapViewModel {
  currentStage: string;
  targetStage: string;
  progress: number;
  timelineMonths: number;
  milestonesCompleted: number;
  milestonesTotal: number;
  stageCount: number;
}

export interface ResumeViewModel {
  completeness: number;
  completenessLabel: string;
  atsScore: number;
  atsLabel: string;
  missingSections: string[];
  suggestionCount: number;
  needsAttention: boolean;
}

export interface InterviewViewModel {
  overallScore: number;
  scoreLabel: string;
  behavioralScore: number;
  technicalScore: number;
  weakAreas: string[];
  strongAreas: string[];
  recommendedPractice: string[];
  isReady: boolean;
}

export interface JobMarketViewModel {
  matchCount: number;
  topMatchTitle: string;
  topMatchScore: number;
  topMatchCompany: string;
  marketTrends: number;
  emergingSkills: string[];
  topEmployers: string[];
}

export interface CareerDashboardViewModel {
  profile: ProfileViewModel;
  skills: SkillViewModel;
  roadmap: RoadmapViewModel;
  resume: ResumeViewModel;
  interview: InterviewViewModel;
  jobMarket: JobMarketViewModel;
  certifications: CertificationDTO[];
  timeline: CareerTimelineDTO;
  insights: CareerInsightDTO[];
  recommendations: CareerRecommendationDTO[];
  notifications: CareerNotificationDTO[];
  quickActions: QuickActionDTO[];
  metrics: CareerMetricsDTO;
  health: CareerHealthIndicatorDTO;
  lastRefreshed: string;
}

export class CareerViewModelFactory {
  createProfileViewModel(profile: CareerProfileDTO): ProfileViewModel {
    return {
      displayName: profile.displayName,
      currentTitle: profile.currentTitle,
      industry: profile.industry,
      yearsOfExperience: profile.yearsOfExperience,
      summary: profile.summary,
      strengthCount: profile.strengths.length,
      growthAreaCount: profile.growthAreas.length,
      careerStage: profile.careerStage,
      stageLabel: this.getStageLabel(profile.careerStage),
      targetRole: profile.targetRole ?? 'Not set',
    };
  }

  createSkillViewModel(skills: SkillDTO[], gaps: SkillGapDTO[]): SkillViewModel {
    const sorted = [...skills].sort(
      (a, b) => b.level.localeCompare(a.level) || b.yearsOfExperience - a.yearsOfExperience,
    );
    return {
      totalSkills: skills.length,
      topSkills: sorted.slice(0, 5).map((s) => ({
        name: s.name,
        level: s.level,
        category: s.category,
      })),
      missingSkills: gaps.length,
      criticalGaps: gaps.filter((g) => g.priority === 'critical').length,
      learningProgress:
        skills.length > 0
          ? Math.round(
              (skills.filter((s) => s.level === 'advanced' || s.level === 'expert').length /
                skills.length) *
                100,
            )
          : 0,
    };
  }

  createRoadmapViewModel(roadmap: CareerRoadmapDTO): RoadmapViewModel {
    const completed = roadmap.milestones.filter((m) => m.status === 'completed').length;
    return {
      currentStage: roadmap.currentStage,
      targetStage: roadmap.targetStage,
      progress: roadmap.progress,
      timelineMonths: roadmap.estimatedTimelineMonths,
      milestonesCompleted: completed,
      milestonesTotal: roadmap.milestones.length,
      stageCount: roadmap.stages.length,
    };
  }

  createResumeViewModel(resume: ResumeHealthDTO): ResumeViewModel {
    return {
      completeness: resume.completeness,
      completenessLabel: this.getPercentageLabel(resume.completeness),
      atsScore: resume.atsScore,
      atsLabel: this.getAtsLabel(resume.atsScore),
      missingSections: resume.missingSections,
      suggestionCount: resume.suggestions.length,
      needsAttention: resume.completeness < 70 || resume.atsScore < 60,
    };
  }

  createInterviewViewModel(interview: InterviewReadinessDTO): InterviewViewModel {
    return {
      overallScore: interview.overallScore,
      scoreLabel: this.getScoreLabel(interview.overallScore),
      behavioralScore: interview.behavioralScore,
      technicalScore: interview.technicalScore,
      weakAreas: interview.weakAreas,
      strongAreas: interview.strongAreas,
      recommendedPractice: interview.recommendedPractice,
      isReady: interview.overallScore >= 70,
    };
  }

  createJobMarketViewModel(jobs: JobMatchDTO[], market: MarketInsightDTO): JobMarketViewModel {
    const topMatch = jobs[0];
    return {
      matchCount: jobs.length,
      topMatchTitle: topMatch?.title ?? 'No matches yet',
      topMatchScore: topMatch?.fitScore ?? 0,
      topMatchCompany: topMatch?.company ?? '',
      marketTrends: market.trends.length,
      emergingSkills: market.emergingSkills,
      topEmployers: market.topEmployers,
    };
  }

  createDashboardViewModel(snapshot: CareerSnapshotDTO): CareerDashboardViewModel {
    return {
      profile: this.createProfileViewModel(snapshot.profile),
      skills: this.createSkillViewModel(snapshot.skills.skills, snapshot.gaps),
      roadmap: this.createRoadmapViewModel(snapshot.roadmap),
      resume: this.createResumeViewModel(snapshot.resume),
      interview: this.createInterviewViewModel(snapshot.interview),
      jobMarket: this.createJobMarketViewModel(snapshot.jobs, snapshot.market),
      certifications: snapshot.certifications,
      timeline: snapshot.timeline,
      insights: snapshot.insights,
      recommendations: snapshot.recommendations,
      notifications: snapshot.notifications,
      quickActions: snapshot.quickActions,
      metrics: snapshot.metrics,
      health: snapshot.health,
      lastRefreshed: snapshot.generatedAt,
    };
  }

  private getStageLabel(stage: string): string {
    const labels: Record<string, string> = {
      exploring: 'Exploring Options',
      early: 'Early Career',
      mid: 'Mid Career',
      senior: 'Senior Level',
      leadership: 'Leadership',
      expert: 'Industry Expert',
    };
    return labels[stage] ?? 'Exploring';
  }

  private getPercentageLabel(value: number): string {
    if (value >= 90) return 'Excellent';
    if (value >= 75) return 'Good';
    if (value >= 60) return 'Fair';
    return 'Needs Improvement';
  }

  private getAtsLabel(score: number): string {
    if (score >= 80) return 'ATS Optimized';
    if (score >= 60) return 'Moderate ATS Fit';
    return 'Needs ATS Optimization';
  }

  private getScoreLabel(score: number): string {
    if (score >= 80) return 'Ready';
    if (score >= 60) return 'Nearly Ready';
    if (score >= 40) return 'In Progress';
    return 'Needs Practice';
  }
}
