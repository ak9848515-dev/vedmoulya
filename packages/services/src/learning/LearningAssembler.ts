// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Assembler
// Assembles the complete learning snapshot from all modules
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningSnapshotDTO, AchievementDTO } from './LearningDTO.js';
import { LearningDTOMapper } from './LearningDTOMapper.js';
import { LearningProfileService } from './LearningProfileService.js';
import { LearningPathService } from './LearningPathService.js';
import { LearningMissionService } from './LearningMissionService.js';
import { LearningProjectService } from './LearningProjectService.js';
import { LearningAssessmentService } from './LearningAssessmentService.js';
import { LearningRevisionService } from './LearningRevisionService.js';
import { LearningKnowledgeService } from './LearningKnowledgeService.js';
import { LearningProgressService } from './LearningProgressService.js';
import { LearningInsightService } from './LearningInsightService.js';
import { LearningRecommendationService } from './LearningRecommendationService.js';
import { LearningMetricsService } from './LearningMetricsService.js';
import { LearningHealthService } from './LearningHealthService.js';
import { LearningNotificationService } from './LearningNotificationService.js';
import { LearningTimelineService } from './LearningTimelineService.js';
import { LearningConfigurationService } from './LearningConfigurationService.js';

import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';
import type {
  LearningProfileDTO,
  LearningPathDTO,
  LearningStreakDTO,
  RevisionScheduleDTO,
  KnowledgeMapDTO,
  LearningMetricsDTO,
  LearningAIContextDTO,
  QuickActionDTO,
  LearningTimelineEntryDTO,
  AssessmentDTO,
  LearningMissionDTO,
} from './LearningDTO.js';

export interface SafeCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class LearningAssembler {
  private readonly mapper: LearningDTOMapper;
  private readonly profile: LearningProfileService;
  private readonly paths: LearningPathService;
  private readonly missions: LearningMissionService;
  private readonly projects: LearningProjectService;
  private readonly assessments: LearningAssessmentService;
  private readonly revision: LearningRevisionService;
  private readonly knowledge: LearningKnowledgeService;
  private readonly progress: LearningProgressService;
  private readonly insights: LearningInsightService;
  private readonly recommendations: LearningRecommendationService;
  private readonly metrics: LearningMetricsService;
  private readonly health: LearningHealthService;
  private readonly notifications: LearningNotificationService;
  private readonly timeline: LearningTimelineService;
  private readonly config: LearningConfigurationService;

  constructor(
    private readonly identityService: IdentityApplicationService,
    private readonly memoryService: MemoryApplicationService,
    private readonly decisionService: DecisionApplicationService,
    private readonly executionService: ExecutionApplicationService,
    private readonly knowledgeService: KnowledgeApplicationService,
    private readonly aiService: AIOrchestrationService,
  ) {
    this.mapper = new LearningDTOMapper();
    this.profile = new LearningProfileService();
    this.paths = new LearningPathService();
    this.missions = new LearningMissionService();
    this.projects = new LearningProjectService();
    this.assessments = new LearningAssessmentService();
    this.revision = new LearningRevisionService();
    this.knowledge = new LearningKnowledgeService();
    this.progress = new LearningProgressService();
    this.insights = new LearningInsightService();
    this.recommendations = new LearningRecommendationService();
    this.metrics = new LearningMetricsService();
    this.health = new LearningHealthService();
    this.notifications = new LearningNotificationService();
    this.timeline = new LearningTimelineService();
    this.config = new LearningConfigurationService();
  }

