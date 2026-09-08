// ──────────────────────────────────────────────────────────────────
// Goal Understanding — deterministic normalization, explicit unknowns,
// clarification detection, budget/autonomy merging.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { GoalUnderstandingService } from '../domain/goal-understanding.js';

const service = new GoalUnderstandingService();

describe('GoalUnderstandingService', () => {
  it('normalizes a raw goal deterministically', () => {
    const understanding = service.derive({ goal: '  Fix   the failing tests   ' });
    expect(understanding.normalizedGoal).toBe('Fix the failing tests');
    expect(understanding.rawGoal).toBe('Fix   the failing tests');
    expect(understanding.derivationReasons.length).toBeGreaterThan(0);
  });

  it('infers coding + reasoning capabilities for a repository fix goal', () => {
    const understanding = service.derive({
      goal: 'Analyze this repository and fix the failing tests',
    });
    expect(understanding.requiredCapabilities).toContain('coding');
    expect(understanding.requiredCapabilities).toContain('reasoning');
    expect(understanding.primaryCapability).toBeDefined();
    expect(understanding.expectedOutcome).toContain('failing tests fixed');
  });

  it('preserves MULTI-capability requirements in full (never reduced)', () => {
    const understanding = service.derive({
      goal: 'Fix the failing tests and write a summary of the results',
    });
    const caps = new Set(understanding.requiredCapabilities);
    expect(caps.has('coding')).toBe(true);
    expect(caps.has('content_generation')).toBe(true);
    expect(caps.has('summarization')).toBe(true);
  });

  it('represents unknown capabilities explicitly instead of inventing them', () => {
    const understanding = service.derive({ goal: 'I need to take care of a personal matter' });
    expect(understanding.primaryCapability).toBeUndefined();
    expect(understanding.unknownAspects.some((a) => a.includes('capability'))).toBe(true);
  });

  it('merges explicit budget over the frozen defaults', () => {
    const understanding = service.derive({
      goal: 'Fix the failing tests in the repository',
      constraints: { budget: { maxCostUsd: 0.5, maxToolCalls: 3 } },
    });
    expect(understanding.budget.maxCostUsd).toBe(0.5);
    expect(understanding.budget.maxToolCalls).toBe(3);
    // Unspecified fields keep the frozen defaults.
    expect(understanding.budget.maxTokens).toBe(64_000);
  });

  it('honors explicit autonomy and defaults to SUPERVISED otherwise', () => {
    const explicit = service.derive({
      goal: 'Fix the failing tests in the repository',
      constraints: { autonomyLevel: 'CONTROLLED_AUTONOMOUS' },
    });
    expect(explicit.autonomyLevel).toBe('CONTROLLED_AUTONOMOUS');
    const defaulted = service.derive({ goal: 'Fix the failing tests in the repository' });
    expect(defaulted.autonomyLevel).toBe('SUPERVISED');
  });

  it('asks for clarification on underspecified goals (never guesses)', () => {
    const short = service.derive({ goal: 'do stuff' });
    expect(short.clarificationNeeded).toBeDefined();
    const placeholder = service.derive({
      goal: 'Write a plan for the project, you decide the rest',
    });
    expect(placeholder.clarificationNeeded).toBeDefined();
  });

  it('derives verification expectations when inferable', () => {
    const understanding = service.derive({ goal: 'Fix the failing tests in the repository' });
    expect(understanding.verificationExpectations.some((v) => v.includes('tests pass'))).toBe(true);
  });

  it('throws on empty goals', () => {
    expect(() => service.derive({ goal: '  ' })).toThrow();
  });
});
