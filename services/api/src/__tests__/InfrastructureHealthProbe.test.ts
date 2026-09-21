// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: InfrastructureHealthProbe Tests
// Real database/redis health probe (PH-002/T3 follow-up)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { metrics } from '@vedmoulya/core';
import { InfrastructureHealthProbe } from '../services/InfrastructureHealthProbe.js';

describe('InfrastructureHealthProbe', () => {
  afterEach(() => {
    metrics.reset();
  });

  it('reports not_configured in the test environment without network I/O', async () => {
    const probe = new InfrastructureHealthProbe({ env: 'test' });
    const db = await probe.checkDatabase();
    const redis = await probe.checkRedis();
    expect(db.status).toBe('not_configured');
    expect(redis.status).toBe('not_configured');
  });

  it('reports not_configured when no URL is configured', async () => {
    const probe = new InfrastructureHealthProbe({ env: 'development' });
    // Probe reads @vedmoulya/core config (set by tests/vitest.setup.ts), which
    // always has a URL — simulate an unconfigured state with empty overrides.
    const empty = new InfrastructureHealthProbe({
      env: 'development',
      databaseUrl: '  ',
      redisUrl: '',
    });
    const db = await empty.checkDatabase();
    const redis = await empty.checkRedis();
    expect(db.status).toBe('not_configured');
    expect(redis.status).toBe('not_configured');
    void probe;
  });

  it('performs a real Redis PING and reports healthy with latency', async () => {
    // Spin up a minimal RESP server that answers +PONG to PING.
    const server = net.createServer((socket) => {
      socket.on('data', () => {
        socket.write('+PONG\r\n');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('server has no port');
    const port = address.port;

    try {
      const probe = new InfrastructureHealthProbe({
        env: 'development',
        redisUrl: `redis://127.0.0.1:${String(port)}`,
        timeoutMs: 2000,
      });
      const result = await probe.checkRedis();
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Redis connected');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      const stats = metrics.histogramStats('api.health.redis.latency_ms');
      expect(stats?.count).toBeGreaterThanOrEqual(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('degrades when Redis is unreachable', async () => {
    const probe = new InfrastructureHealthProbe({
      env: 'development',
      redisUrl: 'redis://127.0.0.1:1', // port 1 → connection refused
      timeoutMs: 1000,
    });
    const result = await probe.checkRedis();
    expect(result.status).toBe('degraded');
    expect(result.error).toBeDefined();
  });

  it('degrades on an invalid Redis URL', async () => {
    const probe = new InfrastructureHealthProbe({
      env: 'development',
      redisUrl: 'not-a-url',
      timeoutMs: 1000,
    });
    const result = await probe.checkRedis();
    expect(result.status).toBe('degraded');
    expect(result.error).toContain('Invalid REDIS_URL');
  });

  it('reports unhealthy when the database is unreachable', async () => {
    const probe = new InfrastructureHealthProbe({
      env: 'development',
      databaseUrl: 'postgres://127.0.0.1:1/vedmoulya', // port 1 → refused
      timeoutMs: 1000,
    });
    try {
      const result = await probe.checkDatabase();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
    } finally {
      // Release the pooled client so postgres.js cannot hold event-loop timers.
      await probe.close();
    }
  });

  // PROD-02A Task 4 — the health payload that carries this error is served by
  // the PUBLIC readiness/health surface, so a driver failure message must not
  // publish internal topology (host/port) or credentials.
  it('redacts internal host/port topology and credentials from public health errors', async () => {
    const probe = new InfrastructureHealthProbe({
      env: 'development',
      databaseUrl: 'postgres://topology-user:topology-secret@127.0.0.1:1/vedmoulya',
      timeoutMs: 1000,
    });
    try {
      const result = await probe.checkDatabase();
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBeDefined();
      expect(result.error).not.toContain('127.0.0.1');
      expect(result.error).not.toContain('topology-secret');
    } finally {
      await probe.close();
    }
  });

  it('close() is idempotent and safe when no client exists', async () => {
    const probe = new InfrastructureHealthProbe({ env: 'development' });
    await expect(probe.close()).resolves.toBeUndefined();
    await expect(probe.close()).resolves.toBeUndefined();
  });
});
