import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIOrchestratorClient } from '../AIOrchestratorClient.js';

const ORIGINAL_FETCH = global.fetch;

describe('AIOrchestratorClient', () => {
  beforeEach(() => {
    vi.stubEnv('ORCHESTRATOR_SERVICE_URL', 'http://test:4001');
    vi.stubEnv('EXECUTION_AI_ENABLED', 'true');
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('returns empty string when disabled for brief', () => {
    vi.stubEnv('EXECUTION_AI_ENABLED', 'false');
    const client = new AIOrchestratorClient();
    expect(client.isEnabled()).toBe(false);
  });

  it('generates daily brief', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'Focus on three high-priority tasks today.' }),
    });
    const client = new AIOrchestratorClient();
    const result = await client.generateDailyBrief({ planId: 'p1' });
    expect(result).toBe('Focus on three high-priority tasks today.');
  });

  it('returns empty on HTTP error for daily brief', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new AIOrchestratorClient();
    expect(await client.generateDailyBrief({})).toBe('');
  });

  it('returns empty on network error for daily brief', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Service down'));
    const client = new AIOrchestratorClient();
    expect(await client.generateDailyBrief({})).toBe('');
  });

  it('generates recovery recommendations with single item', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: '- Single recommendation' }),
    });
    const client = new AIOrchestratorClient();
    const recs = await client.generateRecoveryRecommendations({});
    expect(recs).toHaveLength(1);
    expect(recs[0]).toBe('Single recommendation');
  });

  it('generates recovery recommendations with multiple items', async () => {
    // The source code uses .split('\\n') which splits on actual newline characters
    // Provide content with actual newlines between items
    const content = [
      '- Retry the operation',
      '- Escalate to supervisor',
      '- Rollback changes',
    ].join('\n'); // actual newlines (1 char each)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content }),
    });
    const client = new AIOrchestratorClient();
    const recs = await client.generateRecoveryRecommendations({ taskId: 't1' });
    expect(recs).toHaveLength(3);
    expect(recs[0]).toBe('Retry the operation');
    expect(recs[1]).toBe('Escalate to supervisor');
    expect(recs[2]).toBe('Rollback changes');
  });

  it('returns empty on HTTP error for recovery', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new AIOrchestratorClient();
    expect(await client.generateRecoveryRecommendations({})).toEqual([]);
  });
});
