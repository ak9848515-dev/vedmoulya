// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Intelligence Platform DTOs
// Data Transfer Objects for the Career Intelligence Platform
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

// ── Snapshot DTO ───────────────────────────────────────────────────────────

export interface CareerSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  profile: CareerProfileDTO;
  skills: SkillInventoryDTO;
  gaps: SkillGapDTO[];
  roadmap: CareerRoadmapDTO;
  resume: ResumeHealthDTO;
  portfolio: PortfolioHealthDTO;
  interview: InterviewReadinessDTO;
  jobs: JobMatchDTO[];
  market: MarketInsightDTO;
  certifications: CertificationDTO[];
  timeline: CareerTimelineDTO;
  insights: CareerInsightDTO[];
  recommendations: CareerRecommendationDTO[];
  notifications: CareerNotificationDTO[];
  quickActions: QuickActionDTO[];
  metrics: CareerMetricsDTO;
  health: CareerHealthIndicatorDTO;
  aiContext: CareerAIContextDTO;
}

// ── Profile DTOs ───────────────────────────────────────────────────────────

export interface CareerProfileDTO {
  userId: string;
  displayName: string;
  email: string;
  currentTitle: string;
  currentCompany?: string;
  industry: string;
  yearsOfExperience: number;
  location?: string;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  careerStage: CareerStage;
  targetRole?: string;
  targetIndustry?: string;
  preferredLocations: string[];
  openToRelocation: boolean;
  openToRemote: boolean;
  employmentType: EmploymentType[];
  socialLinks: SocialLinkDTO[];
  updatedAt: string;
}

export type CareerStage = 'exploring' | 'early' | 'mid' | 'senior' | 'leadership' | 'expert';
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';

export interface SocialLinkDTO {
  platform: string;
  url: string;
  label: string;
}

export interface CareerGoalDTO {
  id: string;
  title: string;
  description: string;
  targetRole: string;
  targetDate?: string;
  priority: number;
  progress: number;
  status: 'active' | 'achieved' | 'paused' | 'abandoned';
  milestones: CareerMilestoneDTO[];
  createdAt: string;
}

