// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Infrastructure Health Probe
// Real Database (postgres SELECT 1) and Redis (RESP PING) health checks with
// measured latency, recorded into the metrics registry for Prometheus export.
// PH-002/T3 follow-up — replaces the "not_configured" placeholders for the
// database and redis health components when real endpoints are configured.
// ─────────────────────────────────────────────────────────────────────────────

import net from 'node:net';
import tls from 'node:tls';
import postgres from 'postgres';
import { config, logger, metrics } from '@vedmoulya/core';

export type DependencyName = 'database' | 'redis';
export type DependencyStatus = 'healthy' | 'degraded' | 'unhealthy' | 'not_configured';

export interface DependencyHealthResult {
  name: DependencyName;
  status: DependencyStatus;
  message?: string;
  latencyMs?: number;
  error?: string;
}

export interface InfrastructureHealthProbeOptions {
  /** Override the database URL (defaults to @vedmoulya/core config). */
  databaseUrl?: string;
  /** Override the Redis URL (defaults to @vedmoulya/core config). */
  redisUrl?: string;
  /** Probe timeout in ms (default 3000). */
  timeoutMs?: number;
  /**
   * Environment used for the probe gate. Defaults to process.env.NODE_ENV.
   * In "test", probes report not_configured without any network I/O so the
   * unit suite stays hermetic and fast.
   */
  env?: string;
  /**
   * Verify TLS certificates for rediss:// connections (default true).
   * Opt out only for internal self-signed infrastructure.
   */
  tlsRejectUnauthorized?: boolean;
}

function roundLatency(ms: number): number {
  return Math.round(ms * 100) / 100;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sanitize a driver error before it reaches the public health payload:
 * truncate to a safe length and redact common credential tokens. The full
 * message stays in the logs via logger.warn.
 */
function sanitizeError(message: string): string {
  const redacted = message.replace(/(postgres(?:ql)?|redis|rediss):\/\/[^\s@]+@/gi, '$1://***@');
  return redacted.length > 200 ? `${redacted.slice(0, 200)}…` : redacted;
}

/**
 * Executes a real Redis PING over the RESP protocol using a raw socket.
 * Supports redis:// (node:net) and rediss:// (node:tls). Resolves when
 * +PONG is received; rejects on error, timeout, or early close.
 */
function pingRedis(url: string, timeoutMs: number, rejectUnauthorized: boolean): Promise<number> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid REDIS_URL'));
      return;
    }

    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      reject(
        new Error(`Unsupported Redis protocol "${parsed.protocol}" (use redis:// or rediss://)`),
      );
      return;
    }

    const isTls = parsed.protocol === 'rediss:';
    const port = parsed.port ? Number(parsed.port) : 6379;
    const host = parsed.hostname;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

    let settled = false;
    let buffer = '';
    const start = performance.now();

    const socket = isTls
      ? tls.connect({ host, port, servername: host, rejectUnauthorized })
      : net.connect({ host, port });

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(timeoutMs, () => {
      fail(new Error(`Redis PING timed out after ${String(timeoutMs)}ms`));
    });
    socket.once('error', (err: Error) => {
      fail(err);
    });
    socket.once('close', () => {
      if (!settled) fail(new Error('Redis connection closed before PONG'));
    });
    socket.once('connect', () => {
      try {
        if (password) socket.write(`AUTH ${password}\r\n`);
        socket.write('PING\r\n');
      } catch (err) {
        fail(err as Error);
      }
    });
    socket.on('data', (chunk: Buffer | string) => {
      buffer += chunk.toString('utf8');
      if (buffer.includes('+PONG')) {
        if (settled) return;
        settled = true;
        socket.end();
        resolve(performance.now() - start);
        return;
      }
      const firstLine = buffer.split('\r\n')[0] ?? buffer;
      if (/^-ERR|-NOAUTH|-WRONGPASS/i.test(firstLine)) {
        fail(new Error(`Redis PING rejected: ${firstLine}`));
      }
    });
  });
}

