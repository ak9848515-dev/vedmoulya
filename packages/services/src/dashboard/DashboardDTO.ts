// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard DTOs
// Data Transfer Objects for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

// ── Snapshot DTO ───────────────────────────────────────────────────────────

export interface DashboardSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  identity: IdentityCardDTO;
  focus: FocusCardDTO;
  execution: ExecutionCardDTO;
  decisions: DecisionCardDTO;
  memory: MemoryCardDTO;
  knowledge: KnowledgeCardDTO;
  growth: GrowthSectionDTO;
  journey: JourneyDTO;
  timeline: TimelineDTO;
  insights: InsightDTO[];
  recommendations: RecommendationDTO[];
  notifications: NotificationDTO[];
  quickActions: QuickActionDTO[];
  health: HealthIndicatorDTO;
  metrics: DashboardMetricsDTO;
  aiContext: AICompanionContextDTO;
  widgetStates: Record<string, WidgetStateDTO>;
}

// ── Section DTOs ───────────────────────────────────────────────────────────

export interface DashboardSectionDTO {
  id: string;
  type: string;
  title: string;
  priority: number;
  data: unknown;
  isLoading: boolean;
  error?: string;
  lastRefreshed?: string;
}

export interface IdentityCardDTO {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  purpose: string;
  avatarUrl?: string;
  currentJourney: string;
  primaryGoal: string;
  motivationalInsight: string;
  greeting: GreetingDTO;
}

export interface GreetingDTO {
  text: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  emoji: string;
  personalized: boolean;
}

export interface FocusCardDTO {
  missionId?: string;
  missionLabel: string;
  missionDescription: string;
  completionPercentage: number;
  estimatedTimeMinutes: number;
  nextMilestone?: string;
  isBlocked: boolean;
  blockReason?: string;
  aiRecommendation?: string;
  priority: string;
}

export interface GoalCardDTO {
  goalId: string;
  label: string;
  progress: number;
  status: string;
  targetDate?: string;
  category: string;
}

export interface MissionCardDTO {
  missionId: string;
  label: string;
  progress: number;
  status: string;
  planId: string;
  targetDate?: string;
  taskCount: number;
  completedTaskCount: number;
}