  /** Assemble the full learning snapshot for a user */
  async assemble(userId: string, displayName: string): Promise<LearningSnapshotDTO> {
    const startTime = Date.now();

    // ── Gather data from all frozen modules in parallel ──────────────────
    const [identityResult, , , , aiResult] = await Promise.all([
      this.safeCall(() => this.identityService.getUserById(userId)),
      this.safeCall(() => this.memoryService.getStats()),
      this.safeCall(() => this.decisionService.getStats()),
      this.safeCall(() => this.executionService.getStats()),
      this.safeCall(() =>
        this.aiService.orchestrate({
          capability: 'reasoning',
          userInput: `Learning context analysis for user ${userId}`,
          qualityTier: 'standard',
          userId,
          context: {
            systemPrompt: `Learning context for user ${userId}`,
          },
        }),
      ),
    ]);

    // ── Profile ─────────────────────────────────────────────────────────
    const profileDTO = this.resolveProfile(userId, displayName, identityResult);

    // ── Configuration ───────────────────────────────────────────────────
    this.config.getConfig(userId);

    // ── Domain data ─────────────────────────────────────────────────────
    const pathList = this.paths.getPaths(userId);
    const activePaths = this.paths.getActivePaths(userId);
    const recommendedPaths = this.paths.getRecommendedPaths(userId);
    const missionList = this.missions.getMissions(userId);
    const activeMissions = this.missions.getActiveMissions(userId);
    const projectList = this.projects.getProjects(userId);
    const assessmentList = this.assessments.getAssessments(userId);
    const completedAssessments = this.assessments.getCompletedAssessments(userId);
    const pendingAssessments = this.assessments.getPendingAssessments(userId);
    const knowledgeMap = this.knowledge.getMap(userId);
    const streak = this.progress.getStreak(userId);
    const skillProgressList = this.progress.getSkillProgress(userId);

    // ── Derived counters ────────────────────────────────────────────────
    const topicsCompleted = this.countCompletedTopics(pathList);
    const assessmentsPassed = this.countAssessmentsPassed(completedAssessments);
    const projectsCompleted = this.countCompletedProjects(projectList);

    // ── Revision schedule ───────────────────────────────────────────────
    const revisionSchedule = this.revision.buildSchedule([]);
    const retentionIndicators = this.revision.getRetentionIndicators([]);

    // ── Metrics ─────────────────────────────────────────────────────────
    const metricsDTO = this.computeMetrics(
      streak,
      knowledgeMap,
      topicsCompleted,
      assessmentsPassed,
      projectsCompleted,
      retentionIndicators,
    );

    // ── Insights, Recommendations, Notifications ─────────────────────────
    const insightDTOs = this.insights.generateInsights({
      revision: revisionSchedule,
      streak,
      metrics: metricsDTO,
      topicsCompleted,
      assessmentsPassed,
    });
    const recDTOs = this.recommendations.generateRecommendations({
      revision: revisionSchedule,
      streak,
      topicsCompleted,
      assessmentsPassed,
      hasActivePaths: activePaths.length > 0,
    });
    const notifDTOs = this.notifications.generateNotifications({
      revisionDueToday: revisionSchedule.dueToday.length,
      streakAtRisk: streak.current === 0,
      weeklyProgress: metricsDTO.weeklyProgress,
      assessmentsPending: pendingAssessments.length,
    });

    // ── Timeline ────────────────────────────────────────────────────────
    const timelineEntries = this.timeline.buildTimeline(
      this.buildTimelineEntries(pathList, completedAssessments, activeMissions),
    );
    const timelineDTO = this.mapper.toTimeline(timelineEntries);

    // ── Quick Actions ───────────────────────────────────────────────────
    const quickActions = this.buildQuickActions(
      activeMissions,
      recommendedPaths,
      pendingAssessments,
      revisionSchedule,
    );

    // ── Health ──────────────────────────────────────────────────────────
    this.health.reportHealth('learning', 'healthy', Date.now() - startTime);
    const healthDTO = this.health.getHealth();
    const healthIndicator = this.mapper.createHealthIndicator(
      healthDTO.services.map((s) => ({ name: s.name, status: s.status, latency: s.latency })),
    );

    // ── AI Context ──────────────────────────────────────────────────────
    const aiContext = this.buildAIContext(
      profileDTO,
      activePaths,
      revisionSchedule,
      topicsCompleted,
      assessmentsPassed,
      aiResult,
      pathList,
      completedAssessments,
    );

    // ── Achievements ────────────────────────────────────────────────────
    const achievements = this.buildAchievements(
      streak,
      topicsCompleted,
      assessmentsPassed,
      projectsCompleted,
    );

    // ── Snapshot ────────────────────────────────────────────────────────
    const snapshot: LearningSnapshotDTO = {
      id: `lsnap_${userId}_${String(Date.now())}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      profile: profileDTO,
      goals: [],
      missions: missionList,
      paths: pathList,
      recommendations: this.recommendations.prioritizeRecommendations(recDTOs),
      knowledgeMap,
      skillProgress: skillProgressList,
      projects: projectList,
      assessments: assessmentList,
      revision: revisionSchedule,
      streak,
      retention: retentionIndicators,
      achievements,
      insights: insightDTOs,
      timeline: timelineDTO,
      notifications: notifDTOs,
      metrics: metricsDTO,
      health: healthIndicator,
      quickActions,
      aiContext,
    };

    this.health.reportHealth('learning-snapshot', 'healthy', Date.now() - startTime);
    return snapshot;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  /** Resolve user profile: existing, guest, or identity-enriched */
  private resolveProfile(
    userId: string,
    displayName: string,
    identityResult: SafeCallResult<unknown>,
  ): LearningProfileDTO {
    let profileDTO = this.profile.getProfile(userId);
    if (!profileDTO) {
      profileDTO = this.profile.createGuestProfile(userId, displayName);
    }
    if (identityResult.success && identityResult.data) {
      const userDTO = identityResult.data as { displayName?: string; id?: string };
      if (userDTO.displayName) {
        profileDTO = this.profile.updateProfile(userId, { displayName: userDTO.displayName });
      }
    }
    return profileDTO;
  }

  /** Compute learning metrics from all data sources */
  private computeMetrics(
    streak: LearningStreakDTO,
    knowledgeMap: KnowledgeMapDTO,
    topicsCompleted: number,
    assessmentsPassed: number,
    projectsCompleted: number,
    retentionIndicators: { currentRetention: number }[],
  ): LearningMetricsDTO {
    return this.metrics.aggregate({
      knowledgeRetention:
        retentionIndicators.length > 0
          ? Math.round(
              retentionIndicators.reduce((s, r) => s + r.currentRetention, 0) /
                retentionIndicators.length,
            )
          : 80,
      weeklyProgress: 40,
      monthlyProgress: 35,
      streak: streak.current,
      hoursLearnedThisWeek: streak.weeklyActivity.reduce((s, h) => s + h, 0),
      hoursLearnedThisMonth: streak.monthlyActiveDays * 0.5,
      topicsCompleted,
      assessmentsPassed,
      projectsCompleted,
      consistencyScore: this.calcConsistencyScore(streak),
      breadthScore: this.calcBreadthScore(knowledgeMap),
      depthScore: Math.min(100, topicsCompleted * 5 + assessmentsPassed * 10),
    });
  }

  /** Build timeline entry objects from paths, assessments, and missions */
  private buildTimelineEntries(
    pathList: LearningPathDTO[],
    completedAssessments: AssessmentDTO[],
    activeMissions: LearningMissionDTO[],
  ): Array<{
    id: string;
    type: LearningTimelineEntryDTO['type'];
    title: string;
    description: string;
    timestamp: string;
    importance: number;
    icon: string;
  }> {
    return [
      ...pathList.flatMap((p) =>
        p.topics
          .filter((t) => t.status === 'completed')
          .map((t) => ({
            id: t.id,
            type: 'topic' as const,
            title: t.name,
            description: `Completed topic in ${p.title}`,
            timestamp: new Date().toISOString(),
            importance: 5,
            icon: 'book',
          })),
      ),
      ...completedAssessments.map((a) => ({
        id: a.id,
        type: 'assessment' as const,
        title: a.title,
        description: `Score: ${String(a.score ?? 0)}/${String(a.maxScore)}`,
        timestamp: a.takenAt ?? new Date().toISOString(),
        importance: 7,
        icon: 'check-circle',
      })),
      ...activeMissions.map((m) => ({
        id: m.id,
        type: 'milestone' as const,
        title: m.title,
        description: `${String(m.progress)}% complete`,
        timestamp: m.startDate ?? new Date().toISOString(),
        importance: 6,
        icon: 'target',
      })),
    ];
  }

  /** Build quick actions based on current state */
  private buildQuickActions(
    activeMissions: LearningMissionDTO[],
    recommendedPaths: LearningPathDTO[],
    pendingAssessments: AssessmentDTO[],
    revisionSchedule: RevisionScheduleDTO,
  ): QuickActionDTO[] {
    return [
      this.mapper.createQuickAction(
        'continue_mission',
        'Continue Mission',
        this.describeMissions(activeMissions),
        'target',
        '/learning/missions',
        1,
        'mission',
        true,
      ),
      this.mapper.createQuickAction(
        'start_path',
        'Start Learning Path',
        this.describePaths(recommendedPaths),
        'book-open',
        '/learning/paths',
        2,
        'path',
        true,
      ),
      this.mapper.createQuickAction(
        'take_assessment',
        'Take Assessment',
        this.describeAssessments(pendingAssessments),
        'edit-3',
        '/learning/assessments',
        3,
        'assessment',
        pendingAssessments.length > 0,
      ),
      this.mapper.createQuickAction(
        'review_revision',
        'Review Topics',
        `${String(revisionSchedule.dueToday.length)} topics due today`,
        'refresh-cw',
        '/learning/revision',
        4,
        'revision',
        revisionSchedule.dueToday.length > 0,
      ),
      this.mapper.createQuickAction(
        'explore_projects',
        'Explore Projects',
        'Build something to reinforce learning',
        'briefcase',
        '/learning/projects',
        5,
        'project',
        true,
      ),
      this.mapper.createQuickAction(
        'start_mission',
        'Create Mission',
        'Design a focused learning sprint',
        'flag',
        '/learning/missions/create',
        6,
        'mission',
        true,
      ),
    ];
  }

  /** Build AI context from module results and computed data */
  private buildAIContext(
    profileDTO: LearningProfileDTO,
    activePaths: LearningPathDTO[],
    revisionSchedule: RevisionScheduleDTO,
    topicsCompleted: number,
    assessmentsPassed: number,
    aiResult: SafeCallResult<unknown>,
    pathList: LearningPathDTO[],
    completedAssessments: AssessmentDTO[],
  ): LearningAIContextDTO {
    return {
      currentFocus: activePaths[0]?.title ?? 'Exploring learning',
      recentActivity: this.buildRecentActivitySummary(pathList, completedAssessments),
      suggestedQuestions: [
        'What should I learn next based on my goals?',
        `How can I improve my ${revisionSchedule.dueToday.length > 0 ? 'revision schedule' : 'learning path'}?`,
        'What topics am I ready to master?',
      ],
      contextSummary:
        aiResult.success && aiResult.data
          ? `AI analysis available for ${profileDTO.displayName}'s learning journey`
          : `${profileDTO.displayName} has completed ${String(topicsCompleted)} topics and ${String(assessmentsPassed)} assessments.`,
    };
  }

