// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning DTO Mapper
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  LearningPathDTO,
  LearningProjectDTO,
  AssessmentDTO,
  QuickActionDTO,
  LearningMetricsDTO,
  LearningHealthIndicatorDTO,
  LearningTimelineDTO,
  LearningTimelineEntryDTO,
} from './LearningDTO.js';

export class LearningDTOMapper {
  toPathDTO(path: LearningPathDTO): LearningPathDTO {
    return path;
  }

  toProjectDTO(project: LearningProjectDTO): LearningProjectDTO {
    return project;
  }

  toAssessmentDTO(assessment: AssessmentDTO): AssessmentDTO {
    return assessment;
  }

  toTimeline(entries: LearningTimelineEntryDTO[]): LearningTimelineDTO {
    return { entries, totalEntries: entries.length, hasMore: entries.length >= 20 };
  }

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

  createHealthIndicator(
    services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>,
  ): LearningHealthIndicatorDTO {
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

  aggregateMetrics(components: {
    learningScore: number;
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
    return {
      learningScore: components.learningScore,
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
        (components.learningScore + components.knowledgeRetention + components.weeklyProgress) / 3,
      ),
    };
  }
}
