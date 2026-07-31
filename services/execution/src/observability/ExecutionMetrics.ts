import { metrics } from '@vedmoulya/core';

export const MetricNames = {
  PLANS_CREATED: 'execution.plans.created',
  PLANS_ACTIVATED: 'execution.plans.activated',
  PLANS_STARTED: 'execution.plans.started',
  PLANS_COMPLETED: 'execution.plans.completed',
  PLANS_FAILED: 'execution.plans.failed',
  PLANS_CANCELLED: 'execution.plans.cancelled',
  PLANS_PAUSED: 'execution.plans.paused',
  PLANS_RECOVERED: 'execution.plans.recovered',
  TASKS_CREATED: 'execution.tasks.created',
  TASKS_COMPLETED: 'execution.tasks.completed',
  TASKS_FAILED: 'execution.tasks.failed',
  TASKS_SKIPPED: 'execution.tasks.skipped',
  MISSIONS_CREATED: 'execution.missions.created',
  MISSIONS_COMPLETED: 'execution.missions.completed',
  SCHEDULES_CREATED: 'execution.schedules.created',
  DEPENDENCIES_RESOLVED: 'execution.dependencies.resolved',
  BOTTLENECKS_DETECTED: 'execution.bottlenecks.detected',
  RECOVERY_ATTEMPTS: 'execution.recovery.attempts',
  RECOVERY_SUCCESSES: 'execution.recovery.successes',
  CACHE_HITS: 'execution.cache.hits',
  CACHE_MISSES: 'execution.cache.misses',
} as const;

export class ExecutionMetrics {
  recordPlanCreated(): void {
    try {
      metrics.increment(MetricNames.PLANS_CREATED);
    } catch {
      /* noop */
    }
  }
  recordPlanActivated(): void {
    try {
      metrics.increment(MetricNames.PLANS_ACTIVATED);
    } catch {
      /* noop */
    }
  }
  recordPlanStarted(): void {
    try {
      metrics.increment(MetricNames.PLANS_STARTED);
    } catch {
      /* noop */
    }
  }
  recordPlanCompleted(): void {
    try {
      metrics.increment(MetricNames.PLANS_COMPLETED);
    } catch {
      /* noop */
    }
  }
  recordPlanFailed(): void {
    try {
      metrics.increment(MetricNames.PLANS_FAILED);
    } catch {
      /* noop */
    }
  }
  recordPlanCancelled(): void {
    try {
      metrics.increment(MetricNames.PLANS_CANCELLED);
    } catch {
      /* noop */
    }
  }
  recordPlanPaused(): void {
    try {
      metrics.increment(MetricNames.PLANS_PAUSED);
    } catch {
      /* noop */
    }
  }
  recordPlanRecovered(): void {
    try {
      metrics.increment(MetricNames.PLANS_RECOVERED);
    } catch {
      /* noop */
    }
  }
  recordTaskCreated(): void {
    try {
      metrics.increment(MetricNames.TASKS_CREATED);
    } catch {
      /* noop */
    }
  }
  recordTaskCompleted(): void {
    try {
      metrics.increment(MetricNames.TASKS_COMPLETED);
    } catch {
      /* noop */
    }
  }
  recordTaskFailed(): void {
    try {
      metrics.increment(MetricNames.TASKS_FAILED);
    } catch {
      /* noop */
    }
  }
  recordTaskSkipped(): void {
    try {
      metrics.increment(MetricNames.TASKS_SKIPPED);
    } catch {
      /* noop */
    }
  }
  recordMissionCreated(): void {
    try {
      metrics.increment(MetricNames.MISSIONS_CREATED);
    } catch {
      /* noop */
    }
  }
  recordMissionCompleted(): void {
    try {
      metrics.increment(MetricNames.MISSIONS_COMPLETED);
    } catch {
      /* noop */
    }
  }
  recordScheduleCreated(): void {
    try {
      metrics.increment(MetricNames.SCHEDULES_CREATED);
    } catch {
      /* noop */
    }
  }
  recordDependencyResolved(): void {
    try {
      metrics.increment(MetricNames.DEPENDENCIES_RESOLVED);
    } catch {
      /* noop */
    }
  }
  recordBottleneckDetected(): void {
    try {
      metrics.increment(MetricNames.BOTTLENECKS_DETECTED);
    } catch {
      /* noop */
    }
  }
  recordRecoveryAttempt(): void {
    try {
      metrics.increment(MetricNames.RECOVERY_ATTEMPTS);
    } catch {
      /* noop */
    }
  }
  recordRecoverySuccess(): void {
    try {
      metrics.increment(MetricNames.RECOVERY_SUCCESSES);
    } catch {
      /* noop */
    }
  }
  recordCacheHit(): void {
    try {
      metrics.increment(MetricNames.CACHE_HITS);
    } catch {
      /* noop */
    }
  }
  recordCacheMiss(): void {
    try {
      metrics.increment(MetricNames.CACHE_MISSES);
    } catch {
      /* noop */
    }
  }
}
