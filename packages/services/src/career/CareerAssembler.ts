// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Assembler
// Assembles the complete career snapshot from all modules
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerSnapshotDTO } from './CareerDTO.js';
import { CareerDTOMapper } from './CareerDTOMapper.js';
import { CareerProfileService } from './CareerProfileService.js';
import { CareerSkillsService } from './CareerSkillsService.js';
import { CareerGapAnalysisService } from './CareerGapAnalysisService.js';
import { CareerRoadmapService } from './CareerRoadmapService.js';
import { CareerResumeService } from './CareerResumeService.js';
import { CareerPortfolioService } from './CareerPortfolioService.js';
import { CareerInterviewService } from './CareerInterviewService.js';
import { CareerJobMatchingService } from './CareerJobMatchingService.js';
import { CareerMarketInsightService } from './CareerMarketInsightService.js';
import { CareerCertificationService } from './CareerCertificationService.js';
import { CareerRecommendationService } from './CareerRecommendationService.js';
import { CareerInsightService } from './CareerInsightService.js';
import { CareerMetricsService } from './CareerMetricsService.js';
import { CareerHealthService } from './CareerHealthService.js';
import { CareerNotificationService } from './CareerNotificationService.js';
import { CareerTimelineService } from './CareerTimelineService.js';
import { CareerConfigurationService } from './CareerConfigurationService.js';
import type { IdentityApplicationService } from '../identity/IdentityApplicationService.js';
import type { MemoryApplicationService } from '../memory/MemoryApplicationService.js';
import type { DecisionApplicationService } from '../decision/DecisionApplicationService.js';
import type { ExecutionApplicationService } from '../execution/ExecutionApplicationService.js';
import type { KnowledgeApplicationService } from '../knowledge/KnowledgeApplicationService.js';
import type { AIOrchestrationService } from '../ai/AIOrchestrationService.js';

export class CareerAssembler {
  private readonly mapper: CareerDTOMapper;
  private readonly profile: CareerProfileService;
  private readonly skillsService: CareerSkillsService;
  private readonly gaps: CareerGapAnalysisService;
  private readonly roadmap: CareerRoadmapService;
  private readonly resume: CareerResumeService;
  private readonly portfolio: CareerPortfolioService;
  private readonly interview: CareerInterviewService;
  private readonly jobMatching: CareerJobMatchingService;
  private readonly market: CareerMarketInsightService;
  private readonly certs: CareerCertificationService;
  private readonly recommendations: CareerRecommendationService;
  private readonly careerInsights: CareerInsightService;
  private readonly metrics: CareerMetricsService;
  private readonly health: CareerHealthService;
  private readonly notifications: CareerNotificationService;
  private readonly timeline: CareerTimelineService;
  private readonly config: CareerConfigurationService;

  constructor(
    private readonly identityService: IdentityApplicationService,
    private readonly memoryService: MemoryApplicationService,
    private readonly decisionService: DecisionApplicationService,
    private readonly executionService: ExecutionApplicationService,
    private readonly knowledgeService: KnowledgeApplicationService,
    private readonly aiService: AIOrchestrationService,
  ) {
    this.mapper = new CareerDTOMapper();
    this.profile = new CareerProfileService();
    this.skillsService = new CareerSkillsService();
    this.gaps = new CareerGapAnalysisService();
    this.roadmap = new CareerRoadmapService();
    this.resume = new CareerResumeService();
    this.portfolio = new CareerPortfolioService();
    this.interview = new CareerInterviewService();
    this.jobMatching = new CareerJobMatchingService();
    this.market = new CareerMarketInsightService();
    this.certs = new CareerCertificationService();
    this.recommendations = new CareerRecommendationService();
    this.careerInsights = new CareerInsightService();
    this.metrics = new CareerMetricsService();
    this.health = new CareerHealthService();
    this.notifications = new CareerNotificationService();
    this.timeline = new CareerTimelineService();
    this.config = new CareerConfigurationService();
  }

