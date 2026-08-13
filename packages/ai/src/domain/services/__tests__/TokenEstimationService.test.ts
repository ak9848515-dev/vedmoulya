// ──────────────────────────────────────────────────────────────────
// VedMoulya — TokenEstimationService unit tests
// AI-RUNTIME-001 — deterministic token estimation & budget checks
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { TokenEstimationService } from '../TokenEstimationService.js';

describe('TokenEstimationService', () => {
  it('estimates tokens at ~4 characters per token', () => {
    expect(TokenEstimationService.estimateTokens('')).toBe(0);
    expect(TokenEstimationService.estimateTokens('abcd')).toBe(1);
    expect(TokenEstimationService.estimateTokens('a'.repeat(9))).toBe(3); // ceil(9/4)
    expect(
      TokenEstimationService.estimateTokens('This is a longer English sentence for estimation.'),
    ).toBeGreaterThan(10);
  });

  it('includes per-message overhead and priming tokens for message lists', () => {
    const messages = [
      { role: 'system', content: 'be helpful' }, // 10 chars → 3 tokens
      { role: 'user', content: 'hi' }, // 2 chars → 1 token
    ];
    // (4 + 3) + (4 + 1) + 2 priming = 14
    expect(TokenEstimationService.estimateMessagesTokens(messages)).toBe(14);
  });

  it('estimates input cost from tokens and per-token pricing', () => {
    expect(TokenEstimationService.estimateInputCost(1000, 0.00001)).toBeCloseTo(0.01, 5);
    expect(TokenEstimationService.estimateInputCost(0, 0.5)).toBe(0);
  });

  it('is deterministic across calls', () => {
    const messages = [{ role: 'user', content: 'Analyze the ABAP code.' }];
    const first = TokenEstimationService.estimateMessagesTokens(messages);
    const second = TokenEstimationService.estimateMessagesTokens(messages);
    expect(first).toBe(second);
  });
});