/**
 * Probes the configured database and Redis endpoints with real round-trips.
 * Never throws — every check returns a structured result. In the test
 * environment (or when no URL is configured) it reports not_configured
 * without attempting network I/O.
 */
export class InfrastructureHealthProbe {
  private readonly databaseUrl: string | undefined;
  private readonly redisUrl: string | undefined;
  private readonly timeoutMs: number;
  private readonly env: string;
  private readonly tlsRejectUnauthorized: boolean;
  private dbClient: ReturnType<typeof postgres> | null = null;

  constructor(options: InfrastructureHealthProbeOptions = {}) {
    this.databaseUrl = options.databaseUrl ?? config.database.url;
    this.redisUrl = options.redisUrl ?? config.redis.url;
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.env = options.env ?? process.env.NODE_ENV ?? 'development';
    this.tlsRejectUnauthorized = options.tlsRejectUnauthorized ?? true;
  }

  private get isConfigured(): boolean {
    // Keep unit tests hermetic: no real connections under NODE_ENV=test.
    return this.env !== 'test';
  }

  /**
   * Real database check: SELECT 1 through a lazily-created postgres pool.
   */
  async checkDatabase(): Promise<DependencyHealthResult> {
    const url = this.databaseUrl;
    if (!this.isConfigured || !url || url.trim() === '') {
      return {
        name: 'database',
        status: 'not_configured',
        message: 'Database probe not configured',
      };
    }

    const start = performance.now();
    try {
      if (this.dbClient === null) {
        this.dbClient = postgres(url, {
          max: 1,
          connect_timeout: Math.max(1, Math.floor(this.timeoutMs / 1000)),
          idle_timeout: Math.max(1, Math.floor(this.timeoutMs / 1000)),
          connection: { application_name: 'vedmoulya-api-health' },
        });
      }
      await this.dbClient`SELECT 1`;
      const latencyMs = roundLatency(performance.now() - start);
      metrics.observe('api.health.database.latency_ms', latencyMs);
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connected (SELECT 1)',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = roundLatency(performance.now() - start);
      metrics.observe('api.health.database.latency_ms', latencyMs);
      const raw = messageOf(error);
      logger.warn('Database health check failed', { error: raw });
      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Database unreachable',
        latencyMs,
        error: sanitizeError(raw),
      };
    }
  }

  /**
   * Real Redis check: RESP PING over a raw socket.
   */
  async checkRedis(): Promise<DependencyHealthResult> {
    const url = this.redisUrl;
    if (!this.isConfigured || !url || url.trim() === '') {
      return {
        name: 'redis',
        status: 'not_configured',
        message: 'Redis probe not configured',
      };
    }

    const start = performance.now();
    try {
      await pingRedis(url, this.timeoutMs, this.tlsRejectUnauthorized);
      const latencyMs = roundLatency(performance.now() - start);
      metrics.observe('api.health.redis.latency_ms', latencyMs);
      return {
        name: 'redis',
        status: 'healthy',
        message: 'Redis connected (PING)',
        latencyMs,
      };
    } catch (error) {
      const latencyMs = roundLatency(performance.now() - start);
      metrics.observe('api.health.redis.latency_ms', latencyMs);
      const raw = messageOf(error);
      logger.warn('Redis health check failed', { error: raw });
      // Redis is treated as a degradable dependency (matches core semantics).
      return {
        name: 'redis',
        status: 'degraded',
        message: 'Redis degraded',
        latencyMs,
        error: sanitizeError(raw),
      };
    }
  }

  /**
   * Release the pooled database client (graceful shutdown hook).
   */
  async close(): Promise<void> {
    if (this.dbClient !== null) {
      try {
        await this.dbClient.end();
      } catch (error) {
        logger.warn('Failed to close database health probe', { error: messageOf(error) });
      }
      this.dbClient = null;
    }
  }
}
