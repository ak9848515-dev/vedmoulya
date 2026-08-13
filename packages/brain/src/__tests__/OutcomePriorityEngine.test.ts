// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · OutcomePriorityEngine tests
// EPIC-020 (Outcome & Revenue layer) — mission §2.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { OutcomePriorityEngine, type RankableAction } from '../domain/OutcomePriorityEngine.js';

function action(
  overrides: Partial<RankableAction> & { id: string; title: string },
): RankableAction {
  return {
    category: 'PROBLEM',
    priority: 'MEDIUM',
    whyItMatters: ['test'],
    recommendedNextAction: 'act',
    source: { kind: 'task', id: 't1' },
    ...overrides,
  };
}

describe('OutcomePriorityEngine', () => {
  const engine = new OutcomePriorityEngine();

  it('ranks urgent money opportunities above routine tasks', () => {
    const result = engine.rank(
      [
        action({
          id: 'routine',
          title: 'Routine maintenance',
          category: 'PRODUCT',
          priority: 'LOW',
          quality: 0.4,
          impact: 0.2,
        }),
        action({
          id: 'earning',
          title: 'Client invoice follow-up',
          category: 'EARNING',
          priority: 'HIGH',
          quality: 0.7,
          impact: 0.9,
          moneyValue: {
            category: 'MONEY',
            label: '$500 invoice',
            status: 'KNOWN',
            amount: 500,
            unit: 'USD',
          },
        }),
      ],
      5,
    );
    expect(result[0]?.id).toBe('earning');
    expect(result[0]?.factorBreakdown.length).toBeGreaterThan(5);
    // Transparency: factor breakdown exposes weights + signals.
    const money = result[0]?.factorBreakdown.find((f) => f.factor === 'money');
    expect(money?.signal).toBe(0.9);
  });

  it('never lets price outrank quality (quality > cost invariant)', () => {
    const result = engine.rank(
      [
        action({
          id: 'free-low-quality',
          title: 'Free but weak tool',
          priority: 'MEDIUM',
          costClass: 'free',
          quality: 0.3,
          evidence: 0.2,
        }),
        action({
          id: 'paid-high-quality',
          title: 'Paid but materially better',
          priority: 'MEDIUM',
          costClass: 'paid',
          quality: 0.95,
          evidence: 0.9,
        }),
      ],
      5,
    );
    expect(result[0]?.id).toBe('paid-high-quality');
    const freeScore = result.find((r) => r.id === 'free-low-quality');
    const paidScore = result.find((r) => r.id === 'paid-high-quality');
    expect(paidScore?.priorityScore ?? 0).toBeGreaterThan(freeScore?.priorityScore ?? 1);
  });

  it('prefers free when quality evidence is equivalent', () => {
    const result = engine.rank(
      [
        action({ id: 'paid', title: 'Paid equivalent', costClass: 'paid', quality: 0.6 }),
        action({ id: 'free', title: 'Free equivalent', costClass: 'free', quality: 0.6 }),
      ],
      5,
    );
    expect(result[0]?.id).toBe('free');
  });

  it('does not invent money/time value from UNKNOWN signals', () => {
    const result = engine.rank(
      [
        action({
          id: 'unknown-value',
          title: 'Unknown value task',
          moneyValue: { category: 'MONEY', label: 'unknown', status: 'UNKNOWN' },
          timeValue: { category: 'TIME', label: 'unknown', status: 'UNKNOWN' },
        }),
      ],
      5,
    );
    const money = result[0]?.factorBreakdown.find((f) => f.factor === 'money');
    expect(money?.signal).toBe(0);
    const time = result[0]?.factorBreakdown.find((f) => f.factor === 'time');
    expect(time?.signal).toBe(0);
  });

  it('honors limit (Today Top N)', () => {
    const result = engine.rank(
      Array.from({ length: 8 }, (_, i) =>
        action({ id: `a${i}`, title: `Action ${i}`, priority: i % 2 === 0 ? 'HIGH' : 'LOW' }),
      ),
      3,
    );
    expect(result.length).toBe(3);
  });
});
