// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for lifecycle gaps
// Covers reset(), stop with failing hooks (errors.length > 0 path),
// startupError after failed start, and the startup-then-stop cycle.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationLifecycle } from '../index.js';
import { container } from '../../di/index.js';
import { moduleRegistry } from '../../modules/index.js';

beforeEach(() => {
  container.clear();
  moduleRegistry.reset();
});

describe('ApplicationLifecycle — branch coverage', () => {
  it('reset clears all state (lines 99-100, 107)', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStart(async () => {});
    lc.onStop(async () => {});
    await lc.start();
    lc.reset();

    expect(lc.phase).toBe('created');
    expect(lc.startupError).toBeUndefined();
    // After reset, no hooks remain — start is idempotent
    await lc.start();
    expect(lc.phase).toBe('started');
  });

  it('stop completes with errors when a stop hook throws (errors.length > 0 path)', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStop(async () => {
      throw new Error('shutdown hook failed');
    });
    await lc.start();
    // stop must NOT throw — it logs errors and completes
    await lc.stop();
    expect(lc.phase).toBe('stopped');
  });

  it('stop with multiple failing hooks accumulates errors', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStop(async () => {
      throw new Error('hook1');
    });
    lc.onStop(async () => {
      throw new Error('hook2');
    });
    await lc.start();
    await lc.stop();
    expect(lc.phase).toBe('stopped');
  });

  it('stop with a mix of succeeding and failing hooks', async () => {
    const lc = new ApplicationLifecycle();
    const order: string[] = [];
    lc.onStop(async () => {
      order.push('ok');
    });
    lc.onStop(async () => {
      throw new Error('fail');
    });
    lc.onStop(async () => {
      order.push('ok2');
    });
    await lc.start();
    await lc.stop();
    expect(lc.phase).toBe('stopped');
    // Hooks run in reverse order: ok2, fail-throws, ok
    expect(order).toEqual(['ok2', 'ok']);
  });

  it('startupError is undefined after a successful start', async () => {
    const lc = new ApplicationLifecycle();
    await lc.start();
    expect(lc.startupError).toBeUndefined();
  });

  it('startupError is set after a failed start', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStart(() => {
      throw new Error('boom');
    });
    await expect(lc.start()).rejects.toThrow('boom');
    expect(lc.startupError?.message).toBe('boom');
    expect(lc.phase).toBe('stopped');
  });

  it('async startup hook failure transitions to stopped', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStart(async () => {
      throw new Error('async boom');
    });
    await expect(lc.start()).rejects.toThrow('async boom');
    expect(lc.phase).toBe('stopped');
  });
});
