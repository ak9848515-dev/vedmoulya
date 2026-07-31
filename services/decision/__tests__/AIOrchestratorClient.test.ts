// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Integration Client Tests
// BLD-005 — AI Orchestrator Integration (use only BLD-005 contracts)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIOrchestratorClient } from '../src/integration/AIOrchestratorClient.js';

describe('AIOrchestratorClient', () => {
  let client: AIOrchestratorClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    client = new AIOrchestratorClient();
  });

  describe('requestReasoning', () => {
    it('returns empty result when AI is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const result = await client.requestReasoning({
        capability: 'reasoning',
        userInput: 'Analyze this decision',
        context: { userId: 'user_1' },
      });

      expect(result.content).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.provider).toBe('none');
    });

    it('returns content on successful response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: 'Analysis result',
            provider: 'test-provider',
            confidence: 0.85,
            qualityScore: 8,
            latency: 100,
            traceId: 'trace_123',
          }),
      } as Response);

      const result = await client.requestReasoning({
        capability: 'reasoning',
        userInput: 'Analyze this',
        context: {},
      });

      expect(result.content).toBe('Analysis result');
      expect(result.confidence).toBe(0.85);
      expect(result.provider).toBe('test-provider');
    });
  });

  describe('generateOptions', () => {
    it('returns empty array when AI is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const options = await client.generateOptions({ userId: 'user_1' });
      expect(options).toEqual([]);
    });
  });

  describe('generateExplanation', () => {
    it('returns empty string when AI is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const explanation = await client.generateExplanation({ decisionId: 'dec_1' });
      expect(explanation).toBe('');
    });
  });
});