export interface CareerMilestoneDTO {
  id: string;
  label: string;
  description: string;
  targetDate?: string;
  completedDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// ── Skills DTOs ────────────────────────────────────────────────────────────

export interface SkillInventoryDTO {
  skills: SkillDTO[];
  totalCount: number;
  lastAssessed: string;
}

export interface SkillDTO {
  id: string;
  name: string;
  category: SkillCategory;
  level: SkillLevel;
  yearsOfExperience: number;
  lastUsed?: string;
  confidence: number;
  certifications: string[];
  projects: string[];
  endorsements: number;
  isVerified: boolean;
  isFavorite: boolean;
  notes?: string;
}

export type SkillCategory =
  | 'technical'
  | 'domain'
  | 'leadership'
  | 'communication'
  | 'analytical'
  | 'creative'
  | 'languages'
  | 'tools'
  | 'methodology'
  | 'soft';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';

export interface SkillGapDTO {
  skillName: string;
  category: SkillCategory;
  currentLevel: SkillLevel;
  requiredLevel: SkillLevel;
  gapSize: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendedResources: LearningResourceDTO[];
  estimatedTimeToClose: number;
  relevanceToGoal: number;
}

export interface LearningResourceDTO {
  id: string;
  title: string;
  type: 'course' | 'book' | 'article' | 'video' | 'mentorship' | 'project' | 'certification';
  provider: string;
  url?: string;
  estimatedHours: number;
  cost: number;
  relevance: number;
  rating: number;
}

// ── Career Roadmap DTOs ────────────────────────────────────────────────────

export interface CareerRoadmapDTO {
  currentStage: string;
  targetStage: string;
  stages: CareerStageDTO[];
  milestones: CareerMilestoneDTO[];
  estimatedTimelineMonths: number;
  progress: number;
  flexibilityScore: number;
  alternativePaths: CareerPathDTO[];
}

export interface CareerStageDTO {
  id: string;
  name: string;
  description: string;
  order: number;
  isCurrent: boolean;
  isCompleted: boolean;
  requiredSkills: string[];
  recommendedSkills: string[];
  averageTenureMonths: number;
  salaryRange?: SalaryRangeDTO;
  transitionDifficulty: 'easy' | 'moderate' | 'difficult' | 'very_difficult';
}

export interface CareerPathDTO {
  id: string;
  title: string;
  description: string;
  stages: string[];
  probability: number;
  estimatedTimelineMonths: number;
}

export interface SalaryRangeDTO {
  min: number;
  max: number;
  median: number;
  currency: string;
  source: string;
}

// ── Resume DTOs ────────────────────────────────────────────────────────────

export interface ResumeHealthDTO {
  completeness: number;
  atsScore: number;
  sections: ResumeSectionDTO[];
  missingSections: string[];
  suggestions: string[];
  keywordDensity: Record<string, number>;
  versionCount: number;
  lastAnalyzed: string;
}

export interface ResumeSectionDTO {
  name: string;
  present: boolean;
  completeness: number;
  wordCount: number;
  suggestions: string[];
}

// ── Portfolio DTOs ─────────────────────────────────────────────────────────

export interface PortfolioHealthDTO {
  completeness: number;
  projectCount: number;
  featuredProjects: PortfolioProjectDTO[];
  technologies: string[];
  hasWebsite: boolean;
  hasGitHub: boolean;
  hasLinkedIn: boolean;
  hasPersonalSite: boolean;
  suggestions: string[];
  lastAnalyzed: string;
}

export interface PortfolioProjectDTO {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  url?: string;
  role: string;
  outcomes: string[];
  dateCompleted?: string;
}

// ── Interview DTOs ─────────────────────────────────────────────────────────

export interface InterviewReadinessDTO {
  overallScore: number;
  behavioralScore: number;
  technicalScore: number;
  systemDesignScore: number;
  questionCategories: InterviewCategoryDTO[];
  weakAreas: string[];
  strongAreas: string[];
  mockInterviewCount: number;
  recommendedPractice: string[];
  lastPracticed?: string;
}

export interface InterviewCategoryDTO {
  name: string;
  score: number;
  questionCount: number;
  sampleQuestions: string[];
  resources: string[];
}

// ── Job Market DTOs ────────────────────────────────────────────────────────

export interface JobMatchDTO {
  id: string;
  title: string;
  company: string;
  location: string;
  fitScore: number;
  skillMatch: number;
  experienceMatch: number;
  growthPotential: number;
  marketDemand: number;
  salaryEstimate?: SalaryRangeDTO;
  postedDate?: string;
  applicationUrl?: string;
  matchedSkills: string[];
  missingSkills: string[];
  relevance: number;
}

export interface MarketInsightDTO {
  industry: string;
  trends: MarketTrendDTO[];
  emergingSkills: string[];
  decliningSkills: string[];
  certificationDemand: CertificationDemandDTO[];
  salaryInsights: SalaryInsightDTO[];
  hiringTrends: HiringTrendDTO[];
  topEmployers: string[];
  lastUpdated: string;
}

export interface MarketTrendDTO {
  name: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  timeframe: 'short' | 'medium' | 'long';
  relevance: number;
}

export interface CertificationDemandDTO {
  name: string;
  provider: string;
  demandLevel: 'high' | 'medium' | 'low';
  averageSalaryImpact: number;
  relevanceToRole: number;
}

export interface SalaryInsightDTO {
  role: string;
  experience: string;
  percentile10: number;
  percentile25: number;
  median: number;
  percentile75: number;
  percentile90: number;
  location: string;
  currency: string;
}

export interface HiringTrendDTO {
  quarter: string;
  hiringVolume: number;
  averageTimeToHire: number;
  remotePercentage: number;
  contractPercentage: number;
}

// ── Certification DTOs ─────────────────────────────────────────────────────

export interface CertificationDTO {
  id: string;
  name: string;
  provider: string;
  status: 'planned' | 'in_progress' | 'completed' | 'expired';
  progress: number;
  obtainedDate?: string;
  expiryDate?: string;
  cost: number;
  estimatedStudyHours: number;
  skills: string[];
  url?: string;
  isVerified: boolean;
}

// ── Timeline DTOs ──────────────────────────────────────────────────────────

export interface CareerTimelineDTO {
  entries: CareerTimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
}

export interface CareerTimelineEntryDTO {
  id: string;
  type:
    | 'experience'
    | 'education'
    | 'project'
    | 'achievement'
    | 'certification'
    | 'milestone'
    | 'skill';
  title: string;
  description: string;
  date: string;
  endDate?: string;
  importance: number;
  icon: string;
  metadata?: Record<string, unknown>;
}

// ── Insight & Recommendation DTOs ──────────────────────────────────────────

export interface CareerInsightDTO {
  id: string;
  type: 'pattern' | 'achievement' | 'warning' | 'prediction' | 'trend';
  title: string;
  description: string;
  severity: 'info' | 'positive' | 'warning' | 'critical';
  source: string;
  timestamp: string;
  actionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
}

export interface CareerRecommendationDTO {
  id: string;
  category:
    | 'learning'
    | 'career'
    | 'skill'
    | 'project'
    | 'networking'
    | 'interview'
    | 'resume'
    | 'certification';
  title: string;
  description: string;
  priority: number;
  confidence: number;
  source: string;
  reason: string;
  actionLabel: string;
  actionRoute: string;
  isDismissed: boolean;
  createdAt: string;
}

// ── Notification DTOs ──────────────────────────────────────────────────────

export interface CareerNotificationDTO {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
  title: string;
  message: string;
  source: string;
  isRead: boolean;
  isActionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
  createdAt: string;
  expiresAt?: string;
}

// ── Quick Action DTOs ──────────────────────────────────────────────────────

export interface QuickActionDTO {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  priority: number;
  category: string;
  isAvailable: boolean;
  disabledReason?: string;
}

// ── Metrics DTOs ───────────────────────────────────────────────────────────

export interface CareerMetricsDTO {
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
  overallProgress: number;
}

// ── Health DTOs ────────────────────────────────────────────────────────────

export interface CareerHealthIndicatorDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>;
  lastChecked: string;
  warnings: string[];
}

// ── AI Context DTO ─────────────────────────────────────────────────────────

export interface CareerAIContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
}

// ── Configuration DTOs ─────────────────────────────────────────────────────

export interface CareerConfigDTO {
  userId: string;
  preferredIndustries: string[];
  jobSearchActive: boolean;
  openToOpportunities: boolean;
  skillAssessmentFrequency: 'weekly' | 'monthly' | 'quarterly';
  resumeAutoAnalyze: boolean;
  interviewPracticeReminders: boolean;
  marketInsightsFrequency: 'daily' | 'weekly' | 'monthly';
  notificationPreferences: string[];
}

// ── Cache DTOs ─────────────────────────────────────────────────────────────

export interface CareerCacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
  oldestEntry?: string;
  newestEntry?: string;
}
