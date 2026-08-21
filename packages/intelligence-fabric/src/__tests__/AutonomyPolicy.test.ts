import { describe, expect, it } from 'vitest';
import { AutonomyPolicy } from '../domain/AutonomyPolicy.js';

describe('AutonomyPolicy', () => {
  const policy = new AutonomyPolicy();

  it('blocks class D (never automate) at every level', () => {
    const decision = policy.gate({
      currentLevel: 5,
      action: 'Permanently delete-account and erase all data',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.actionClass).toBe('D');
    expect(decision.reasons[0]).toContain('never automate');
  });

  it('blocks class C below level 3 and asks at level 3 (approval still required)', () => {
    const low = policy.gate({ currentLevel: 2, action: 'Publish the report to the website' });
    expect(low.allowed).toBe(false);
    expect(low.actionClass).toBe('C');
    expect(low.requiredLevel).toBe(3);

    const ask = policy.gate({ currentLevel: 3, action: 'Publish the report to the website' });
    expect(ask.allowed).toBe(true);
    expect(ask.reasons.join(' ')).toContain('existing approval authority');
  });

  it('blocks class B without an explicit user authorization record (level never grants it)', () => {
    const noAuth = policy.gate({ currentLevel: 5, action: 'Prepare the monthly sales report' });
    expect(noAuth.allowed).toBe(false);
    expect(noAuth.actionClass).toBe('B');
    expect(noAuth.reasons[0]).toContain('explicit user authorization record');

    const withAuth = policy.gate({
      currentLevel: 4,
      action: 'Prepare the monthly sales report',
      userAuthorization: {
        id: 'auth-1',
        grantedAt: '2026-08-14T00:00:00.000Z',
        scope: 'monthly-report',
      },
    });
    expect(withAuth.allowed).toBe(true);
    expect(withAuth.reasons.join(' ')).toContain('Explicit user authorization auth-1 present.');
  });

  it('blocks class A below level 4 and allows it at level 4', () => {
    const low = policy.gate({ currentLevel: 2, action: 'Summarize this document' });
    expect(low.allowed).toBe(false);
    expect(low.requiredLevel).toBe(4);

    const ok = policy.gate({ currentLevel: 4, action: 'Summarize this document' });
    expect(ok.allowed).toBe(true);
    expect(ok.actionClass).toBe('A');
  });

  it('never jumps more than one autonomy level', () => {
    expect(policy.nextLevel(0, 3)).toBe(1);
    expect(policy.nextLevel(2, 5)).toBe(3);
    expect(policy.nextLevel(3, 3)).toBe(3);
    expect(policy.nextLevel(3, 2)).toBe(3);
  });

  it('exposes human-readable level names', () => {
    expect(policy.levelName(0)).toBe('Observe');
    expect(policy.levelName(5)).toContain('Continuous');
  });
});
