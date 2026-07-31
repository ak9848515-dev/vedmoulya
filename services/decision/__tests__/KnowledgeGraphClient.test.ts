// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Graph Integration Client Tests
// BLD-006 — Knowledge Graph Integration (consume only)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeGraphClient } from '../src/integration/KnowledgeGraphClient.js';

describe('KnowledgeGraphClient', () => {
  let client: KnowledgeGraphClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    client = new KnowledgeGraphClient();
  });

  describe('getDecisionContext', () => {
    it('returns empty context when KG is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const context = await client.getDecisionContext('user_1');
      expect(context.goals).toEqual([]);
      expect(context.skills).toEqual([]);
      expect(context.projects).toEqual([]);
      expect(context.relevantKnowledge).toEqual([]);
    });

    it('returns gracefully when service is unavailable', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unreachable'));
      const context = await client.getDecisionContext('user_1');
      expect(context).toBeDefined();
      expect(context.goals).toEqual([]);
    });
  });

  describe('getGoals', () => {
    it('returns empty array on failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'));
      const goals = await client.getGoals('user_1');
      expect(goals).toEqual([]);
    });
  });

  describe('getSkills', () => {
    it('returns empty array on failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Service unavailable'));
      const skills = await client.getSkills('user_1');
      expect(skills).toEqual([]);
    });
  });
});
