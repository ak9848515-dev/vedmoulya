// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Graph Client unit tests
// BLD-006 — Knowledge Graph Integration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphClient } from '../KnowledgeGraphClient.js';
import { updateDecisionConfig, resetDecisionConfig } from '../../config/DecisionConfig.js';

function makeFetchResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

describe('KnowledgeGraphClient', () => {
  beforeEach(() => {
    resetDecisionConfig();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetDecisionConfig();
  });

  it('isEnabled reflects the config flag', () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    expect(new KnowledgeGraphClient().isEnabled()).toBe(true);
    updateDecisionConfig({
      knowledge: { enabled: false, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    expect(new KnowledgeGraphClient().isEnabled()).toBe(false);
  });

  it('returns empty context without calling fetch when disabled', async () => {
    updateDecisionConfig({
      knowledge: { enabled: false, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn());
    const client = new KnowledgeGraphClient();
    expect(await client.getDecisionContext('u-1', 'career')).toEqual({
      goals: [],
      skills: [],
      projects: [],
      relevantKnowledge: [],
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns parsed context on success', async () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          goals: [{ id: 'g-1', label: 'Goal', description: 'D', priority: 1, status: 'active' }],
          skills: [{ id: 's-1', name: 'TS', level: 3, category: 'tech' }],
          projects: [{ id: 'p-1', name: 'P', description: 'D', status: 'active', skills: [] }],
          knowledge: { results: [{ id: 'k-1', label: 'K', confidence: 0.9, type: 'concept' }] },
        }),
      ),
    );
    const client = new KnowledgeGraphClient();
    const context = await client.getDecisionContext('u-1', 'career');
    expect(context.goals).toHaveLength(1);
    expect(context.skills).toHaveLength(1);
    expect(context.projects).toHaveLength(1);
    expect(context.relevantKnowledge).toHaveLength(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('returns empty context when the service fails', async () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const client = new KnowledgeGraphClient();
    expect(await client.getDecisionContext('u-1')).toEqual({
      goals: [],
      skills: [],
      projects: [],
      relevantKnowledge: [],
    });
  });

  it('queryKnowledge returns parsed results on success', async () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          results: [{ id: 'k-1', label: 'K', confidence: 0.9, type: 'concept' }],
          metadata: { totalResults: 1, qualityRange: { min: 0.5, max: 0.9 }, queryTime: 5 },
        }),
      ),
    );
    const client = new KnowledgeGraphClient();
    const response = await client.queryKnowledge('career', 'skills');
    expect(response.results).toHaveLength(1);
    expect(response.metadata.totalResults).toBe(1);
  });

  it('queryKnowledge returns empty results on failure', async () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({}, false)));
    const client = new KnowledgeGraphClient();
    const response = await client.queryKnowledge('career');
    expect(response.results).toEqual([]);
    expect(response.metadata.totalResults).toBe(0);
  });

  it('queryKnowledge returns empty results when disabled', async () => {
    updateDecisionConfig({
      knowledge: { enabled: false, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn());
    const client = new KnowledgeGraphClient();
    const response = await client.queryKnowledge('career');
    expect(response.results).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getGoals and getSkills delegate to getDecisionContext', async () => {
    updateDecisionConfig({
      knowledge: { enabled: true, baseUrl: 'http://kg', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          goals: [{ id: 'g-1', label: 'Goal', description: 'D', priority: 1, status: 'active' }],
          skills: [{ id: 's-1', name: 'TS', level: 3, category: 'tech' }],
          projects: [],
          knowledge: { results: [] },
        }),
      ),
    );
    const client = new KnowledgeGraphClient();
    expect(await client.getGoals('u-1')).toHaveLength(1);
    expect(await client.getSkills('u-1')).toHaveLength(1);
  });
});
