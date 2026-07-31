// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section Types
// Shared DTO interfaces matching BLD-015 LifeOSSnapshotDTO certified shape
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react';

// ── Identity ────────────────────────────────────────────────────────────────

export interface IdentitySummary {
  displayName: string;
  email: string;
  role: string;
  purpose: string;
  primaryGoal: string;
  currentJourney: string;
  greeting: string;
  avatarUrl?: string;
}

// ── Module Summary ──────────────────────────────────────────────────────────

export interface ModuleSummary {
  module: string;
  status: 'available' | 'degraded' | 'unavailable';
  summary: string;
  metrics: Record<string, number>;
  lastUpdated: string;
  hasNotifications: boolean;
  notificationCount: number;
}

export type ModuleKey = 'career' | 'learning' | 'business' | 'marketplace';

// ── Decision ────────────────────────────────────────────────────────────────

export interface DecisionSummary {
  pendingDecisions: number;
  decisionsToday: number;
  averageConfidence: number;
  highRiskCount: number;
  topPending: string[];
}

// ── Execution ───────────────────────────────────────────────────────────────

export interface ExecutionSummary {
  activePlans: number;
  blockedPlans: number;
  completedToday: number;
  totalEstimatedMinutes: number;
  recoverySuggestions: string[];
}

// ── Memory ──────────────────────────────────────────────────────────────────

export interface MemorySummary {
  totalMemories: number;
  recentCount: number;
  importantEvents: number;
  lastMemoryDate?: string;
  aiObservations: string[];
  reflectionPrompts: string[];
}

// ── Priority ────────────────────────────────────────────────────────────────

export interface Priority {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: number;
  isBlocked: boolean;
  deadline?: string;
  category: string;
}

// ── Recommendation ──────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: number;
  confidence: number;
  sources: string[];
  reason: string;
  actionLabel: string;
  actionRoute: string;
  isDismissed: boolean;
  category: string;
  createdAt: string;
}

// ── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
  title: string;
  message: string;
  source: string;
  isRead: boolean;
  isActionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
  priority: number;
  createdAt: string;
  expiresAt?: string;
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export interface Metrics {
  lifeScore: number;
  moduleEngagement: Record<string, number>;
  totalNotifications: number;
  unreadNotifications: number;
  totalRecommendations: number;
  activeRecommendations: number;
}

// ── AI Context ──────────────────────────────────────────────────────────────

export interface AIContext {
  currentFocus: string;
  recentActivity: string[];
  suggestedQuestions: string[];
  contextSummary: string;
  topPriorities: string[];
  crossDomainInsights: string[];
}

// ── Full Life OS Snapshot ───────────────────────────────────────────────────

export interface LifeOSSnapshot {
  id: string;
  userId: string;
  generatedAt: string;
  ttl: number;
  identity: IdentitySummary;
  career: ModuleSummary;
  learning: ModuleSummary;
  business: ModuleSummary;
  marketplace: ModuleSummary;
  decisions: DecisionSummary;
  execution: ExecutionSummary;
  memory: MemorySummary;
  priorities: Priority[];
  crossDomainRecommendations: Recommendation[];
  globalNotifications: Notification[];
  metrics: Metrics;
  aiContext: AIContext;
}

// ── Helper Maps ─────────────────────────────────────────────────────────────

export const moduleIconsRecord: Record<string, ReactNode> = {};

export const priorityLabel: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export const priorityColor: Record<number, string> = {
  1: 'text-[#EF4444]',
  2: 'text-[#F59E0B]',
  3: 'text-[#2B5FD9]',
  4: 'text-[#64748B]',
};

export const statusDotColors: Record<string, string> = {
  available: 'bg-[#22C55E]',
  degraded: 'bg-[#F59E0B]',
  unavailable: 'bg-[#EF4444]',
};

export const notifColors: Record<string, { bg: string; text: string; dot: string }> = {
  info: { bg: 'bg-[#EFF6FF]', text: 'text-[#3B82F6]', dot: 'bg-[#3B82F6]' },
  warning: { bg: 'bg-[#FFFBEB]', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]' },
  error: { bg: 'bg-[#FEF2F2]', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]' },
  success: { bg: 'bg-[#F0FDF4]', text: 'text-[#22C55E]', dot: 'bg-[#22C55E]' },
  reminder: { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', dot: 'bg-[#7C3AED]' },
};
