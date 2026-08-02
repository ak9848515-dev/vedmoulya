// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Engine Configuration
// Centralized configuration for the Execution Intelligence Engine
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { requireProdExternalUrl } from '@vedmoulya/core';

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  ssl: boolean | 'require';
}

export interface SchedulingConfig {
  maxTasksPerDay: number;
  defaultTaskDuration: number;
  allowParallelTasks: boolean;
}

export interface PlanningConfig {
  defaultPlanningLevel: 'strategic' | 'tactical' | 'operational' | 'daily';
  maxMissionsPerPlan: number;
  maxTasksPerMission: number;
}

export interface RecoveryConfig {
  maxRetries: number;
  baseDelayMs: number;
  autoRecoveryEnabled: boolean;
}

export interface KnowledgeIntegrationConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  retryCount: number;
}

export interface MemoryIntegrationConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  retryCount: number;
}

export interface AIOrchestratorConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  defaultQualityTier: 'premium' | 'standard' | 'economy';
}

export interface ExecutionConfig {
  database: DatabaseConfig;
  scheduling: SchedulingConfig;
  planning: PlanningConfig;
  recovery: RecoveryConfig;
  knowledge: KnowledgeIntegrationConfig;
  memory: MemoryIntegrationConfig;
  aiOrchestrator: AIOrchestratorConfig;
}

/**
 * Load configuration from the environment. Reads env vars on every call so
 * that resetExecutionConfig() re-reads the current environment (tests rely on
 * this via vi.stubEnv).
 */
function loadConfigFromEnv(): ExecutionConfig {
  return {
    database: {
      // Production/staging: EXECUTION_DATABASE_URL must be a real non-localhost URL (PH-001/T2).
      url: requireProdExternalUrl(
        'EXECUTION_DATABASE_URL',
        'postgres://localhost:5432/vedmoulya_execution',
      ),
      poolMax: Number(process.env.EXECUTION_DB_POOL_MAX ?? '10'),
      ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
    },
    scheduling: {
      maxTasksPerDay: Number(process.env.EXECUTION_MAX_TASKS_PER_DAY ?? '10'),
      defaultTaskDuration: Number(process.env.EXECUTION_DEFAULT_TASK_DURATION ?? '30'),
      allowParallelTasks: process.env.EXECUTION_ALLOW_PARALLEL_TASKS !== 'false',
    },
    planning: {
      defaultPlanningLevel: (process.env.EXECUTION_DEFAULT_PLANNING_LEVEL ?? 'operational') as
        'strategic' | 'tactical' | 'operational' | 'daily',
      maxMissionsPerPlan: Number(process.env.EXECUTION_MAX_MISSIONS ?? '10'),
      maxTasksPerMission: Number(process.env.EXECUTION_MAX_TASKS_PER_MISSION ?? '20'),
    },
    recovery: {
      maxRetries: Number(process.env.EXECUTION_MAX_RETRIES ?? '3'),
      baseDelayMs: Number(process.env.EXECUTION_RETRY_DELAY_MS ?? '1000'),
      autoRecoveryEnabled: process.env.EXECUTION_AUTO_RECOVERY !== 'false',
    },
    knowledge: {
      enabled: process.env.EXECUTION_KNOWLEDGE_ENABLED !== 'false',
      baseUrl: process.env.KNOWLEDGE_SERVICE_URL ?? 'http://localhost:4003',
      timeoutMs: Number(process.env.EXECUTION_KNOWLEDGE_TIMEOUT_MS ?? '5000'),
      retryCount: Number(process.env.EXECUTION_KNOWLEDGE_RETRY ?? '2'),
    },
    memory: {
      enabled: process.env.EXECUTION_MEMORY_ENABLED !== 'false',
      baseUrl: process.env.MEMORY_SERVICE_URL ?? 'http://localhost:4004',
      timeoutMs: Number(process.env.EXECUTION_MEMORY_TIMEOUT_MS ?? '5000'),
      retryCount: Number(process.env.EXECUTION_MEMORY_RETRY ?? '2'),
    },
    aiOrchestrator: {
      enabled: process.env.EXECUTION_AI_ENABLED !== 'false',
      baseUrl: process.env.ORCHESTRATOR_SERVICE_URL ?? 'http://localhost:4001',
      timeoutMs: Number(process.env.EXECUTION_AI_TIMEOUT_MS ?? '10000'),
      defaultQualityTier: (process.env.EXECUTION_AI_QUALITY_TIER ?? 'standard') as
        'premium' | 'standard' | 'economy',
    },
  };
}

// Deferred until first access so importing the module never evaluates
// configuration at module scope (keeps `next build` page-data collection
// inert without env vars; fail-fast still runs at first real use).
let currentConfig: ExecutionConfig | null = null;

function getCurrentConfig(): ExecutionConfig {
  if (currentConfig === null) {
    currentConfig = loadConfigFromEnv();
  }
  return currentConfig;
}

export function getExecutionConfig(): ExecutionConfig {
  return { ...getCurrentConfig() };
}

export function updateExecutionConfig(overrides: Partial<ExecutionConfig>): ExecutionConfig {
  const base = getCurrentConfig();
  currentConfig = {
    ...base,
    ...overrides,
    database: { ...base.database, ...overrides.database },
    scheduling: { ...base.scheduling, ...overrides.scheduling },
    planning: { ...base.planning, ...overrides.planning },
    recovery: { ...base.recovery, ...overrides.recovery },
    knowledge: { ...base.knowledge, ...overrides.knowledge },
    memory: { ...base.memory, ...overrides.memory },
    aiOrchestrator: { ...base.aiOrchestrator, ...overrides.aiOrchestrator },
  };
  return getExecutionConfig();
}

export function resetExecutionConfig(): void {
  currentConfig = loadConfigFromEnv();
}
