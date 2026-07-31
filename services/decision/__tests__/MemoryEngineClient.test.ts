// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Engine Integration Client Tests
// BLD-007 — Memory Engine Integration (consume only)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryEngineClient } from '../src/integration/MemoryEngineClient.js';

describe('MemoryEngineClient', () => {
  let client: MemoryEngineClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    client = new MemoryEngineClient();
  });

  describe('getMemoryContext', () => {
    it('returns empty data when memory is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const context = await client.getMemoryContext('decision_1', 'user_1');
      expect(context.pastDecisions).toEqual([]);
      expect(context.relevantExperiences).toEqual([]);
      expect(context.observations).toEqual([]);
    });

    it('handles successful empty response gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [], memories: [] }),
      } as Response);

      const context = await client.getMemoryContext('decision_1', 'user_1');
      expect(context).toBeDefined();
      expect(context.pastDecisions).toEqual([]);
    });
  });

  describe('getPastDecisions', () => {
    it('returns empty array on failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'));
      const decisions = await client.getPastDecisions('user_1');
      expect(decisions).toEqual([]);
    });
  });

  describe('getRelevantExperiences', () => {
    it('returns empty array on failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'));
      const experiences = await client.getRelevantExperiences('user_1');
      expect(experiences).toEqual([]);
    });
  });
});
