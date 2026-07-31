// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Intelligence Platform DTOs
// Data Transfer Objects for the Business Intelligence Platform
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { QuickActionDTO } from '@vedmoulya/shared';

// ── Snapshot DTO ───────────────────────────────────────────────────────────

export interface BusinessSnapshotDTO {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  profile: BusinessProfileDTO;
  vision: string;
  mission: string;
  goals: BusinessGoalDTO[];
  strategies: BusinessStrategyDTO[];
  projects: BusinessProjectDTO[];
  kpis: BusinessKPIDTO[];
  finance: BusinessFinanceDTO;
  risks: BusinessRiskDTO[];
  opportunities: BusinessOpportunityDTO[];
  execution: BusinessExecutionDTO;
  milestones: BusinessMilestoneDTO[];
  timeline: BusinessTimelineDTO;
  insights: BusinessInsightDTO[];
  recommendations: BusinessRecommendationDTO[];
  notifications: BusinessNotificationDTO[];
  quickActions: QuickActionDTO[];
  metrics: BusinessMetricsDTO;
  health: BusinessHealthIndicatorDTO;
  aiContext: BusinessAIContextDTO;
}

// ── Profile DTOs ───────────────────────────────────────────────────────────

export interface BusinessProfileDTO {
  userId: string;
  businessName: string;
  businessType: BusinessType;
  industry: string;
  stage: BusinessStage;
  foundedDate?: string;
  teamSize: number;
  description: string;
  vision: string;
  mission: string;
  coreValues: string[];
  strengths: string[];
  weaknesses: string[];
  updatedAt: string;
}

export type BusinessType =
  'sole_proprietorship' | 'partnership' | 'llc' | 'corporation' | 'nonprofit' | 'freelance';
export type BusinessStage = 'idea' | 'startup' | 'growth' | 'established' | 'enterprise';

// ── Goals DTOs ─────────────────────────────────────────────────────────────

export interface BusinessGoalDTO {
  id: string;
  title: string;
  description: string;
  category: 'strategic' | 'financial' | 'operational' | 'growth' | 'innovation';
  priority: number;
  progress: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  targetDate?: string;
  completedDate?: string;
  kpis: string[];
  dependencies: string[];
  milestones: BusinessMilestoneDTO[];
  createdAt: string;
}