  /** Build achievements from progress milestones */
  private buildAchievements(
    streak: LearningStreakDTO,
    topicsCompleted: number,
    assessmentsPassed: number,
    projectsCompleted: number,
  ): AchievementDTO[] {
    const achievements: AchievementDTO[] = [];
    const now = new Date().toISOString();
    if (streak.current >= 7) {
      achievements.push({
        id: 'ach_streak_7',
        title: 'Week Warrior',
        description: '7-day learning streak',
        icon: 'zap',
        unlockedAt: now,
        category: 'consistency',
        rarity: 'uncommon',
      });
    }
    if (streak.current >= 30) {
      achievements.push({
        id: 'ach_streak_30',
        title: 'Monthly Master',
        description: '30-day learning streak',
        icon: 'award',
        unlockedAt: now,
        category: 'consistency',
        rarity: 'rare',
      });
    }
    if (topicsCompleted >= 10) {
      achievements.push({
        id: 'ach_topics_10',
        title: 'Knowledge Seeker',
        description: 'Completed 10+ topics',
        icon: 'book',
        unlockedAt: now,
        category: 'learning',
        rarity: 'common',
      });
    }
    if (assessmentsPassed >= 5) {
      achievements.push({
        id: 'ach_assess_5',
        title: 'Assessment Ace',
        description: 'Passed 5+ assessments',
        icon: 'check-circle',
        unlockedAt: now,
        category: 'assessment',
        rarity: 'uncommon',
      });
    }
    if (projectsCompleted >= 3) {
      achievements.push({
        id: 'ach_projects_3',
        title: 'Project Builder',
        description: 'Completed 3+ projects',
        icon: 'briefcase',
        unlockedAt: now,
        category: 'project',
        rarity: 'rare',
      });
    }
    return achievements;
  }

