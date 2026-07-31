import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryEngineClient } from '../MemoryEngineClient.js';

const ORIGINAL_FETCH = global.fetch;

describe('MemoryEngineClient', () => {
  beforeEach(() => {
    vi.stubEnv('MEMORY_SERVICE_URL', 'http://test:4004');
    vi.stubEnv('EXECUTION_MEMORY_ENABLED', 'true');
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('returns false when disabled', () => {
    vi.stubEnv('EXECUTION_MEMORY_ENABLED', 'false');
    const client = new MemoryEngineClient();
    expect(client.isEnabled()).toBe(false);
  });

  it('stores outcome successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const client = new MemoryEngineClient();
    const result = await client.storeExecutionOutcome({
      planId: 'p1',
      taskId: 't1',
      result: 'success',
      description: 'Done',
    });
    expect(result).toBe(true);
  });

  it('returns false on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new MemoryEngineClient();
    const result = await client.storeExecutionOutcome({
      planId: 'p1',
      taskId: 't1',
      result: 'success',
      description: 'Done',
    });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const client = new MemoryEngineClient();
    const result = await client.storeExecutionOutcome({
      planId: 'p1',
      taskId: 't1',
      result: 'success',
      description: 'Done',
    });
    expect(result).toBe(false);
  });

  it('stores with optional fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
    const client = new MemoryEngineClient();
    const result = await client.storeExecutionOutcome({
      planId: 'p1',
      taskId: 't1',
      result: 'partial',
      description: 'Half done',
      duration: 120,
      quality: 70,
    });
    expect(result).toBe(true);
  });
});
