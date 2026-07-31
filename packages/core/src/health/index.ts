// ──────────────────────────────────────────────────────────────────
// VedMoulya — Health Check System
// Standardized health checks for all services
// Implements BLP-001/D02 — Engineering Principle #9 (Observability)
// ──────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  checks: HealthCheck[];
  timestamp: string;
  version: string;
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  error?: string;
}

export type HealthCheckFn = () => Promise<HealthCheck> | HealthCheck;

/**
 * Health checker that runs registered health checks
 */
export class HealthChecker {
  private readonly checks = new Map<string, HealthCheckFn>();
  private readonly version: string;

  constructor(version: string = '0.1.0') {
    this.version = version;
  }

  /**
   * Register a health check function
   */
  register(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  /**
   * Run all registered health checks and return combined result
   */
  async check(): Promise<HealthCheckResult> {
    const results: HealthCheck[] = [];
    let overall: HealthStatus = 'healthy';

    for (const [name, checkFn] of this.checks) {
      const start = performance.now();
      try {
        const result = await checkFn();
        result.latencyMs = Math.round(performance.now() - start);
        results.push(result);

        if (result.status === 'unhealthy') {
          overall = 'unhealthy';
        } else if (result.status === 'degraded' && overall !== 'unhealthy') {
          overall = 'degraded';
        }
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: `Health check failed: ${(error as Error).message}`,
          latencyMs: Math.round(performance.now() - start),
          error: (error as Error).message,
        });
        overall = 'unhealthy';
      }
    }

    return {
      status: overall,
      checks: results,
      timestamp: new Date().toISOString(),
      version: this.version,
    };
  }

  /**
   * Get overall health status
   */
  async status(): Promise<HealthStatus> {
    const result = await this.check();
    return result.status;
  }
}

// ── Built-in Health Checks ────────────────────────────────────────────────

/**
 * Create a health check that pings a database
 */
export function databaseHealthCheck(name: string, pingFn: () => Promise<boolean>): HealthCheckFn {
  return async (): Promise<HealthCheck> => {
    try {
      const healthy = await pingFn();
      return {
        name,
        status: healthy ? 'healthy' : 'unhealthy',
        message: healthy ? 'Database connected' : 'Database unreachable',
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        message: 'Database check failed',
        error: (error as Error).message,
      };
    }
  };
}

/**
 * Create a health check that pings Redis
 */
export function redisHealthCheck(name: string, pingFn: () => Promise<boolean>): HealthCheckFn {
  return async (): Promise<HealthCheck> => {
    try {
      const healthy = await pingFn();
      return {
        name,
        status: healthy ? 'healthy' : 'degraded',
        message: healthy ? 'Redis connected' : 'Redis degraded',
      };
    } catch (error) {
      return {
        name,
        status: 'degraded',
        message: 'Redis check failed',
        error: (error as Error).message,
      };
    }
  };
}

/**
 * Create a health check for memory usage
 */
export function memoryHealthCheck(
  name: string = 'memory',
  thresholdMb: number = 512,
): HealthCheckFn {
  return (): HealthCheck => {
    const usage = process.memoryUsage();
    const heapUsedMb = Math.round(usage.heapUsed / 1024 / 1024);
    return {
      name,
      status: heapUsedMb < thresholdMb ? 'healthy' : 'degraded',
      message: `Heap: ${String(heapUsedMb)}MB / ${String(thresholdMb)}MB`,
    };
  };
}

/**
 * Default global health checker
 */
export const healthChecker = new HealthChecker();
