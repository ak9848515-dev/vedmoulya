// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Application DTOs
// Data Transfer Objects for the Execution Intelligence Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

// ── Command DTOs ─────────────────────────────────────────────────────────

export interface CreatePlanDTO {
  title: string;
  description: string;
  planningLevel?: string;
  priorityScore?: number;
  goalReferences?: Array<{ goalId: string; label: string; description: string }>;
  decisionReferences?: Array<{ decisionId: string; title: string; selectedOption: string }>;
  knowledgeNodeIds?: string[];
  memoryIds?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdatePlanDTO {
  title?: string;
  description?: string;
  priorityScore?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateMissionDTO {
  label: string;
  description: string;
  priorityScore?: number;
  tags?: string[];
  planId: string;
  targetDate?: string;
}

export interface CreateTaskDTO {
  label: string;
  description: string;
  priorityScore?: number;
  estimatedDuration?: number;
  missionId?: string;
  planId: string;
  tags?: string[];
}

export interface AddStepDTO {
  label: string;
  description: string;
  estimatedDuration?: number;
  order?: number;
}

export interface CompleteTaskDTO {
  result: 'success' | 'partial' | 'failed' | 'skipped' | 'unknown';
  description: string;
  actualDuration?: number;
  quality?: number;
  notes?: string[];
}

export interface ReportExecutionDTO {
  taskId: string;
  result: 'success' | 'partial' | 'failed' | 'skipped' | 'unknown';
  description: string;
  actualDuration?: number;
  quality?: number;
  energyLevel?: number;
  notes?: string[];
  obstacles?: string[];
}

export interface AdaptPlanDTO {
  trigger: string;
  impact: string;
  preferredApproach?: string;
}

export interface ScheduleTasksDTO {
  taskPlanId: string;
  scheduledDate: string;
  timeBlock?: string;
}

// ── Query DTOs ───────────────────────────────────────────────────────────

export interface ExecutionQueryDTO {
  query?: string;
  planningLevels?: string[];
  statuses?: string[];
  priorityMin?: number;
  priorityMax?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  goalId?: string;
  decisionId?: string;
  page?: number;
  limit?: number;
}

// ── Response DTOs ─────────────────────────────────────────────────────────

export interface PlanDTO {
  id: string;
  title: string;
  description: string;
  planningLevel: string;
  status: string;
  priority: { level: string; score: number };
  progress: { completed: number; total: number; percentage: number };
  missions: MissionDTO[];
  tasks: TaskDTO[];
  timeline: { entryCount: number; lastEvent?: string };
  context: { energyLevel?: number; timeAvailable?: number; location?: string };
  goalReferences: Array<{ goalId: string; label: string }>;
  decisionReferences: Array<{ decisionId: string; title: string }>;
  knowledgeNodeIds: string[];
  memoryIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface MissionDTO {
  id: string;
  label: string;
  description: string;
  status: string;
  priority: { level: string; score: number };
  progress: { completed: number; total: number; percentage: number };
  tasks: TaskDTO[];
  planId: string;
  targetDate?: string;
  tags: string[];
}

export interface TaskDTO {
  id: string;
  label: string;
  description: string;
  status: string;
  priority: { level: string; score: number };
  estimatedDuration: number;
  progress: { completed: number; total: number; percentage: number };
  missionId?: string;
  planId?: string;
  steps: StepDTO[];
  tags: string[];
  schedule?: { scheduledStart: string; scheduledEnd: string; estimatedDuration: number };
  context?: { energyLevel?: number; timeAvailable?: number; location?: string };
}

export interface StepDTO {
  id: string;
  label: string;
  description: string;
  status: string;
  estimatedDuration: number;
  order: number;
}

export interface PlanListDTO {
  data: PlanDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DailyPlanDTO {
  planId: string;
  date: string;
  tasks: Array<{
    taskId: string;
    label: string;
    estimatedDuration: number;
    priority: string;
    missionLabel?: string;
  }>;
  totalEstimatedMinutes: number;
  priority: string;
}

export interface WeeklyReviewDTO {
  planId: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  bottlenecks: Array<{ entityId: string; entityType: string; issue: string }>;
  recommendations: string[];
  weekStart: string;
  weekEnd: string;
}

export interface MonthlyReviewDTO extends WeeklyReviewDTO {
  completedMissions: number;
  totalMissions: number;
  timeVariance: number;
  streak: number;
}

export interface ExecutionStatsDTO {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  overduePlans: number;
  completionRate: number;
}

export interface BottleneckDTO {
  entityId: string;
  entityType: string;
  issue: string;
}

export interface DependencyGraphDTO {
  tasks: Array<{ taskId: string; label: string; status: string; dependencies: string[] }>;
}
