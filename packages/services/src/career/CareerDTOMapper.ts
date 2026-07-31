// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career DTO Mapper
// Maps between domain models and career DTOs
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  CareerProfileDTO,
  SkillDTO,
  SkillGapDTO,
  SkillInventoryDTO,
  CareerRoadmapDTO,
  ResumeHealthDTO,
  PortfolioHealthDTO,
  InterviewReadinessDTO,
  JobMatchDTO,
  MarketInsightDTO,
  CertificationDTO,
  CareerTimelineDTO,
  CareerTimelineEntryDTO,
  QuickActionDTO,
  CareerMetricsDTO,
  CareerHealthIndicatorDTO,
  CareerMilestoneDTO,
} from './CareerDTO.js';

import type { UserDTO } from '../identity/UserDTO.js';

export class CareerDTOMapper {
  /** Map UserDTO to CareerProfileDTO */
  toProfile(
    user: UserDTO,
    title: string,
    industry: string,
    yearsOfExperience: number,
  ): CareerProfileDTO {
    return {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      currentTitle: title,
      industry,
      yearsOfExperience,
      summary: '',
      strengths: [],
      growthAreas: [],
      careerStage: 'exploring',
      preferredLocations: [],
      openToRelocation: false,
      openToRemote: true,
      employmentType: ['full-time'],
      socialLinks: [],
      updatedAt: new Date().toISOString(),
    };
  }

  /** Map skills to SkillInventoryDTO */
  toSkillInventory(skills: SkillDTO[]): SkillInventoryDTO {
    return {
      skills,
      totalCount: skills.length,
      lastAssessed: new Date().toISOString(),
    };
  }

  /** Map to SkillGapDTO array */
  toGapResults(gaps: SkillGapDTO[]): SkillGapDTO[] {
    return gaps.sort((a, b) => b.priority.localeCompare(a.priority) || b.gapSize - a.gapSize);
  }

  /** Map to CareerRoadmapDTO */
  toRoadmap(
    currentStage: string,
    targetStage: string,
    stages: CareerRoadmapDTO['stages'],
    milestones: CareerMilestoneDTO[],
    estimatedMonths: number,
    progress: number,
  ): CareerRoadmapDTO {
    return {
      currentStage,
      targetStage,
      stages,
      milestones,
      estimatedTimelineMonths: estimatedMonths,
      progress,
      flexibilityScore: 75,
      alternativePaths: [],
    };
  }

  /** Map resume analysis to ResumeHealthDTO */
  toResumeHealth(
    completeness: number,
    atsScore: number,
    sections: ResumeHealthDTO['sections'],
    missingSections: string[],
    suggestions: string[],
    keywordDensity: Record<string, number>,
  ): ResumeHealthDTO {
    return {
      completeness,
      atsScore,
      sections,
      missingSections,
      suggestions,
      keywordDensity,
      versionCount: 1,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  /** Map to PortfolioHealthDTO */
  toPortfolioHealth(
    completeness: number,
    projectCount: number,
    technologies: string[],
    suggestions: string[],
  ): PortfolioHealthDTO {
    return {
      completeness,
      projectCount,
      featuredProjects: [],
      technologies,
      hasWebsite: false,
      hasGitHub: false,
      hasLinkedIn: false,
      hasPersonalSite: false,
      suggestions,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  /** Map to InterviewReadinessDTO */
  toInterviewReadiness(
    overallScore: number,
    behavioralScore: number,
    technicalScore: number,
    weakAreas: string[],
    strongAreas: string[],
  ): InterviewReadinessDTO {
    return {
      overallScore,
      behavioralScore,
      technicalScore,
      systemDesignScore: 0,
      questionCategories: [],
      weakAreas,
      strongAreas,
      mockInterviewCount: 0,
      recommendedPractice: [],
    };
  }

  /** Map to JobMatchDTO array */
  toJobMatches(matches: JobMatchDTO[]): JobMatchDTO[] {
    return matches.sort((a, b) => b.fitScore - a.fitScore);
  }

  /** Map to MarketInsightDTO */
  toMarketInsight(industry: string): MarketInsightDTO {
    return {
      industry,
      trends: [],
      emergingSkills: [],
      decliningSkills: [],
      certificationDemand: [],
      salaryInsights: [],
      hiringTrends: [],
      topEmployers: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /** Map to CertificationDTO array */
  toCertifications(certs: CertificationDTO[]): CertificationDTO[] {
    return certs.sort((a, b) => b.progress - a.progress);
  }

  /** Map to CareerTimelineDTO */
  toTimeline(entries: CareerTimelineEntryDTO[]): CareerTimelineDTO {
    return {
      entries,
      totalEntries: entries.length,
      hasMore: entries.length >= 20,
    };
  }

  /** Create a quick action DTO */
  createQuickAction(
    id: string,
    label: string,
    description: string,
    icon: string,
    route: string,
    priority: number,
    category: string,
    isAvailable: boolean = true,
    disabledReason?: string,
  ): QuickActionDTO {
    return { id, label, description, icon, route, priority, category, isAvailable, disabledReason };
  }

  /** Create a health indicator DTO */
  createHealthIndicator(
    services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>,
  ): CareerHealthIndicatorDTO {
    const warnings: string[] = [];
    let overall: 'healthy' | 'degraded' | 'critical' = 'healthy';

    for (const svc of services) {
      if (svc.status === 'down') {
        overall = 'critical';
        warnings.push(`${svc.name} is down`);
      } else if (svc.status === 'degraded' && overall !== 'critical') {
        overall = 'degraded';
        warnings.push(`${svc.name} is degraded (${String(svc.latency)}ms)`);
      }
    }

    return { overall, services, lastChecked: new Date().toISOString(), warnings };
  }

  /** Aggregate career metrics */
  aggregateMetrics(components: {
    careerScore: number;
    skillGrowthRate: number;
    interviewReadiness: number;
    resumeHealth: number;
    portfolioHealth: number;
    jobMatchCount: number;
    marketFitScore: number;
    certificationProgress: number;
    networkingScore: number;
    learningHoursThisMonth: number;
    applicationsThisMonth: number;
    interviewConversionRate: number;
  }): CareerMetricsDTO {
    return {
      careerScore: components.careerScore,
      skillGrowthRate: components.skillGrowthRate,
      interviewReadiness: components.interviewReadiness,
      resumeHealth: components.resumeHealth,
      portfolioHealth: components.portfolioHealth,
      jobMatchCount: components.jobMatchCount,
      marketFitScore: components.marketFitScore,
      certificationProgress: components.certificationProgress,
      networkingScore: components.networkingScore,
      learningHoursThisMonth: components.learningHoursThisMonth,
      applicationsThisMonth: components.applicationsThisMonth,
      interviewConversionRate: components.interviewConversionRate,
      overallProgress: Math.round(
        (components.careerScore +
          components.skillGrowthRate +
          components.interviewReadiness +
          components.resumeHealth +
          components.marketFitScore) /
          5,
      ),
    };
  }
}
