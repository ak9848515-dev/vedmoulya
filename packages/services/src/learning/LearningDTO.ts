// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Intelligence Platform DTOs
// Data Transfer Objects for the Learning Intelligence Platform
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

export interface LearningSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  profile: LearningProfileDTO;
  goals: LearningGoalDTO[];
  missions: LearningMissionDTO[];
  paths: LearningPathDTO[];
  recommendations: LearningRecommendationDTO[];
  knowledgeMap: KnowledgeMapDTO;
  skillProgress: SkillProgressDTO[];
  projects: LearningProjectDTO[];
  assessments: AssessmentDTO[];
  revision: RevisionScheduleDTO;
  streak: LearningStreakDTO;
  retention: RetentionIndicatorDTO[];
  achievements: AchievementDTO[];
  insights: LearningInsightDTO[];
  timeline: LearningTimelineDTO;
  notifications: LearningNotificationDTO[];
  metrics: LearningMetricsDTO;
  health: LearningHealthIndicatorDTO;
  quickActions: QuickActionDTO[];
  aiContext: LearningAIContextDTO;
}

export interface LearningProfileDTO {
  userId: string;
  displayName: string;
  learningStyle: LearningStyle;
  preferredTopics: string[];
  currentLevel: string;
  goals: string[];
  weeklyGoalHours: number;
  averageSessionMinutes: number;
  preferredTimes: string[];
  updatedAt: string;
}

export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'mixed';

export interface LearningGoalDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  targetDate?: string;
  priority: number;
  progress: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
}

export interface LearningPathDTO {
  id: string;
  title: string;
  description: string;
  topics: LearningTopicDTO[];
  estimatedHours: number;
  completedHours: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'not_started' | 'in_progress' | 'completed';
  source: string;
  relevanceScore: number;
  certifications: string[];
}

export interface LearningTopicDTO {
  id: string;
  name: string;
  description: string;
  estimatedMinutes: number;
  completedMinutes: number;
  status: 'pending' | 'in_progress' | 'completed';
  prerequisites: string[];
  resources: LearningResourceDTO[];
  masteryLevel: number;
}

export interface LearningResourceDTO {
  id: string;
  title: string;
  type: 'video' | 'article' | 'book' | 'course' | 'tutorial' | 'documentation';
  url?: string;
  durationMinutes: number;
  completed: boolean;
  provider: string;
  rating: number;
}

export interface KnowledgeMapDTO {
  nodes: KnowledgeNodeDTO[];
  edges: KnowledgeEdgeDTO[];
  lastUpdated: string;
}

export interface KnowledgeNodeDTO {
  id: string;
  name: string;
  category: string;
  masteryLevel: number;
  confidence: number;
  lastReviewed?: string;
  connections: number;
}

export interface KnowledgeEdgeDTO {
  sourceId: string;
  targetId: string;
  relationship: string;
  strength: number;
}

export interface SkillProgressDTO {
  skillName: string;
  category: string;
  currentLevel: number;
  targetLevel: number;
  progress: number;
  lastAssessed?: string;
}

export interface LearningProjectDTO {
  id: string;
  title: string;
  description: string;
  technologies: string[];
  learningGoals: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  completedHours: number;
  status: 'suggested' | 'in_progress' | 'completed';
  outcomes: string[];
}

export interface AssessmentDTO {
  id: string;
  title: string;
  topic: string;
  type: 'quiz' | 'practice' | 'challenge' | 'project_review';
  score?: number;
  maxScore: number;
  questionsAnswered: number;
  totalQuestions: number;
  status: 'pending' | 'in_progress' | 'completed';
  takenAt?: string;
  nextReviewDate?: string;
}

export interface RevisionScheduleDTO {
  dueToday: RevisionItemDTO[];
  dueThisWeek: RevisionItemDTO[];
  upcoming: RevisionItemDTO[];
  totalForReview: number;
}

export interface RevisionItemDTO {
  id: string;
  topic: string;
  title: string;
  dueDate: string;
  importance: number;
  estimatedMinutes: number;
  status: 'pending' | 'completed';
  lastReviewed?: string;
  confidence: number;
}

export interface LearningStreakDTO {
  current: number;
  longest: number;
  weeklyActivity: number[];
  monthlyActiveDays: number;
  lastActiveDate: string;
}

export interface RetentionIndicatorDTO {
  topic: string;
  currentRetention: number;
  targetRetention: number;
  daysSinceReview: number;
  riskLevel: 'low' | 'medium' | 'high';
  nextReviewDue: string;
}

export interface AchievementDTO {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

export interface LearningInsightDTO {
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

export interface LearningRecommendationDTO {
  id: string;
  category: 'topic' | 'path' | 'project' | 'resource' | 'revision' | 'assessment';
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

export interface LearningNotificationDTO {
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

export interface LearningMetricsDTO {
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
  overallProgress: number;
}

export interface LearningHealthIndicatorDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>;
  lastChecked: string;
  warnings: string[];
}

export interface LearningAIContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
}

export interface LearningConfigDTO {
  userId: string;
  weeklyGoalHours: number;
  preferredTimes: string[];
  learningStyle: LearningStyle;
  difficultyPreference: 'beginner' | 'intermediate' | 'advanced';
  enableReminders: boolean;
  revisionReminders: boolean;
  projectSuggestions: boolean;
  assessmentFrequency: 'daily' | 'weekly' | 'monthly';
  preferredTopics: string[];
  notificationPreferences: string[];
}

export interface LearningMissionDTO {
  id: string;
  title: string;
  description: string;
  type: 'skill_building' | 'project' | 'exploration' | 'challenge';
  topics: string[];
  milestones: MissionMilestoneDTO[];
  progress: number;
  status: 'available' | 'active' | 'completed' | 'abandoned';
  rewards: string[];
  startDate?: string;
  completedDate?: string;
  timeEstimateHours: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: string;
}

export interface MissionMilestoneDTO {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface LearningTimelineDTO {
  entries: LearningTimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
}

export interface LearningTimelineEntryDTO {
  id: string;
  type: 'topic' | 'project' | 'assessment' | 'achievement' | 'milestone';
  title: string;
  description: string;
  timestamp: string;
  importance: number;
  icon: string;
  metadata?: Record<string, unknown>;
}

export interface LearningCacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
}