export interface ExecutionCardDTO {
  todayTasks: Array<{
    taskId: string;
    label: string;
    status: string;
    estimatedDuration: number;
    priority: string;
  }>;
  activePlans: number;
  blockedPlans: number;
  completedToday: number;
  upcomingSchedule: Array<{
    taskId: string;
    label: string;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
  recoverySuggestions: string[];
  totalEstimatedMinutes: number;
}

export interface DecisionCardDTO {
  pendingDecisions: number;
  recommendedDecisions: Array<{
    decisionId: string;
    title: string;
    confidence: number;
    priority: string;
  }>;
  averageConfidence: number;
  highRiskDecisions: number;
  lastDecisionDate?: string;
}

export interface MemoryCardDTO {
  recentMemories: Array<{
    memoryId: string;
    summary: string;
    category: string;
    timestamp: string;
    importance: number;
  }>;
  importantEvents: Array<{ memoryId: string; title: string; date: string }>;
  lifeMilestones: Array<{ memoryId: string; title: string; date: string }>;
  aiObservations: string[];
  reflectionPrompts: string[];
  totalMemories: number;
}

export interface KnowledgeCardDTO {
  recentNodes: number;
  totalNodes: number;
  recentEdges: number;
  topCategories: Array<{ category: string; count: number }>;
  lastUpdated?: string;
}

export interface CareerCardDTO {
  currentRole: string;
  careerScore: number;
  skillsGained: number;
  certifications: number;
  nextMilestone?: string;
  opportunities: Array<{ id: string; title: string; relevance: number }>;
}

export interface LearningCardDTO {
  activeCourses: number;
  completedCourses: number;
  totalHours: number;
  recentAchievements: string[];
  recommendedNext: string[];
  learningStreak: number;
}

export interface BusinessCardDTO {
  activeProjects: number;
  completedProjects: number;
  revenue?: number;
  milestones: Array<{ id: string; label: string; status: string }>;
  healthScore: number;
}

export interface MarketplaceCardDTO {
  activeListings: number;
  completedTransactions: number;
  rating: number;
  recentActivity: string[];
}

export interface GrowthSectionDTO {
  learning: LearningCardDTO;
  career: CareerCardDTO;
  knowledge: KnowledgeCardDTO;
  skills: Array<{ name: string; level: number; category: string }>;
  achievements: Array<{ id: string; title: string; date: string; icon: string }>;
}

// ── Journey DTOs ───────────────────────────────────────────────────────────

export interface JourneyDTO {
  today: JourneyDayDTO;
  week: JourneyPeriodDTO;
  month: JourneyPeriodDTO;
  momentum: number;
  consistency: number;
  streak: number;
}

export interface JourneyDayDTO {
  date: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  energyLevel?: number;
  focusScore?: number;
  mood?: string;
  highlights: string[];
  challenges: string[];
}

export interface JourneyPeriodDTO {
  startDate: string;
  endDate: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  completedMissions: number;
  totalMissions: number;
  averageEnergy?: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ── Timeline DTO ───────────────────────────────────────────────────────────

export interface TimelineDTO {
  entries: TimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
}

export interface TimelineEntryDTO {
  id: string;
  type: 'task' | 'mission' | 'decision' | 'memory' | 'learning' | 'achievement';
  title: string;
  description: string;
  timestamp: string;
  importance: number;
  icon: string;
  metadata?: Record<string, unknown>;
}

// ── Insight DTOs ───────────────────────────────────────────────────────────

export interface InsightDTO {
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

// ── Recommendation DTOs ────────────────────────────────────────────────────

export interface RecommendationDTO {
  id: string;
  category:
    'learning' | 'career' | 'business' | 'health' | 'finance' | 'relationships' | 'productivity';
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

export interface NotificationDTO {
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

// ── Health DTOs ────────────────────────────────────────────────────────────

export interface HealthIndicatorDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>;
  lastChecked: string;
  warnings: string[];
}

// ── Metrics DTOs ───────────────────────────────────────────────────────────

export interface DashboardMetricsDTO {
  lifeScore: number;
  goalProgress: number;
  missionProgress: number;
  executionRate: number;
  decisionQuality: number;
  learningHours: number;
  careerGrowth: number;
  consistency: number;
  momentum: number;
  streak: number;
  weeklyCompletion: number;
  monthlyCompletion: number;
}

// ── AI Companion DTO ───────────────────────────────────────────────────────

export interface AICompanionContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
  emotionalState?: string;
  lastInteraction?: string;
}

// ── Widget State DTO ───────────────────────────────────────────────────────

export interface WidgetStateDTO {
  id: string;
  isVisible: boolean;
  isCollapsed: boolean;
  order: number;
  size: 'small' | 'medium' | 'large';
  lastRefreshed?: string;
  refreshInterval: number;
}

// ── Configuration DTOs ─────────────────────────────────────────────────────

export interface DashboardConfigDTO {
  userId: string;
  layout: Array<{ section: string; order: number; size: string }>;
  widgets: Record<string, WidgetStateDTO>;
  theme: 'light' | 'dark' | 'system';
  refreshInterval: number;
  pinnedSections: string[];
  collapsedSections: string[];
  personalization: PersonalizationConfigDTO;
}

export interface PersonalizationConfigDTO {
  greetingStyle: 'formal' | 'casual' | 'motivational';
  showMetrics: boolean;
  showAICompanion: boolean;
  insightFrequency: 'high' | 'medium' | 'low';
  notificationPreferences: string[];
  favoriteSections: string[];
}

// ── Cache DTOs ─────────────────────────────────────────────────────────────

export interface CacheEntryDTO<T = unknown> {
  key: string;
  data: T;
  expiresAt: string;
  createdAt: string;
  hitCount: number;
  size: number;
}

export interface CacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
  oldestEntry?: string;
  newestEntry?: string;
}

// ── Error DTOs ─────────────────────────────────────────────────────────────

export interface DashboardErrorDTO {
  code: string;
  message: string;
  section?: string;
  source?: string;
  retryable: boolean;
  timestamp: string;
}
