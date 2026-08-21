import { describe, expect, it } from 'vitest';
import { SelectionStrategy } from '../domain/SelectionStrategy.js';
import type { StrategyCandidate } from '../types/fabric-types.js';

function candidate(
  overrides: Partial<StrategyCandidate> & { providerId: string; name: string },
): StrategyCandidate {
  return {
    capabilityMatched: true,
    evidence: ['registry evidence'],
    ...overrides,
  };
}

describe('SelectionStrategy', () => {
  const strategy = new SelectionStrategy();

  it('excludes candidates that do not match the capability', () => {
    const result = strategy.rank({
      strategy: 'QUALITY',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({ providerId: 'openai', name: 'OpenAI', quality: 0.9 }),
        candidate({ providerId: 'ollama', name: 'Ollama', capabilityMatched: false }),
      ],
    });
    expect(result.selected?.providerId).toBe('openai');
    expect(result.reasons.join(' ')).toContain('no capability match');
  });

  it('excludes observed UNAVAILABLE/MISCONFIGURED providers', () => {
    const result = strategy.rank({
      strategy: 'QUALITY',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({
          providerId: 'openai',
          name: 'OpenAI',
          quality: 0.95,
          healthState: 'UNAVAILABLE',
        }),
        candidate({
          providerId: 'deepseek',
          name: 'DeepSeek',
          quality: 0.8,
          healthState: 'HEALTHY',
        }),
      ],
    });
    expect(result.selected?.providerId).toBe('deepseek');
    expect(result.reasons.join(' ')).toContain('UNAVAILABLE/MISCONFIGURED');
  });

  it('PRIVATE overrides cost — only privacy-safe candidates are eligible', () => {
    const result = strategy.rank({
      strategy: 'CHEAP',
      taskPrivacy: 'PRIVATE',
      candidates: [
        candidate({
          providerId: 'free-api',
          name: 'Free API',
          estimatedCostUsd: 0,
          privacyClass: 'PUBLIC',
        }),
        candidate({
          providerId: 'ollama',
          name: 'Ollama',
          estimatedCostUsd: 0,
          localAvailability: 'yes',
          privacyClass: 'PRIVATE',
        }),
      ],
    });
    expect(result.selected?.providerId).toBe('ollama');
    expect(result.reasons.join(' ')).toContain('privacy overrides cost');
  });

  it('CHEAP prefers local > free > free-with-quota > paid', () => {
    const result = strategy.rank({
      strategy: 'CHEAP',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({ providerId: 'paid', name: 'Paid', estimatedCostUsd: 1 }),
        candidate({
          providerId: 'free-api',
          name: 'Free API',
          estimatedCostUsd: 0,
          freeAvailability: 'FREE',
        }),
        candidate({
          providerId: 'ollama',
          name: 'Ollama',
          estimatedCostUsd: 0,
          localAvailability: 'yes',
        }),
      ],
    });
    expect(result.selected?.providerId).toBe('ollama');
    expect(result.reasons.join(' ')).toContain('local');
  });

  it('FAST prefers the lowest latency and explains it', () => {
    const result = strategy.rank({
      strategy: 'FAST',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({ providerId: 'a', name: 'A', latencyMs: 900, estimatedCostUsd: 0.01 }),
        candidate({ providerId: 'b', name: 'B', latencyMs: 120, estimatedCostUsd: 0.05 }),
      ],
    });
    expect(result.selected?.providerId).toBe('b');
    expect(result.reasons.join(' ')).toContain('120ms');
  });

  it('QUALITY prefers the highest quality evidence', () => {
    const result = strategy.rank({
      strategy: 'QUALITY',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({ providerId: 'cheap', name: 'Cheap', quality: 0.5, estimatedCostUsd: 0 }),
        candidate({ providerId: 'best', name: 'Best', quality: 0.95, estimatedCostUsd: 1 }),
      ],
    });
    expect(result.selected?.providerId).toBe('best');
  });

  it('BALANCED combines quality/availability/cost/latency', () => {
    const result = strategy.rank({
      strategy: 'BALANCED',
      taskPrivacy: 'PUBLIC',
      candidates: [
        candidate({
          providerId: 'a',
          name: 'A',
          quality: 0.5,
          availability: 0.5,
          estimatedCostUsd: 1,
          latencyMs: 1000,
        }),
        candidate({
          providerId: 'b',
          name: 'B',
          quality: 0.9,
          availability: 0.9,
          estimatedCostUsd: 0.05,
          latencyMs: 200,
        }),
      ],
    });
    expect(result.selected?.providerId).toBe('b');
    expect(result.reasons.join(' ')).toContain('balanced score');
  });

  it('returns no selection with an honest reason when nothing is eligible', () => {
    const result = strategy.rank({
      strategy: 'QUALITY',
      taskPrivacy: 'PUBLIC',
      candidates: [candidate({ providerId: 'x', name: 'X', capabilityMatched: false })],
    });
    expect(result.selected).toBeUndefined();
    expect(result.ranked).toEqual([]);
    expect(result.reasons.join(' ')).toContain('No eligible candidate');
  });
});
