import type { PlanningLevel } from '@vedmoulya/domain';

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  statusCode?: number;
}

export interface ExecutionExplanation {
  planId: string;
  title: string;
  planningLevel: PlanningLevel;
  status: string;
  progress: { completed: number; total: number };
  priority: { level: string; score: number };
  goalReferences: Array<{ goalId: string; label: string }>;
  decisionReferences: Array<{ decisionId: string; title: string }>;
  tasksCompleted: number;
  tasksTotal: number;
  missionsCompleted: number;
  missionsTotal: number;
  bottlenecks: Array<{ entityId: string; entityType: string; issue: string }>;
  riskFactors: string[];
  recoveryAttempts: number;
}

export interface DailyBrief {
  planId: string;
  date: string;
  focusTasks: Array<{ id: string; label: string; priority: string; estimatedDuration: number }>;
  blockedTasks: Array<{ id: string; label: string; blockedBy: string[] }>;
  completedToday: number;
  totalToday: number;
  suggestedFocus: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  checks: Record<string, 'pass' | 'fail' | 'degraded'>;
  dependencies: Record<string, { status: string; latency: number }>;
}

export interface KnowledgeQuery {
  intent: 'planning' | 'context' | 'goals';
  context: { userId: string; goalIds?: string[]; projectIds?: string[] };
}

export interface KnowledgeResult {
  entityId: string;
  label: string;
  type: string;
  relevance: number;
}

export interface MemoryQuery {
  intent: 'execution_history' | 'lessons_learned' | 'outcomes';
  context: { planId?: string; userId: string };
  limit?: number;
}

export interface AIRequest {
  capability: 'planning' | 'summarization' | 'recovery' | 'briefing' | 'context';
  userInput: string;
  context: Record<string, unknown>;
  qualityTier?: 'premium' | 'standard' | 'economy';
}
