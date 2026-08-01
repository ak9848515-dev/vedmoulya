// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — MockProvider unit tests
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { MockProvider } from '../MockProvider.js';

describe('MockProvider', () => {
  it('exposes name, family, and a full capability set', () => {
    const provider = new MockProvider();
    expect(provider.name).toBe('mock');
    expect(provider.family).toBe('mock');
    expect(provider.capabilities).toContain('reasoning');
    expect(provider.capabilities).toContain('coding');
    expect(provider.capabilities).toContain('vision');
    expect(provider.capabilities).toContain('embeddings');
    expect(provider.capabilities).toContain('summarization');
    expect(provider.capabilities).toContain('classification');
    expect(provider.capabilities).toContain('translation');
    expect(provider.capabilities).toContain('speech');
    expect(provider.capabilities).toContain('image_understanding');
    expect(provider.capabilities).toContain('general_conversation');
  });

  it('isHealthy resolves true', async () => {
    await expect(new MockProvider().isHealthy()).resolves.toBe(true);
  });

  it('getHealth reports a healthy mock provider', async () => {
    const health = await new MockProvider().getHealth();
    expect(health.providerId).toBe('mock');
    expect(health.status).toBe('healthy');
    expect(health.latency).toBe(50);
    expect(health.errorRate).toBe(0);
    expect(health.isRateLimited).toBe(false);
    expect(health.rateLimitRemaining).toBe(1000);
  });

  it('execute echoes the last user message with mock prefix and truncates to 50 chars', async () => {
    const provider = new MockProvider();
    const longInput = 'x'.repeat(100);
    const response = await provider.execute({
      messages: [
        { role: 'system', content: 'be helpful' },
        { role: 'user', content: longInput },
      ],
      model: 'mock-v1',
      maxTokens: 100,
    });
    expect(response.provider).toBe('mock');
    expect(response.model).toBe('mock-v1');
    expect(response.content).toBe(`Mock response to: "${'x'.repeat(50)}..."`);
    expect(response.confidence).toBe(0.85);
    expect(response.tokenUsage.input).toBe(Math.ceil(100 / 4));
    expect(response.tokenUsage.total).toBe(Math.ceil(100 / 4) + 50);
    expect(response.validation.passed).toBe(true);
    expect(response.metadata.routingDecision?.selectedProvider).toBe('mock');
    expect(response.traceId).toMatch(/^mock-/);
  });

  it('execute handles empty message list gracefully', async () => {
    const response = await new MockProvider().execute({ messages: [], model: 'mock-v1' });
    expect(response.content).toBe('Mock response to: "..."');
    expect(response.tokenUsage.input).toBe(0);
  });

  it('execute handles a message without content', async () => {
    const response = await new MockProvider().execute({
      messages: [{ role: 'user', content: '' }],
      model: 'mock-v1',
    });
    expect(response.content).toBe('Mock response to: "..."');
  });
});
