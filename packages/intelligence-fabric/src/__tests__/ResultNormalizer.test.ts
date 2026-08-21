import { describe, expect, it } from 'vitest';
import { normalizeResult } from '../domain/ResultNormalizer.js';

describe('ResultNormalizer', () => {
  it('normalizes a text response', () => {
    const result = normalizeResult({
      text: 'Hello',
      providerId: 'openai',
      modelId: 'gpt-4o',
      latencyMs: 12,
    });
    expect(result.kind).toBe('text');
    expect(result.text).toBe('Hello');
    expect(result.providerId).toBe('openai');
  });

  it('normalizes structured data', () => {
    const result = normalizeResult({ data: { answer: 42 } });
    expect(result.kind).toBe('structured');
    expect(result.data).toEqual({ answer: 42 });
  });

  it('normalizes tool calls', () => {
    const result = normalizeResult({ toolCall: { name: 'search', arguments: { q: 'ai market' } } });
    expect(result.kind).toBe('tool');
    expect(result.toolCall?.name).toBe('search');
  });

  it('normalizes errors and redacts secrets from messages', () => {
    const result = normalizeResult({
      error: { code: 'AUTH_ERROR', message: 'Invalid api_key=sk-12345 in Authorization header' },
    });
    expect(result.kind).toBe('error');
    expect(result.error?.code).toBe('AUTH_ERROR');
    expect(result.error?.message).toContain('[REDACTED]');
    expect(result.error?.message).not.toContain('sk-12345');
  });

  it('carries cost/usage/confidence only when explicitly reported', () => {
    const withCost = normalizeResult({
      text: 'x',
      costUsd: 0.001,
      usage: { totalTokens: 100 },
      confidence: 0.9,
    });
    expect(withCost.costUsd).toBe(0.001);
    expect(withCost.usage?.totalTokens).toBe(100);
    expect(withCost.confidence).toBe(0.9);

    const without = normalizeResult({ text: 'x' });
    expect(without.costUsd).toBeUndefined();
    expect(without.usage).toBeUndefined();
    expect(without.confidence).toBeUndefined();
  });

  it('preserves extra metadata without leaking provider internals', () => {
    const result = normalizeResult({
      text: 'x',
      extraMetadata: { providerVersion: '1.0', cached: true },
    });
    expect(result.metadata.providerVersion).toBe('1.0');
    expect(result.metadata.cached).toBe(true);
  });
});