  /** Build recent activity summary string for AI context */
  private buildRecentActivitySummary(
    paths: { topics: { status: string }[] }[],
    assessments: { status: string }[],
  ): string[] {
    const activities: string[] = [];
    const done = paths.reduce(
      (s, p) => s + p.topics.filter((t) => t.status === 'completed').length,
      0,
    );
    if (done > 0) activities.push(`Completed ${String(done)} topics`);
    if (assessments.length > 0) activities.push(`${String(assessments.length)} assessments taken`);
    return activities.length > 0 ? activities : ['Profile created'];
  }

  // ── Tiny formatting helpers ────────────────────────────────────────────

  private countCompletedTopics(paths: LearningPathDTO[]): number {
    return paths.reduce(
      (sum, p) => sum + p.topics.filter((t) => t.status === 'completed').length,
      0,
    );
  }

  private countAssessmentsPassed(completed: AssessmentDTO[]): number {
    return completed.filter((a) => (a.score ?? 0) >= a.maxScore * 0.7).length;
  }

  private countCompletedProjects(projects: { status: string }[]): number {
    return projects.filter((p) => p.status === 'completed').length;
  }

  private calcConsistencyScore(streak: LearningStreakDTO): number {
    return streak.longest > 0
      ? Math.min(100, Math.round((streak.current / Math.max(streak.longest, 1)) * 100))
      : 0;
  }