  /** Assemble the full career snapshot for a user */
  async assemble(userId: string, displayName: string): Promise<CareerSnapshotDTO> {
    const startTime = Date.now();

    // Gather data from all frozen modules in parallel
    const [identityResult, , decisionResult, executionResult, aiResult] = await Promise.all([
      this.safeCall(() => this.identityService.getUserById(userId)),
      this.safeCall(() => this.memoryService.getStats()),
      this.safeCall(() => this.decisionService.getStats()),
      this.safeCall(() => this.executionService.getStats()),
      this.safeCall(() =>
        this.aiService.orchestrate({
          capability: 'reasoning',
          userInput: `Career context analysis for user ${userId}`,
          qualityTier: 'standard',
          userId,
          context: {
            systemPrompt: `Career context for user ${userId}`,
          },
        }),
      ),
    ]);

    const userDTO = identityResult.data;
    const decisionStats = decisionResult.data;
    const executionStats = executionResult.data;

    // Get or create profile
    let profileDTO = this.profile.getProfile(userId);
    if (!profileDTO) {
      profileDTO = this.profile.createGuestProfile(userId, displayName);
    }
    if (userDTO) {
      profileDTO = this.profile.updateProfile(userId, {
        displayName: userDTO.displayName,
        email: userDTO.email,
      });
    }

    // Get skills and gaps
    const userSkills = this.skillsService.getSkills(userId);
    const requiredSkills = this.getRequiredSkillsForStage(
      profileDTO.careerStage,
      profileDTO.targetRole,
    );
    const gapResults = this.gaps.analyzeGaps(userSkills, requiredSkills);

    // Build roadmap
    const milestones = [
      {
        id: 'm1',
        label: 'Complete Skill Assessment',
        description: '',
        status: userSkills.length > 0 ? ('completed' as const) : ('pending' as const),
      },
      {
        id: 'm2',
        label: 'Close Critical Skill Gaps',
        description: '',
        status:
          gapResults.filter((g) => g.priority === 'critical').length === 0
            ? ('completed' as const)
            : ('in_progress' as const),
      },
      { id: 'm3', label: 'Optimize Resume', description: '', status: 'pending' as const },
      { id: 'm4', label: 'Reach Target Role', description: '', status: 'pending' as const },
    ];
    const roadmapDTO = this.roadmap.buildRoadmap(
      profileDTO.careerStage,
      profileDTO.targetRole ?? 'senior',
      milestones,
    );

    // Resume analysis
    const resumeDTO = this.resume.analyzeResume([]);

    // Portfolio analysis
    const portfolioDTO = this.portfolio.analyzePortfolio([], false, false, false, false);

    // Interview readiness
    const interviewCategories = this.interview.getDefaultCategories();
    const interviewDTO = this.interview.assessReadiness(50, 40, 30, 0, interviewCategories);

    // Job matching with module data context
    const mockJobs = this.getMockJobs();
    const jobSkillNames = userSkills.map((s) => s.name);
    const jobMatches = this.jobMatching.matchJobs(
      mockJobs,
      jobSkillNames,
      profileDTO.yearsOfExperience,
      profileDTO.currentTitle,
    );

    // Market insights
    const marketDTO = this.market.getMarketInsights(profileDTO.industry);

    // Certifications
    const certList = this.certs.getCertifications(userId);

    // Build timeline using all module data
    const timelineDTO = this.mapper.toTimeline(
      this.timeline.buildTimeline([
        {
          id: 'exp_1',
          title: profileDTO.currentTitle,
          description: profileDTO.summary || 'Current position',
          startDate: profileDTO.updatedAt,
        },
        ...(decisionStats && decisionStats.data
          ? [
              {
                id: 'dec_stats',
                title: `${String((decisionStats.data as { total?: number }).total ?? 0)} decisions analyzed`,
                description: 'Decision intelligence activity',
                startDate: new Date().toISOString(),
              },
            ]
          : []),
        ...(executionStats && executionStats.data
          ? [
              {
                id: 'exec_stats',
                title: `Execution progress tracked`,
                description: `From execution intelligence module`,
                startDate: new Date().toISOString(),
              },
            ]
          : []),
      ]),
    );

    // Calculate metrics
    const metricsDTO = this.metrics.aggregate({
      skillProficiency: this.skillsService.getTopSkills(userId).length > 0 ? 60 : 0,
      experienceRelevance: Math.min(100, profileDTO.yearsOfExperience * 10),
      interviewReadiness: interviewDTO.overallScore,
      resumeQuality: resumeDTO.completeness,
      marketFit:
        jobMatches.length > 0
          ? Math.round(jobMatches.reduce((s, j) => s + j.fitScore, 0) / jobMatches.length)
          : 0,
      certificationProgress: this.certs.calculateCertificationProgress(certList),
      networkingScore: profileDTO.strengths.length > 0 ? 50 : 0,
      learningHoursThisMonth: 0,
      applicationsThisMonth: 0,
      interviewConversionRate: 0,
      skillGrowthRate: this.metrics.calculateSkillGrowthRate(userSkills),
      jobMatchCount: jobMatches.length,
    });

    // Generate insights
    const insightDTOs = this.careerInsights.generateInsights({
      gaps: gapResults,
      interview: interviewDTO,
      resume: resumeDTO,
      metrics: metricsDTO,
      jobMatches,
      skillCount: userSkills.length,
    });

    // Generate recommendations
    const recDTOs = this.recommendations.generateRecommendations({
      gaps: gapResults,
      interview: interviewDTO,
      resume: resumeDTO,
      hasPortfolio: portfolioDTO.projectCount > 0,
      certProgress: this.certs.calculateCertificationProgress(certList),
      applicationsActive: false,
    });

    // Generate notifications
    const notifDTOs = this.notifications.generateNotifications({
      missingSkills: gapResults.length,
      interviewScore: interviewDTO.overallScore,
      resumeScore: resumeDTO.atsScore,
      jobMatches: jobMatches.length,
      applicationsOpen: false,
      certsExpiring: this.certs.getExpiringCertifications(userId).map((c) => c.name),
    });

    // Build quick actions
    const quickActions = this.buildQuickActions(profileDTO, gapResults.length);

    // Build health indicator
    this.health.reportHealth('career', 'healthy', Date.now() - startTime);
    const healthDto = this.health.getHealth();
    const healthIndicator = this.mapper.createHealthIndicator(
      healthDto.services.map((s) => ({ name: s.name, status: s.status, latency: s.latency })),
    );

    // Build AI context using actual AI service response
    const aiContext = {
      currentFocus: profileDTO.targetRole ?? 'Exploring careers',
      recentActivity: ['Profile updated', 'Skills assessed'],
      suggestedQuestions: [
        `What skills should I learn for ${profileDTO.targetRole ?? 'my next role'}?`,
        'How can I improve my resume?',
        'What jobs match my current skills?',
      ],
      contextSummary:
        aiResult.success && aiResult.data
          ? `AI analysis available for ${profileDTO.displayName}`
          : `${profileDTO.displayName} is a ${profileDTO.currentTitle} in ${profileDTO.industry} with ${String(profileDTO.yearsOfExperience)} years of experience.`,
    };

    // Build snapshot
    const snapshot: CareerSnapshotDTO = {
      id: `csnap_${userId}_${String(Date.now())}`,
      userId,
      generatedAt: new Date().toISOString(),
      ttl: 300_000,
      profile: profileDTO,
      skills: this.mapper.toSkillInventory(userSkills),
      gaps: this.mapper.toGapResults(gapResults),
      roadmap: roadmapDTO,
      resume: resumeDTO,
      portfolio: portfolioDTO,
      interview: interviewDTO,
      jobs: this.mapper.toJobMatches(jobMatches),
      market: marketDTO,
      certifications: this.mapper.toCertifications(certList),
      timeline: timelineDTO,
      insights: insightDTOs,
      recommendations: this.recommendations.prioritizeRecommendations(recDTOs),
      notifications: notifDTOs,
      quickActions,
      metrics: metricsDTO,
      health: healthIndicator,
      aiContext,
    };

    this.health.reportHealth('career-snapshot', 'healthy', Date.now() - startTime);
    return snapshot;
  }

