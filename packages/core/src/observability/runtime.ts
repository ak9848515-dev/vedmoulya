// ──────────────────────────────────────────────────────────────────
// VedMoulya — Runtime Info
// Version, git SHA, build timestamp, uptime, memory, CPU
// PH-002 — Enterprise Operations & Reliability (T3 Runtime Health)
// ──────────────────────────────────────────────────────────────────

import os from 'node:os';
import { config } from '../config/index.js';

export interface RuntimeInfo {
  service: string;
  version: string;
  /** Commit SHA baked at build time (GIT_SHA / VERCEL_GIT_COMMIT_SHA). */
  gitSha?: string;
  /** ISO build timestamp (BUILD_TIMESTAMP env at build time). */
  buildTimestamp?: string;
  startedAt: string;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
  };
  cpu: {
    /** Load average over 1 minute (0..cpus*1 on most platforms). */
    loadAvg1m: number;
    cpuCount: number;
    cpuUsagePercent: number;
  };
}

let cpuStart = process.cpuUsage();
let cpuStartTime = Date.now();

function cpuUsagePercent(): number {
  const now = Date.now();
  const usage = process.cpuUsage(cpuStart);
  const deltaMs = now - cpuStartTime;
  const totalMs = usage.user + usage.system; // microseconds
  // Refresh baseline so the gauge reflects the current interval.
  cpuStart = process.cpuUsage();
  cpuStartTime = now;
  if (deltaMs <= 0) return 0;
  return Math.min(100, Math.round((totalMs / 1000 / deltaMs) * 100));
}

/**
 * Build the runtime info snapshot. Values are read live so repeated
 * calls reflect current uptime/memory/cpu.
 */
export function getRuntimeInfo(): RuntimeInfo {
  const mem = process.memoryUsage();
  const loadAvg = os.loadavg() as [number, number, number];

  return {
    service: config.observability.serviceName,
    version: config.app.version,
    gitSha:
      process.env.GIT_SHA?.trim() ||
      process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
      process.env.GITHUB_SHA?.trim() ||
      undefined,
    buildTimestamp: process.env.BUILD_TIMESTAMP?.trim() || undefined,
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    memory: {
      rssBytes: mem.rss,
      heapTotalBytes: mem.heapTotal,
      heapUsedBytes: mem.heapUsed,
      externalBytes: mem.external,
    },
    cpu: {
      loadAvg1m: loadAvg[0],
      cpuCount: osCpuCount(),
      cpuUsagePercent: cpuUsagePercent(),
    },
  };
}

function osCpuCount(): number {
  try {
    return os.cpus().length;
  } catch {
    return 1;
  }
}

/**
 * Register process-level gauges (memory, cpu, uptime) onto a metrics
 * registry via `setGauge`. Call periodically (e.g. an interval) for
 * scrapable runtime metrics.
 */
export function recordRuntimeMetrics(registry: {
  setGauge(name: string, value: number): void;
}): void {
  const info = getRuntimeInfo();
  registry.setGauge('runtime.memory.rss_bytes', info.memory.rssBytes);
  registry.setGauge('runtime.memory.heap_used_bytes', info.memory.heapUsedBytes);
  registry.setGauge('runtime.cpu.usage_percent', info.cpu.cpuUsagePercent);
  registry.setGauge('runtime.uptime_seconds', info.uptimeSeconds);
}
