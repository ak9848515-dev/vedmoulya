// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for health gaps
// Covers the error paths in databaseHealthCheck, redisHealthCheck,
// cpuHealthCheck catch block, and degraded-status propagation.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  HealthChecker,
  databaseHealthCheck,
  redisHealthCheck,
  cpuHealthCheck,
  memoryHealthCheck,
  uptimeHealthCheck,
} from '../index.js';

describe('health — branch coverage', () => {
  // ── databaseHealthCheck ──────────────────────────────────────
  it('databaseHealthCheck returns unhealthy when ping returns false', async () => {
    const check = databaseHealthCheck('db', async () => false);
    const result = await check();
    expect(result.status).toBe('unhealthy');
    expect(result.message).toBe('Database unreachable');
  });

  it('databaseHealthCheck returns healthy when ping succeeds', async () => {
    const check = databaseHealthCheck('db', async () => true);
    const result = await check();
    expect(result.status).toBe('healthy');
    expect(result.message).toBe('Database connected');
  });

  it('databaseHealthCheck returns unhealthy on exception (error catch path)', async () => {
    const check = databaseHealthCheck('db', async () => {
      throw new Error('connection refused');
    });
    const result = await check();
    expect(result.status).toBe('unhealthy');
    expect(result.error).toBe('connection refused');
  });

  // ── redisHealthCheck ─────────────────────────────────────────
  it('redisHealthCheck returns degraded when ping returns false', async () => {
    const check = redisHealthCheck('redis', async () => false);
    const result = await check();
    expect(result.status).toBe('degraded');
    expect(result.message).toBe('Redis degraded');
  });

  it('redisHealthCheck returns healthy when ping succeeds', async () => {
    const check = redisHealthCheck('redis', async () => true);
    const result = await check();
    expect(result.status).toBe('healthy');
  });

  it('redisHealthCheck returns degraded on exception (error catch path)', async () => {
    const check = redisHealthCheck('redis', async () => {
      throw new Error('ECONNREFUSED');
    });
    const result = await check();
    expect(result.status).toBe('degraded');
    expect(result.error).toBe('ECONNREFUSED');
  });

  // ── cpuHealthCheck ───────────────────────────────────────────
  it('cpuHealthCheck returns healthy when load is below threshold', () => {
    const check = cpuHealthCheck('cpu', 999);
    const result = check();
    expect(result.status).toBe('healthy');
    expect(result.name).toBe('cpu');
  });

  it('cpuHealthCheck returns degraded when load exceeds threshold', () => {
    const check = cpuHealthCheck('cpu', 0);
    const result = check();
    expect(result.status).toBe('degraded');
  });

  // ── uptimeHealthCheck ────────────────────────────────────────
  it('uptimeHealthCheck always returns healthy', () => {
    const check = uptimeHealthCheck();
    const result = check();
    expect(result.status).toBe('healthy');
  });

  // ── memoryHealthCheck ────────────────────────────────────────
  it('memoryHealthCheck with a very low threshold returns degraded', () => {
    const check = memoryHealthCheck('mem', 0);
    const result = check();
    expect(result.status).toBe('degraded');
  });

  // ── HealthChecker degraded propagation ───────────────────────
  it('degraded status propagates from a single check to overall', async () => {
    const hc = new HealthChecker();
    hc.register('ok', () => ({ name: 'ok', status: 'healthy' }));
    hc.register('degraded-check', () => ({ name: 'degraded-check', status: 'degraded' }));
    const result = await hc.check();
    expect(result.status).toBe('degraded');
  });

  it('unhealthy overrides degraded in overall status', async () => {
    const hc = new HealthChecker();
    hc.register('degraded', () => ({ name: 'degraded', status: 'degraded' }));
    hc.register('unhealthy', () => ({ name: 'unhealthy', status: 'unhealthy' }));
    const result = await hc.check();
    expect(result.status).toBe('unhealthy');
  });

  it('async check exceptions produce unhealthy status with error', async () => {
    const hc = new HealthChecker();
    hc.register('boom', async () => {
      throw new Error('async boom');
    });
    const result = await hc.check();
    expect(result.status).toBe('unhealthy');
    expect(result.checks[0]?.error).toBe('async boom');
  });

  it('status() returns overall health status', async () => {
    const hc = new HealthChecker();
    hc.register('ok', () => ({ name: 'ok', status: 'healthy' }));
    const status = await hc.status();
    expect(status).toBe('healthy');
  });

  it('constructor accepts custom version', () => {
    const hc = new HealthChecker('2.0.0');
    hc.register('ok', () => ({ name: 'ok', status: 'healthy' }));
    return hc.check().then((result) => {
      expect(result.version).toBe('2.0.0');
    });
  });
});