  getProfileService(): CareerProfileService {
    return this.profile;
  }
  getSkillsService(): CareerSkillsService {
    return this.skillsService;
  }
  getGapService(): CareerGapAnalysisService {
    return this.gaps;
  }
  getRoadmapService(): CareerRoadmapService {
    return this.roadmap;
  }
  getResumeService(): CareerResumeService {
    return this.resume;
  }
  getPortfolioService(): CareerPortfolioService {
    return this.portfolio;
  }
  getInterviewService(): CareerInterviewService {
    return this.interview;
  }
  getJobMatchingService(): CareerJobMatchingService {
    return this.jobMatching;
  }
  getMarketService(): CareerMarketInsightService {
    return this.market;
  }
  getCertService(): CareerCertificationService {
    return this.certs;
  }
  getRecommendationService(): CareerRecommendationService {
    return this.recommendations;
  }
  getInsightService(): CareerInsightService {
    return this.careerInsights;
  }

  private buildQuickActions(
    profile: { targetRole?: string; currentTitle: string },
    gapCount: number,
  ): Array<{
    id: string;
    label: string;
    description: string;
    icon: string;
    route: string;
    priority: number;
    category: string;
    isAvailable: boolean;
    disabledReason?: string;
  }> {
    const actions = [
      {
        id: 'update_resume',
        label: 'Update Resume',
        description: 'Analyze and improve your resume',
        icon: 'file-text',
        route: '/career/resume',
        priority: 1,
        category: 'resume',
        isAvailable: true,
      },
      {
        id: 'analyze_resume',
        label: 'Analyze Resume',
        description: 'Get ATS score and suggestions',
        icon: 'search',
        route: '/career/resume/analyze',
        priority: 2,
        category: 'resume',
        isAvailable: true,
      },
      {
        id: 'practice_interview',
        label: 'Practice Interview',
        description: 'Prepare for upcoming interviews',
        icon: 'mic',
        route: '/career/interview',
        priority: 3,
        category: 'interview',
        isAvailable: true,
      },
      {
        id: 'start_learning',
        label: 'Start Learning',
        description: gapCount > 0 ? `Close ${String(gapCount)} skill gaps` : 'Explore new skills',
        icon: 'book-open',
        route: '/career/learning',
        priority: 4,
        category: 'learning',
        isAvailable: true,
      },
      {
        id: 'view_roadmap',
        label: 'View Roadmap',
        description: 'See your career progression path',
        icon: 'map',
        route: '/career/roadmap',
        priority: 5,
        category: 'career',
        isAvailable: true,
      },
      {
        id: 'search_jobs',
        label: 'Search Jobs',
        description: 'Find jobs matching your profile',
        icon: 'briefcase',
        route: '/career/jobs',
        priority: 6,
        category: 'jobs',
        isAvailable: true,
      },
      {
        id: 'add_certification',
        label: 'Add Certification',
        description: "Track a certification you're pursuing",
        icon: 'award',
        route: '/career/certifications',
        priority: 7,
        category: 'certification',
        isAvailable: true,
      },
      {
        id: 'update_skills',
        label: 'Update Skills',
        description: 'Add or update your skills inventory',
        icon: 'zap',
        route: '/career/skills',
        priority: 8,
        category: 'skills',
        isAvailable: true,
      },
    ];
    return actions;
  }