  private calcBreadthScore(knowledgeMap: KnowledgeMapDTO): number {
    return knowledgeMap.nodes.length > 0 ? Math.min(100, knowledgeMap.nodes.length * 10) : 0;
  }

  private describeMissions(activeMissions: LearningMissionDTO[]): string {
    return activeMissions.length > 0
      ? `Resume ${activeMissions[0]?.title ?? 'active mission'}`
      : 'Start a new learning mission';
  }

  private describePaths(recommendedPaths: LearningPathDTO[]): string {
    return recommendedPaths.length > 0
      ? `${String(recommendedPaths.length)} paths recommended`
      : 'Explore learning paths';
  }

  private describeAssessments(pendingAssessments: AssessmentDTO[]): string {
    return pendingAssessments.length > 0
      ? `${String(pendingAssessments.length)} pending`
      : 'Test your knowledge';
  }

  // ── Service Accessors ────────────────────────────────────────────────────

  getProfileService(): LearningProfileService {
    return this.profile;
  }
  getPathService(): LearningPathService {
    return this.paths;
  }
  getMissionService(): LearningMissionService {
    return this.missions;
  }
  getProjectService(): LearningProjectService {
    return this.projects;
  }
  getAssessmentService(): LearningAssessmentService {
    return this.assessments;
  }
  getRevisionService(): LearningRevisionService {
    return this.revision;
  }
  getKnowledgeService(): LearningKnowledgeService {
    return this.knowledge;
  }
  getProgressService(): LearningProgressService {
    return this.progress;
  }
  getInsightService(): LearningInsightService {
    return this.insights;
  }
  getRecommendationService(): LearningRecommendationService {
    return this.recommendations;
  }
  getConfigService(): LearningConfigurationService {
    return this.config;
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<SafeCallResult<T>> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
