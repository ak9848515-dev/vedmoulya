// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Config unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import {
  getExecutionConfig,
  updateExecutionConfig,
  resetExecutionConfig,
} from '../ExecutionConfig.js';

describe('ExecutionConfig', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    resetExecutionConfig();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetExecutionConfig();
  });

  it('loads defaults from the environment', () => {
    const config = getExecutionConfig();
    expect(config.database.poolMax).toBe(10);
    expect(config.scheduling.maxTasksPerDay).toBe(10);
    expect(config.scheduling.defaultTaskDuration).toBe(30);
    expect(config.scheduling.allowParallelTasks).toBe(true);
    expect(config.planning.defaultPlanningLevel).toBe('operational');
    expect(config.planning.maxMissionsPerPlan).toBe(10);
    expect(config.planning.maxTasksPerMission).toBe(20);
    expect(config.recovery.maxRetries).toBe(3);
    expect(config.recovery.baseDelayMs).toBe(1000);
    expect(config.recovery.autoRecoveryEnabled).toBe(true);
    expect(config.knowledge.enabled).toBe(true);
    expect(config.knowledge.baseUrl).toBe('http://localhost:4003');
    expect(config.knowledge.timeoutMs).toBe(5000);
    expect(config.knowledge.retryCount).toBe(2);
    expect(config.memory.enabled).toBe(true);
    expect(config.memory.baseUrl).toBe('http://localhost:4004');
    expect(config.aiOrchestrator.enabled).toBe(true);
    expect(config.aiOrchestrator.baseUrl).toBe('http://localhost:4001');
    expect(config.aiOrchestrator.timeoutMs).toBe(10000);
    expect(config.aiOrchestrator.defaultQualityTier).toBe('standard');
  });

  it('reads custom values from the environment', () => {
    vi.stubEnv('EXECUTION_DB_POOL_MAX', '25');
    vi.stubEnv('EXECUTION_MAX_TASKS_PER_DAY', '15');
    vi.stubEnv('EXECUTION_DEFAULT_TASK_DURATION', '45');
    vi.stubEnv('EXECUTION_ALLOW_PARALLEL_TASKS', 'false');
    vi.stubEnv('EXECUTION_DEFAULT_PLANNING_LEVEL', 'strategic');
    vi.stubEnv('EXECUTION_MAX_MISSIONS', '5');
    vi.stubEnv('EXECUTION_MAX_TASKS_PER_MISSION', '30');
    vi.stubEnv('EXECUTION_MAX_RETRIES', '7');
    vi.stubEnv('EXECUTION_RETRY_DELAY_MS', '500');
    vi.stubEnv('EXECUTION_AUTO_RECOVERY', 'false');
    vi.stubEnv('EXECUTION_KNOWLEDGE_ENABLED', 'false');
    vi.stubEnv('KNOWLEDGE_SERVICE_URL', 'http://knowledge:1');
    vi.stubEnv('EXECUTION_KNOWLEDGE_TIMEOUT_MS', '1000');
    vi.stubEnv('EXECUTION_KNOWLEDGE_RETRY', '4');
    vi.stubEnv('EXECUTION_MEMORY_ENABLED', 'false');
    vi.stubEnv('MEMORY_SERVICE_URL', 'http://memory:1');
    vi.stubEnv('EXECUTION_AI_ENABLED', 'false');
    vi.stubEnv('ORCHESTRATOR_SERVICE_URL', 'http://orchestrator:1');
    vi.stubEnv('EXECUTION_AI_TIMEOUT_MS', '30000');
    vi.stubEnv('EXECUTION_AI_QUALITY_TIER', 'premium');
    resetExecutionConfig();

    const config = getExecutionConfig();
    expect(config.database.poolMax).toBe(25);
    expect(config.scheduling.maxTasksPerDay).toBe(15);
    expect(config.scheduling.defaultTaskDuration).toBe(45);
    expect(config.scheduling.allowParallelTasks).toBe(false);
    expect(config.planning.defaultPlanningLevel).toBe('strategic');
    expect(config.planning.maxMissionsPerPlan).toBe(5);
    expect(config.planning.maxTasksPerMission).toBe(30);
    expect(config.recovery.maxRetries).toBe(7);
    expect(config.recovery.baseDelayMs).toBe(500);
    expect(config.recovery.autoRecoveryEnabled).toBe(false);
    expect(config.knowledge.enabled).toBe(false);
    expect(config.knowledge.baseUrl).toBe('http://knowledge:1');
    expect(config.knowledge.timeoutMs).toBe(1000);
    expect(config.knowledge.retryCount).toBe(4);
    expect(config.memory.enabled).toBe(false);
    expect(config.aiOrchestrator.enabled).toBe(false);
    expect(config.aiOrchestrator.baseUrl).toBe('http://orchestrator:1');
    expect(config.aiOrchestrator.timeoutMs).toBe(30000);
    expect(config.aiOrchestrator.defaultQualityTier).toBe('premium');
  });

  it('returns a copy that does not share top-level references', () => {
    const config = getExecutionConfig();
    // Reassigning a whole section on the returned copy must not affect the internal config.
    config.scheduling = { ...config.scheduling, maxTasksPerDay: 999 };
    expect(getExecutionConfig().scheduling.maxTasksPerDay).toBe(10);
  });

  it('updateExecutionConfig merges nested sections', () => {
    const updated = updateExecutionConfig({
      scheduling: { maxTasksPerDay: 12 },
      recovery: { autoRecoveryEnabled: false },
      knowledge: { timeoutMs: 2500 },
    });
    expect(updated.scheduling.maxTasksPerDay).toBe(12);
    expect(updated.scheduling.defaultTaskDuration).toBe(30);
    expect(updated.recovery.autoRecoveryEnabled).toBe(false);
    expect(updated.recovery.maxRetries).toBe(3);
    expect(updated.knowledge.timeoutMs).toBe(2500);
    expect(updated.knowledge.enabled).toBe(true);
  });

  it('resetExecutionConfig restores defaults after updates', () => {
    updateExecutionConfig({ scheduling: { maxTasksPerDay: 1 } });
    expect(getExecutionConfig().scheduling.maxTasksPerDay).toBe(1);
    resetExecutionConfig();
    expect(getExecutionConfig().scheduling.maxTasksPerDay).toBe(10);
  });
});