  private getRequiredSkillsForStage(
    stage: string,
    _targetRole?: string,
  ): Array<{
    name: string;
    category: import('./CareerDTO.js').SkillCategory;
    requiredLevel: import('./CareerDTO.js').SkillLevel;
  }> {
    const core = [
      {
        name: 'Communication',
        category: 'communication' as const,
        requiredLevel: 'intermediate' as const,
      },
      {
        name: 'Problem Solving',
        category: 'analytical' as const,
        requiredLevel: 'intermediate' as const,
      },
    ];
    if (stage === 'exploring' || stage === 'early') return core;
    if (stage === 'mid')
      return [
        ...core,
        {
          name: 'Project Management',
          category: 'methodology' as const,
          requiredLevel: 'intermediate' as const,
        },
      ];
    if (stage === 'senior')
      return [
        ...core,
        { name: 'Leadership', category: 'leadership' as const, requiredLevel: 'advanced' as const },
        {
          name: 'Strategic Thinking',
          category: 'analytical' as const,
          requiredLevel: 'advanced' as const,
        },
      ];
    return core;
  }

  private getMockJobs(): Array<{
    id: string;
    title: string;
    company: string;
    location: string;
    requiredSkills: string[];
    preferredSkills: string[];
    minExperience: number;
    salaryRange?: { min: number; max: number; median: number; currency: string };
    postedDate: string;
    applicationUrl?: string;
  }> {
    return [
      {
        id: 'job_1',
        title: 'Software Engineer',
        company: 'TechCorp',
        location: 'San Francisco, CA',
        requiredSkills: ['JavaScript', 'TypeScript', 'React'],
        preferredSkills: ['Node.js', 'AWS', 'Docker'],
        minExperience: 2,
        salaryRange: { min: 100000, max: 160000, median: 130000, currency: 'USD' },
        postedDate: new Date().toISOString(),
        applicationUrl: '/apply/1',
      },
      {
        id: 'job_2',
        title: 'Senior Developer',
        company: 'InnovateCo',
        location: 'Remote',
        requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        preferredSkills: ['AWS', 'System Design', 'Mentoring'],
        minExperience: 4,
        salaryRange: { min: 140000, max: 200000, median: 170000, currency: 'USD' },
        postedDate: new Date().toISOString(),
        applicationUrl: '/apply/2',
      },
      {
        id: 'job_3',
        title: 'Frontend Lead',
        company: 'StartupXYZ',
        location: 'New York, NY',
        requiredSkills: ['React', 'TypeScript', 'CSS'],
        preferredSkills: ['Design Systems', 'Performance', 'Testing'],
        minExperience: 3,
        salaryRange: { min: 120000, max: 180000, median: 150000, currency: 'USD' },
        postedDate: new Date().toISOString(),
        applicationUrl: '/apply/3',
      },
    ];
  }

  private async safeCall<T>(
    fn: () => Promise<T>,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const data = await fn();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[CareerAssembler] Module call failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
