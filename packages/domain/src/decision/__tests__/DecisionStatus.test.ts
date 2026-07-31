import { describe, it, expect } from 'vitest';
import { DecisionStatus } from '../value-objects/DecisionStatus.js';

describe('DecisionStatus', () => {
  it('creates requested status', () => {
    const status = DecisionStatus.requested();
    expect(status.toString()).toBe('requested');
  });

  it('transitions from requested to analyzing', () => {
    const status = DecisionStatus.fromStatus('requested');
    expect(status.canTransitionTo('analyzing')).toBe(true);
  });

  it('includes reason in toString when provided', () => {
    const status = DecisionStatus.fromStatus('decided', 'selected best option');
    expect(status.toString()).toBe('decided (selected best option)');
  });

  it('rejects invalid transitions', () => {
    const status = DecisionStatus.fromStatus('requested');
    expect(status.canTransitionTo('completed')).toBe(false);
  });

  it('all lifecycle transitions are valid', () => {
    const transitions: Array<[string, string, boolean]> = [
      ['requested', 'analyzing', true],
      ['requested', 'cancelled', true],
      ['analyzing', 'evaluating', true],
      ['evaluating', 'decided', true],
      ['decided', 'implementing', true],
      ['implementing', 'completed', true],
      ['completed', 'reviewed', true],
      ['reviewed', 'archived', true],
      ['completed', 'archived', true],
      ['archived', 'cancelled', false],
      ['requested', 'completed', false],
      ['requested', 'archived', false],
    ];
    for (const [from, to, expected] of transitions) {
      const status = DecisionStatus.fromStatus(from);
      expect(status.canTransitionTo(to as never)).toBe(expected);
    }
  });

  it('terminal states are archived, completed, reviewed, cancelled', () => {
    expect(DecisionStatus.fromStatus('archived').isTerminal).toBe(true);
    expect(DecisionStatus.fromStatus('completed').isTerminal).toBe(true);
    expect(DecisionStatus.fromStatus('requested').isTerminal).toBe(false);
  });

  it('active states are not archived or cancelled', () => {
    expect(DecisionStatus.fromStatus('requested').isActive).toBe(true);
    expect(DecisionStatus.fromStatus('archived').isActive).toBe(false);
    expect(DecisionStatus.fromStatus('cancelled').isActive).toBe(false);
  });
});
