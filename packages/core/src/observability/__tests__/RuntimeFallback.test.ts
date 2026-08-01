// ──────────────────────────────────────────────────────────────────
// VedMoulya — Runtime Fallback Tests
// Verifies getRuntimeInfo() degrades gracefully when the OS reports
// no CPU info (os.cpus() throws) — PH-002/T3 Runtime Health.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import os from 'node:os';
import { getRuntimeInfo } from '../runtime.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getRuntimeInfo os fallback', () => {
  it('reports cpuCount 1 when os.cpus() throws', () => {
    vi.spyOn(os, 'cpus').mockImplementation(() => {
      throw new Error('cpus unavailable');
    });

    const info = getRuntimeInfo();
    expect(info.cpu.cpuCount).toBe(1);
  });
});
