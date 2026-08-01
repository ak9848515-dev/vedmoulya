// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestrator Client unit tests
// BLD-005 — AI Orchestrator Integration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AIOrchestratorClient } from '../AIOrchestratorClient.js';
import { updateDecisionConfig, resetDecisionConfig } from '../../config/DecisionConfig.js';

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('AIOrchestratorClient', () => {
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
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 100,
        defaultQualityTier: 'standard',
      },
    });
    expect(new AIOrchestratorClient().isEnabled()).toBe(true);
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: false,
        baseUrl: 'http://ai',
        timeoutMs: 100,
        defaultQualityTier: 'standard',
      },
    });
    expect(new AIOrchestratorClient().isEnabled()).toBe(false);
  });

  it('returns an empty result without calling fetch when disabled', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: false,
        baseUrl: 'http://ai',
        timeoutMs: 100,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal('fetch', vi.fn());
    const client = new AIOrchestratorClient();
    const result = await client.requestReasoning({
      capability: 'reasoning',
      userInput: 'x',
      context: { userId: 'u-1' },
    } as never);
    expect(result).toEqual({ content: '', confidence: 0, provider: 'none', traceId: '' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns the parsed reasoning result on success', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          content: 'Analysis',
          confidence: 0.9,
          provider: 'openai',
          traceId: 'trace-1',
        }),
      ),
    );
    const client = new AIOrchestratorClient();
    const result = await client.requestReasoning({
      capability: 'reasoning',
      userInput: 'x',
      context: { userId: 'u-1' },
      qualityTier: 'premium',
    } as never);
    expect(result).toEqual({
      content: 'Analysis',
      confidence: 0.9,
      provider: 'openai',
      traceId: 'trace-1',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('falls back to empty when the orchestrator returns a non-ok status', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({}, false, 500)));
    const client = new AIOrchestratorClient();
    const result = await client.requestReasoning({
      capability: 'reasoning',
      userInput: 'x',
      context: { userId: 'u-1' },
    } as never);
    expect(result).toEqual({ content: '', confidence: 0, provider: 'none', traceId: '' });
  });

  it('falls back to empty when fetch throws', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const client = new AIOrchestratorClient();
    const result = await client.requestReasoning({
      capability: 'reasoning',
      userInput: 'x',
      context: { userId: 'u-1' },
    } as never);
    expect(result).toEqual({ content: '', confidence: 0, provider: 'none', traceId: '' });
  });

  it('parses bullet options from the AI response', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          content: '- Option A\n* Option B\n1. Option C\nnot an option',
          confidence: 0.9,
          provider: 'openai',
          traceId: 't',
        }),
      ),
    );
    const client = new AIOrchestratorClient();
    const options = await client.generateOptions({ userId: 'u-1' });
    expect(options).toEqual(['Option A', 'Option B', 'Option C']);
  });

  it('returns no options for low-confidence or empty content', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeFetchResponse({ content: '', confidence: 0.1, provider: 'none', traceId: '' }),
        ),
    );
    const client = new AIOrchestratorClient();
    expect(await client.generateOptions({ userId: 'u-1' })).toEqual([]);
  });

  it('returns the explanation when confidence is adequate', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFetchResponse({
          content: 'Clear explanation',
          confidence: 0.8,
          provider: 'openai',
          traceId: 't',
        }),
      ),
    );
    const client = new AIOrchestratorClient();
    expect(await client.generateExplanation({ decisionId: 'dec-1' })).toBe('Clear explanation');
  });

  it('returns empty explanation for low confidence', async () => {
    updateDecisionConfig({
      aiOrchestrator: {
        enabled: true,
        baseUrl: 'http://ai',
        timeoutMs: 500,
        defaultQualityTier: 'standard',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          makeFetchResponse({ content: 'Meh', confidence: 0.2, provider: 'none', traceId: '' }),
        ),
    );
    const client = new AIOrchestratorClient();
    expect(await client.generateExplanation({ decisionId: 'dec-1' })).toBe('');
  });
});
