export const PLANNING_LEVELS = ['strategic', 'tactical', 'operational', 'daily'] as const;

export const EXECUTION_STATUS_VALUES = [
  'pending',
  'ready',
  'in_progress',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'blocked',
  'skipped',
] as const;

export const PRIORITY_LEVELS = ['critical', 'high', 'medium', 'low', 'optional'] as const;

export const RESULT_VALUES = ['success', 'partial', 'failed', 'skipped', 'unknown'] as const;

export const DEPENDENCY_TYPES = [
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
  'start_to_finish',
] as const;

export const STRATEGY_TYPES = [
  'linear',
  'parallel',
  'waterfall',
  'agile',
  'hybrid',
  'opportunistic',
] as const;

export const POLICY_DOMAINS = [
  'execution',
  'recovery',
  'quality',
  'consistency',
  'adaptation',
] as const;

export const POLICY_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export const EXECUTION_EVENT_TYPES = [
  'plan.created',
  'plan.activated',
  'plan.started',
  'plan.status_changed',
  'plan.paused',
  'plan.resumed',
  'plan.completed',
  'plan.failed',
  'plan.cancelled',
  'plan.mission_added',
  'plan.task_added',
  'plan.task_completed',
  'plan.decision_linked',
  'plan.progress_updated',
  'plan.priority_rebalanced',
  'plan.recovery_initiated',
  'plan.escalated',
  'mission.created',
  'mission.started',
  'mission.completed',
  'task.created',
  'task.started',
  'task.completed',
  'task.skipped',
] as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const ID_PREFIX = {
  PLAN: 'plan_',
  MISSION: 'mis_',
  TASK: 'task_',
  STEP: 'step_',
} as const;

export const CACHE_PREFIX = {
  PLAN: 'exec:plan:',
  PLANS: 'exec:plans:',
  SCHEDULE: 'exec:schedule:',
  STATS: 'exec:stats:',
} as const;

export const API_PATHS = {
  BASE: '/api/v1/execution',
  PLANS: '/plans',
  HEALTH: '/health',
} as const;

export const EXTERNAL_API_PATHS = {
  KNOWLEDGE: {
    SEARCH: '/api/v1/knowledge/search',
    CONTEXT: '/api/v1/knowledge/context',
  },
  MEMORY: {
    CAPTURE: '/api/v1/memory/capture',
    QUERY: '/api/v1/memory/query',
  },
  ORCHESTRATOR: {
    CAPABILITY: '/api/v1/orchestrator/capability',
  },
  DECISION: {
    GET: '/api/v1/decision/decisions',
  },
} as const;
