import { describe, expect, it } from 'vitest';
import { GoalLifecycleService } from '../services/GoalLifecycleService.js';

describe('GoalLifecycleService', () => {
  const machine = new GoalLifecycleService();

  it('follows the happy path proposed → scored → accepted → active → completed → archived', () => {
    let status: ReturnType<GoalLifecycleService['transition']> = 'proposed';
    status = machine.transition(status, { type: 'score' });
    expect(status).toBe('scored');
    status = machine.transition(status, { type: 'accept' });
    expect(status).toBe('accepted');
    status = machine.transition(status, { type: 'activate' });
    expect(status).toBe('active');
    status = machine.transition(status, { type: 'complete' });
    expect(status).toBe('completed');
    status = machine.transition(status, { type: 'archive' });
    expect(status).toBe('archived');
  });

  it('supports active ⇄ blocked resumption', () => {
    let status: ReturnType<GoalLifecycleService['transition']> = 'active';
    status = machine.transition(status, { type: 'block', reason: 'awaiting budget' });
    expect(status).toBe('blocked');
    status = machine.transition(status, { type: 'unblock' });
    expect(status).toBe('active');
  });

  it('supports cancellation then archival', () => {
    let status: ReturnType<GoalLifecycleService['transition']> = 'proposed';
    status = machine.transition(status, { type: 'cancel', reason: 'scope dropped' });
    expect(status).toBe('cancelled');
    status = machine.transition(status, { type: 'archive' });
    expect(status).toBe('archived');
  });

  it('rejects illegal transitions', () => {
    expect(() => machine.transition('proposed', { type: 'complete' })).toThrow();
    expect(() => machine.transition('completed', { type: 'accept' })).toThrow();
    expect(() => machine.transition('scored', { type: 'block', reason: 'x' })).toThrow();
    expect(() => machine.transition('archived', { type: 'archive' })).toThrow();
  });

  it('reports active and terminal states', () => {
    expect(machine.isActive('active')).toBe(true);
    expect(machine.isActive('blocked')).toBe(true);
    expect(machine.isActive('completed')).toBe(false);
    expect(machine.isTerminal('completed')).toBe(true);
    expect(machine.isTerminal('archived')).toBe(true);
    expect(machine.isTerminal('active')).toBe(false);
  });
});