export interface BusinessMilestoneDTO {
  id: string;
  title: string;
  description: string;
  targetDate?: string;
  completedDate?: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// ── Strategy DTOs ──────────────────────────────────────────────────────────

export interface BusinessStrategyDTO {
  id: string;
  title: string;
  description: string;
  type: 'growth' | 'efficiency' | 'innovation' | 'expansion' | 'partnership' | 'acquisition';
  goals: string[];
  initiatives: string[];
  progress: number;
  status: 'draft' | 'active' | 'completed' | 'paused';
  startDate?: string;
  targetDate?: string;
  riskLevel: 'low' | 'medium' | 'high';
  estimatedInvestment: number;
  expectedROI: number;
}

// ── Project DTOs ───────────────────────────────────────────────────────────

export interface BusinessProjectDTO {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  progress: number;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  owner: string;
  team: string[];
  budget: number;
  spent: number;
  resources: string[];
  risks: string[];
  dependencies: string[];
  deliverables: string[];
}

// ── KPI DTOs ───────────────────────────────────────────────────────────────

export interface BusinessKPIDTO {
  id: string;
  name: string;
  description: string;
  category: 'revenue' | 'cost' | 'profit' | 'growth' | 'operational' | 'customer' | 'quality';
  currentValue: number;
  targetValue: number;
  previousValue?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  lastUpdated: string;
}

// ── Finance DTOs ───────────────────────────────────────────────────────────

export interface BusinessFinanceDTO {
  revenue: FinancialSummaryDTO;
  expenses: FinancialSummaryDTO;
  cashFlow: CashFlowDTO;
  profitability: ProfitabilityDTO;
  currency: string;
  fiscalYear: string;
  lastUpdated: string;
}

export interface FinancialSummaryDTO {
  currentPeriod: number;
  previousPeriod: number;
  budgeted: number;
  variance: number;
  trend: 'up' | 'down' | 'stable';
  items: FinancialItemDTO[];
}

export interface FinancialItemDTO {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  description?: string;
}

export interface CashFlowDTO {
  operating: number;
  investing: number;
  financing: number;
  netCashFlow: number;
  beginningBalance: number;
  endingBalance: number;
}

export interface ProfitabilityDTO {
  grossMargin: number;
  netMargin: number;
  operatingMargin: number;
  ebitda: number;
  revenue: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
}

// ── Risk DTOs ──────────────────────────────────────────────────────────────

export interface BusinessRiskDTO {
  id: string;
  title: string;
  description: string;
  category:
    | 'financial'
    | 'operational'
    | 'market'
    | 'regulatory'
    | 'technology'
    | 'reputation'
    | 'strategic';
  likelihood: RiskLevel;
  impact: RiskLevel;
  riskScore: number;
  status: 'identified' | 'analyzed' | 'mitigated' | 'monitoring' | 'realized';
  mitigationPlan: string;
  contingencyPlan?: string;
  owner: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface RiskHeatMapDTO {
  items: Array<{
    name: string;
    likelihood: number;
    impact: number;
    score: number;
    category: string;
  }>;
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

// ── Opportunity DTOs ───────────────────────────────────────────────────────

export interface BusinessOpportunityDTO {
  id: string;
  title: string;
  description: string;
  type:
    | 'growth'
    | 'market'
    | 'automation'
    | 'investment'
    | 'partnership'
    | 'cost_saving'
    | 'innovation';
  potentialValue: number;
  investmentRequired: number;
  roi: number;
  confidence: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  status: 'identified' | 'evaluating' | 'planned' | 'in_progress' | 'completed' | 'declined';
  dependencies: string[];
  risks: string[];
  createdAt: string;
}

// ── Execution DTOs ─────────────────────────────────────────────────────────

export interface BusinessExecutionDTO {
  currentPriorities: string[];
  delayedWork: string[];
  completedWork: string[];
  blockedItems: string[];
  recommendedActions: string[];
  velocity: number;
  completionRate: number;
  onTrackTasks: number;
  delayedTasks: number;
  completedTasks: number;
}

// ── Timeline DTOs ──────────────────────────────────────────────────────────

export interface BusinessTimelineDTO {
  entries: BusinessTimelineEntryDTO[];
  totalEntries: number;
  hasMore: boolean;
}

export interface BusinessTimelineEntryDTO {
  id: string;
  type: 'milestone' | 'project' | 'achievement' | 'decision' | 'kpi_milestone';
  title: string;
  description: string;
  timestamp: string;
  importance: number;
  icon: string;
  metadata?: Record<string, unknown>;
}

// ── Insight & Recommendation DTOs ──────────────────────────────────────────

export interface BusinessInsightDTO {
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

export interface BusinessRecommendationDTO {
  id: string;
  category:
    'strategic' | 'operational' | 'financial' | 'execution' | 'risk' | 'opportunity' | 'growth';
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

export interface BusinessNotificationDTO {
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

export type { QuickActionDTO };

// ── Metrics DTOs ───────────────────────────────────────────────────────────

export interface BusinessMetricsDTO {
  businessScore: number;
  revenueHealth: number;
  expenseEfficiency: number;
  profitability: number;
  growthRate: number;
  projectSuccessRate: number;
  kpiAchievementRate: number;
  riskExposure: number;
  opportunityValue: number;
  executionVelocity: number;
  goalProgress: number;
  overallProgress: number;
}

// ── Health DTOs ────────────────────────────────────────────────────────────

export interface BusinessHealthIndicatorDTO {
  overall: 'healthy' | 'degraded' | 'critical';
  services: Array<{ name: string; status: 'healthy' | 'degraded' | 'down'; latency: number }>;
  lastChecked: string;
  warnings: string[];
}

// ── AI Context DTO ─────────────────────────────────────────────────────────

export interface BusinessAIContextDTO {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
}

// ── Configuration DTOs ─────────────────────────────────────────────────────

export interface BusinessConfigDTO {
  userId: string;
  businessName: string;
  fiscalYearStart: string;
  currency: string;
  kpiUpdateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  riskReviewFrequency: 'weekly' | 'monthly' | 'quarterly';
  enableNotifications: boolean;
  enableRiskAlerts: boolean;
  enableOpportunityAlerts: boolean;
  reportingPeriod: 'monthly' | 'quarterly' | 'yearly';
  notificationPreferences: string[];
}

// ── Cache DTOs ─────────────────────────────────────────────────────────────

export interface BusinessCacheMetricsDTO {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  memoryUsage: number;
}
