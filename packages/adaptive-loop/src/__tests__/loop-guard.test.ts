// ──────────────────────────────────────────────────────────────────
// Loop guard tests (PHASE 10/11):
//   hard budget ceilings (never ask the model again when exhausted),
//   deterministic repetition detection.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  checkLoopBudgets,
  detectLoop,
  fingerprintAction,
  fingerprintDecision,
  freshUsage,
  hashArguments,
} from '../domain/loop-guard.js';
import { DEFAULT_ADAPTIVE_LOOP_BUDGETS } from '../types/adaptive-loop-types.js';
import { FakeClock } from './fixtures.js';

const clock = new FakeClock();

function stateWith(
  usage: ReturnType<typeof freshUsage>,
  overrides: Partial<typeof DEFAULT_ADAPTIVE_LOOP_BUDGETS> = {},
) {
  return {
    usage,
    budgets: { ...DEFAULT_ADAPTIVE_LOOP_BUDGETS, ...overrides },
    startedAtMs: clock.timestampMs(),
  };
}

describe('loop budgets — every exhaustion stops the run with an explicit reason', () => {
  it('allows a run under every ceiling', () => {
    const verdict = checkLoopBudgets(stateWith(freshUsage()), clock);
    expect(verdict.ok).toBe(true);
  });

  it('stops at the decision-iteration ceiling', () => {
    const usage = freshUsage();
    usage.decisionIterations = 40;
    const verdict = checkLoopBudgets(stateWith(usage), clock);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe('DECISION_LOOP_BUDGET_EXCEEDED');
  });

  it('stops at the action ceiling', () => {
    const usage = freshUsage();
    usage.attempts = 24;
    const verdict = checkLoopBudgets(stateWith(usage), clock);
    if (!verdict.ok) expect(verdict.reason).toBe('ACTION_BUDGET_EXCEEDED');
  });

  it('stops at the tool-call ceiling', () => {
    const usage = freshUsage();
    usage.toolCalls = 8;
    const verdict = checkLoopBudgets(stateWith(usage), clock);
    if (!verdict.ok) expect(verdict.reason).toBe('TOOL_CALL_BUDGET_EXCEEDED');
  });

  it('stops at the token and cost ceilings', () => {
    const tokens = freshUsage();
    tokens.tokensUsed = 64_000;
    const tokenVerdict = checkLoopBudgets(stateWith(tokens), clock);
    if (!tokenVerdict.ok) expect(tokenVerdict.reason).toBe('TOKEN_BUDGET_EXCEEDED');

    const cost = freshUsage();
    cost.costUsd = 1.0;
    const costVerdict = checkLoopBudgets(stateWith(cost), clock);
    if (!costVerdict.ok) expect(costVerdict.reason).toBe('COST_BUDGET_EXCEEDED');
  });

  it('stops at the wall-clock ceiling (deterministic via the clock)', () => {
    clock.advance(400_000);
    const verdict = checkLoopBudgets(stateWith(freshUsage()), clock);
    if (!verdict.ok) expect(verdict.reason).toBe('WALL_CLOCK_BUDGET_EXCEEDED');
  });

  it('stops after too many abstentions — never guesses', () => {
    const usage = freshUsage();
    usage.abstains = 3;
    const verdict = checkLoopBudgets(stateWith(usage), clock);
    if (!verdict.ok) expect(verdict.reason).toBe('ABSTAIN_LIMIT_EXCEEDED');
  });
});

describe('loop detection — deterministic repetition', () => {
  it('does not fire on a single action or on changing actions', () => {
    const usage = freshUsage();
    expect(detectLoop(usage, 'a', 3).looped).toBe(false);
    expect(detectLoop(usage, 'b', 3).looped).toBe(false);
  });

  it('fires when the same action repeats beyond the threshold', () => {
    const usage = freshUsage();
    const fp = fingerprintAction({
      kind: 'TOOL_CALL',
      stepId: 's1',
      toolName: 'run.tests',
      argumentsHash: '{}',
    });
    detectLoop(usage, fp, 3);
    detectLoop(usage, fp, 3);
    const third = detectLoop(usage, fp, 3);
    expect(third.looped).toBe(true);
    expect(third.repeated).toBe(3);
  });

  it('resets when the model proposes something different', () => {
    const usage = freshUsage();
    const a = fingerprintDecision({ kind: 'TOOL_CALL', stepId: 's1', tool: 'run.tests' });
    const b = fingerprintDecision({ kind: 'AI_ACTION', stepId: 's1', capability: 'coding' });
    detectLoop(usage, a, 3);
    detectLoop(usage, b, 3);
    detectLoop(usage, a, 3);
    expect(usage.actionFingerprints).toHaveLength(3);
  });

  it('hashes tool arguments deterministically', () => {
    expect(hashArguments({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
    expect(hashArguments(undefined)).toBeUndefined();
    expect(hashArguments({})).toBeUndefined();
  });

  it('stops at the wall-clock ceiling', () => {
    const wallClock = new FakeClock();
    const state = {
      usage: freshUsage(),
      budgets: { ...DEFAULT_ADAPTIVE_LOOP_BUDGETS },
      startedAtMs: wallClock.timestampMs(),
    };
    wallClock.advance(300_000); // == maxWallClockMs
    const verdict = checkLoopBudgets(state, wallClock);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toBe('WALL_CLOCK_BUDGET_EXCEEDED');
      expect(verdict.detail).toContain('wall-clock');
    }
  });

  it('reports unserializable tool arguments instead of throwing', () => {
    expect(hashArguments({ bad: BigInt(1) })).toBe('unserializable');
  });

  it('counts consecutive repeats only until the fingerprint stream diverges', () => {
    const usage = freshUsage();
    // a, b, a then a again: the final scan must stop at the divergent `b`
    // (the `else break` guard) rather than scanning the whole history.
    detectLoop(usage, 'a', 5);
    detectLoop(usage, 'b', 5);
    detectLoop(usage, 'a', 5);
    const third = detectLoop(usage, 'a', 5);
    expect(third.looped).toBe(false);
    expect(third.repeated).toBe(2);
    expect(usage.actionFingerprints).toEqual(['a', 'b', 'a', 'a']);
  });
});
