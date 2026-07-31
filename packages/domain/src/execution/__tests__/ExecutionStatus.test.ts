import { describe, it, expect } from 'vitest';
import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';

describe('ExecutionStatus', () => {
  it('creates a pending status', () => {
    const s = ExecutionStatus.pending();
    expect(s.value).toBe('pending');
    expect(s.isPending).toBe(true);
    expect(s.isTerminal).toBe(false);
  });

  it('creates a completed status', () => {
    const s = ExecutionStatus.completed();
    expect(s.value).toBe('completed');
    expect(s.isCompleted).toBe(true);
    expect(s.isTerminal).toBe(true);
  });

  it('creates a failed status', () => {
    const s = ExecutionStatus.failed('Out of time');
    expect(s.value).toBe('failed');
    expect(s.isFailed).toBe(true);
    expect(s.isTerminal).toBe(true);
  });

  it('creates a cancelled status', () => {
    const s = ExecutionStatus.cancelled('No longer needed');
    expect(s.value).toBe('cancelled');
    expect(s.isCancelled).toBe(true);
    expect(s.isTerminal).toBe(true);
  });

  it('validates transitions from pending', () => {
    const s = ExecutionStatus.pending();
    expect(s.canTransitionTo('ready')).toBe(true);
    expect(s.canTransitionTo('cancelled')).toBe(true);
    expect(s.canTransitionTo('completed')).toBe(false);
    expect(s.canTransitionTo('in_progress')).toBe(false);
  });

  it('validates transitions from in_progress', () => {
    const s = ExecutionStatus.inProgress();
    expect(s.canTransitionTo('completed')).toBe(true);
    expect(s.canTransitionTo('paused')).toBe(true);
    expect(s.canTransitionTo('failed')).toBe(true);
    expect(s.canTransitionTo('cancelled')).toBe(true);
    expect(s.canTransitionTo('ready')).toBe(false);
  });

  it('blocks transitions from terminal states', () => {
    const completed = ExecutionStatus.completed();
    expect(completed.canTransitionTo('in_progress')).toBe(false);
    expect(completed.canTransitionTo('paused')).toBe(false);

    const failed = ExecutionStatus.failed('test');
    expect(failed.canTransitionTo('in_progress')).toBe(false);
  });

  it('creates from status string', () => {
    const s = ExecutionStatus.fromStatus('in_progress');
    expect(s.value).toBe('in_progress');
    expect(s.isInProgress).toBe(true);
  });

  it('creates from status string with reason', () => {
    const s = ExecutionStatus.fromStatus('paused', 'Waiting for input');
    expect(s.value).toBe('paused');
    expect(s.reason).toBe('Waiting for input');
  });

  it('compares equality', () => {
    const a = ExecutionStatus.pending();
    const b = ExecutionStatus.pending();
    const c = ExecutionStatus.inProgress();
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('returns string representation', () => {
    const s = ExecutionStatus.inProgress();
    expect(s.toString()).toBe('in_progress');
  });

  it('identifies ready state', () => {
    const s = ExecutionStatus.ready();
    expect(s.isReady).toBe(true);
  });

  it('identifies blocked state', () => {
    const s = ExecutionStatus.blocked('Waiting on dependency');
    expect(s.isBlocked).toBe(true);
  });

  it('identifies skipped state', () => {
    const s = ExecutionStatus.skipped();
    expect(s.isSkipped).toBe(true);
  });
});
