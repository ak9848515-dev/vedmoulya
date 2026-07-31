// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning ViewModel Factory
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type {
  LearningSnapshotDTO,
  LearningProfileDTO,
  LearningPathDTO,
  LearningGoalDTO,
  LearningMetricsDTO,
  LearningStreakDTO,
  RevisionScheduleDTO,
  LearningHealthIndicatorDTO,
  LearningRecommendationDTO,
  LearningNotificationDTO,
  QuickActionDTO,
  LearningTimelineDTO,
  AssessmentDTO,
  AchievementDTO,
} from './LearningDTO.js';

export interface ProfileViewModel {
  displayName: string;
  learningStyle: string;
  weeklyGoalHours: number;
  currentLevel: string;
  goals: string[];
  preferredTopics: string[];
}

export interface PathViewModel {
  activePaths: number;
  completedPaths: number;
  recommendedPaths: number;
  totalEstimatedHours: number;
  completedHours: number;
  progress: number;
  nextTopic: string;
  currentPath: string;
}

export interface RevisionViewModel {
  dueToday: number;
  dueThisWeek: number;
  totalForReview: number;
  highRiskTopics: number;
  nextRevision: string;
}

export interface StreakViewModel {
  current: number;
  longest: number;
  weeklyActiveDays: number;
  momentumLabel: string;
  isAtRisk: boolean;
}

export interface LearningDashboardViewModel {
  profile: ProfileViewModel;
  paths: PathViewModel;
  revision: RevisionViewModel;
  streak: StreakViewModel;
  knowledgeMap: { nodeCount: number; edgeCount: number; lastUpdated: string };
  goals: LearningGoalDTO[];
  assessments: AssessmentDTO[];
  achievements: AchievementDTO[];
  metrics: LearningMetricsDTO;
  timeline: LearningTimelineDTO;
  recommendations: LearningRecommendationDTO[];
  notifications: LearningNotificationDTO[];
  quickActions: QuickActionDTO[];
  health: LearningHealthIndicatorDTO;
  lastRefreshed: string;
}

export class LearningViewModelFactory {
  createProfileViewModel(profile: LearningProfileDTO): ProfileViewModel {
    return {
      displayName: profile.displayName,
      learningStyle: profile.learningStyle,
      weeklyGoalHours: profile.weeklyGoalHours,
      currentLevel: profile.currentLevel,
      goals: profile.goals,
      preferredTopics: profile.preferredTopics,
    };
  }

  createPathViewModel(paths: LearningPathDTO[]): PathViewModel {
    const active = paths.filter((p) => p.status === 'in_progress');
    const completed = paths.filter((p) => p.status === 'completed');
    const currentPath = active[0];
    const nextTopic = currentPath?.topics.find((t) => t.status !== 'completed');
    return {
      activePaths: active.length,
      completedPaths: completed.length,
      recommendedPaths: paths.length - active.length - completed.length,
      totalEstimatedHours: paths.reduce((s, p) => s + p.estimatedHours, 0),
      completedHours: paths.reduce((s, p) => s + p.completedHours, 0),
      progress:
        paths.length > 0
          ? Math.round(
              (paths.reduce((s, p) => {
                const total = p.topics.length;
                const done = p.topics.filter((t) => t.status === 'completed').length;
                return s + (total > 0 ? done / total : 0);
              }, 0) /
                paths.length) *
                100,
            )
          : 0,
      nextTopic: nextTopic?.name ?? 'All topics completed',
      currentPath: currentPath?.title ?? 'No active path',
    };
  }

  createRevisionViewModel(revision: RevisionScheduleDTO): RevisionViewModel {
    const highRisk = revision.dueToday.filter((r) => r.confidence < 50).length;
    return {
      dueToday: revision.dueToday.length,
      dueThisWeek: revision.dueThisWeek.length,
      totalForReview: revision.totalForReview,
      highRiskTopics: highRisk,
      nextRevision: revision.dueToday[0]?.dueDate ?? 'No pending revisions',
    };
  }

  createStreakViewModel(streak: LearningStreakDTO): StreakViewModel {
    const weeklyActive = streak.weeklyActivity.filter((h) => h > 0).length;
    return {
      current: streak.current,
      longest: streak.longest,
      weeklyActiveDays: weeklyActive,
      momentumLabel:
        streak.current >= 7 ? 'On Fire!' : streak.current >= 3 ? 'Building' : 'Getting Started',
      isAtRisk: streak.current === 0,
    };
  }

  createDashboardViewModel(snapshot: LearningSnapshotDTO): LearningDashboardViewModel {
    return {
      profile: this.createProfileViewModel(snapshot.profile),
      paths: this.createPathViewModel(snapshot.paths),
      revision: this.createRevisionViewModel(snapshot.revision),
      streak: this.createStreakViewModel(snapshot.streak),
      knowledgeMap: {
        nodeCount: snapshot.knowledgeMap.nodes.length,
        edgeCount: snapshot.knowledgeMap.edges.length,
        lastUpdated: snapshot.knowledgeMap.lastUpdated,
      },
      goals: snapshot.goals,
      assessments: snapshot.assessments,
      achievements: snapshot.achievements,
      metrics: snapshot.metrics,
      timeline: snapshot.timeline,
      recommendations: snapshot.recommendations,
      notifications: snapshot.notifications,
      quickActions: snapshot.quickActions,
      health: snapshot.health,
      lastRefreshed: snapshot.generatedAt,
    };
  }
}
