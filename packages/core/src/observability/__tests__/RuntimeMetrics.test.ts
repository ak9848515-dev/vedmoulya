// ──────────────────────────────────────────────────────────────────
// VedMoulya — Runtime Info Tests
// getRuntimeInfo + recordRuntimeMetrics (PH-002/T1)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { getRuntimeInfo, recordRuntimeMetrics } from '../runtime.js';
import { MetricsRegistry } from '../../metrics/index.js';

describe('getRuntimeInfo', () => {
  it('returns live process runtime information', () => {
    const info = getRuntimeInfo();

    expect(info.version).toBeDefined();
    expect(info.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(info.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(info.nodeVersion).toMatch(/^v\d+/);
    expect(info.platform).toBeDefined();
    expect(info.arch).toBeDefined();
    expect(info.pid).toBeGreaterThan(0);
    expect(info.memory.rssBytes).toBeGreaterThan(0);
    expect(info.memory.heapUsedBytes).toBeGreaterThanOrEqual(0);
    expect(info.cpu.cpuCount).toBeGreaterThanOrEqual(1);
    expect(typeof info.cpu.cpuUsagePercent).toBe('number');
  });

  it('reads GIT_SHA and BUILD_TIMESTAMP from the environment when present', () => {
    const savedSha = process.env.GIT_SHA;
    const savedBuild = process.env.BUILD_TIMESTAMP;
    try {
      process.env.GIT_SHA = 'abc123';
      process.env.BUILD_TIMESTAMP = '2026-07-31T00:00:00.000Z';
      const info = getRuntimeInfo();
      expect(info.gitSha).toBe('abc123');
      expect(info.buildTimestamp).toBe('2026-07-31T00:00:00.000Z');
    } finally {
      if (savedSha === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = savedSha;
      if (savedBuild === undefined) delete process.env.BUILD_TIMESTAMP;
      else process.env.BUILD_TIMESTAMP = savedBuild;
    }
  });

  it('falls back to VERCEL_GIT_COMMIT_SHA when GIT_SHA is unset', () => {
    const savedGit = process.env.GIT_SHA;
    const savedVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    const savedGh = process.env.GITHUB_SHA;
    try {
      delete process.env.GIT_SHA;
      delete process.env.GITHUB_SHA;
      process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-abc123';
      const info = getRuntimeInfo();
      expect(info.gitSha).toBe('vercel-abc123');
    } finally {
      if (savedGit === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = savedGit;
      if (savedVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = savedVercel;
      if (savedGh === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = savedGh;
    }
  });

  it('falls back to GITHUB_SHA when other SHA variables are unset', () => {
    const savedGit = process.env.GIT_SHA;
    const savedVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    const savedGh = process.env.GITHUB_SHA;
    try {
      delete process.env.GIT_SHA;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
      process.env.GITHUB_SHA = 'gh-xyz789';
      const info = getRuntimeInfo();
      expect(info.gitSha).toBe('gh-xyz789');
    } finally {
      if (savedGit === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = savedGit;
      if (savedVercel === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = savedVercel;
      if (savedGh === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = savedGh;
    }
  });
});

describe('recordRuntimeMetrics', () => {
  it('registers memory, cpu and uptime gauges on the registry', () => {
    const registry = new MetricsRegistry();
    recordRuntimeMetrics(registry);

    const rss = registry.getGauge('runtime.memory.rss_bytes');
    const heap = registry.getGauge('runtime.memory.heap_used_bytes');
    const cpu = registry.getGauge('runtime.cpu.usage_percent');
    const uptime = registry.getGauge('runtime.uptime_seconds');

    expect(rss).toBeGreaterThan(0);
    expect(heap).toBeGreaterThanOrEqual(0);
    expect(typeof cpu).toBe('number');
    expect(uptime).toBeGreaterThanOrEqual(0);
  });
});
