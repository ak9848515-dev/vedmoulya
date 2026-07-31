import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DecisionEngineClient } from '../DecisionEngineClient.js';

const ORIGINAL_FETCH = global.fetch;

describe('DecisionEngineClient', () => {
  beforeEach(() => {
    vi.stubEnv('DECISION_SERVICE_URL', 'http://test:4005');
    vi.stubEnv('EXECUTION_DECISION_ENABLED', 'true');
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.unstubAllEnvs();
  });

  it('returns null when disabled', () => {
    vi.stubEnv('EXECUTION_DECISION_ENABLED', 'false');
    const client = new DecisionEngineClient();
    expect(client.isEnabled()).toBe(false);
  });

  it('is enabled by default', () => {
    const client = new DecisionEngineClient();
    expect(client.isEnabled()).toBe(true);
  });

  it('fetches decision info successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'd1',
          title: 'Test Decision',
          selectedOption: { label: 'Option A' },
          confidence: { score: 0.85 },
          status: 'made',
        },
      }),
    });
    const client = new DecisionEngineClient();
    const result = await client.getDecisionInfo('d1');
    expect(result).not.toBeNull();
    expect(result!.decisionId).toBe('d1');
    expect(result!.title).toBe('Test Decision');
    expect(result!.selectedOption).toBe('Option A');
    expect(result!.confidence).toBe(0.85);
  });

  it('returns null on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    const client = new DecisionEngineClient();
    const result = await client.getDecisionInfo('d1');
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
    const client = new DecisionEngineClient();
    const result = await client.getDecisionInfo('d1');
    expect(result).toBeNull();
  });

  it('returns null on malformed response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ no_data: true }),
    });
    const client = new DecisionEngineClient();
    const result = await client.getDecisionInfo('d1');
    expect(result).toBeNull();
  });
});
