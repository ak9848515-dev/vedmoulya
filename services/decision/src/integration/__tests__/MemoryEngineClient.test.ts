// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Memory Engine Client unit tests
// BLD-007 — Memory Engine Integration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryEngineClient } from '../MemoryEngineClient.js';
import { updateDecisionConfig, resetDecisionConfig } from '../../config/DecisionConfig.js';

function makeFetchResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body };
}

const memoryResult = {
  memoryId: 'mem-1',
  content: 'dec-1',
  type: 'decision',
  confidence: 0.8,
  timestamp: new Date('2026-01-01T00:00:00Z'),
};

describe('MemoryEngineClient', () => {
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
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    expect(new MemoryEngineClient().isEnabled()).toBe(true);
    updateDecisionConfig({
      memory: { enabled: false, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    expect(new MemoryEngineClient().isEnabled()).toBe(false);
  });

  it('returns empty data without calling fetch when disabled', async () => {
    updateDecisionConfig({
      memory: { enabled: false, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn());
    const client = new MemoryEngineClient();
    expect(await client.getMemoryContext('dec-1', 'u-1')).toEqual({
      pastDecisions: [],
      relevantExperiences: [],
      observations: [],
    });
    expect(await client.getPastDecisions('u-1')).toEqual([]);
    expect(await client.getRelevantExperiences('u-1')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getPastDecisions filters and maps decision memories', async () => {
    updateDecisionConfig({
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          results: [
            memoryResult,
            {
              memoryId: 'mem-2',
              content: 'note',
              type: 'note',
              confidence: 0.5,
              timestamp: new Date(),
            },
          ],
        }),
      ),
    );
    const client = new MemoryEngineClient();
    const decisions = await client.getPastDecisions('u-1');
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      memoryId: 'mem-1',
      decisionId: 'dec-1',
      outcome: 'decision',
    });
  });

  it('getPastDecisions returns empty on failure', async () => {
    updateDecisionConfig({
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({}, false)));
    const client = new MemoryEngineClient();
    expect(await client.getPastDecisions('u-1')).toEqual([]);
  });

  it('getRelevantExperiences returns parsed memories', async () => {
    updateDecisionConfig({
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          memories: [
            {
              memoryId: 'mem-3',
              content: 'Worked on x',
              category: 'experience',
              importance: 5,
              confidence: 0.7,
              timestamp: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        }),
      ),
    );
    const client = new MemoryEngineClient();
    const experiences = await client.getRelevantExperiences('u-1', 'dec-1');
    expect(experiences).toHaveLength(1);
    expect(experiences[0].content).toBe('Worked on x');
  });

  it('getRelevantExperiences returns empty on failure', async () => {
    updateDecisionConfig({
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const client = new MemoryEngineClient();
    expect(await client.getRelevantExperiences('u-1')).toEqual([]);
  });

  it('getMemoryContext composes past decisions and experiences', async () => {
    updateDecisionConfig({
      memory: { enabled: true, baseUrl: 'http://mem', timeoutMs: 500, retryCount: 2 },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/query')) {
          return makeFetchResponse({ results: [memoryResult] });
        }
        return makeFetchResponse({
          memories: [
            {
              memoryId: 'mem-3',
              content: 'Worked on x',
              category: 'experience',
              importance: 5,
              confidence: 0.7,
              timestamp: new Date('2026-01-01T00:00:00Z'),
            },
          ],
        });
      }),
    );
    const client = new MemoryEngineClient();
    const context = await client.getMemoryContext('dec-1', 'u-1');
    expect(context.pastDecisions).toHaveLength(1);
    expect(context.relevantExperiences).toHaveLength(1);
    expect(context.observations).toEqual(['Worked on x']);
  });
});
