import { describe, it, expect } from 'vitest';
import { ExecutionStep } from '../entities/ExecutionStep.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';

describe('ExecutionStep', () => {
  it('creates a step with defaults', () => {
    const step = new ExecutionStep({ id: 'step_1', label: 'Step 1', description: 'Do it' });
    expect(step.id).toBe('step_1');
    expect(step.label).toBe('Step 1');
    expect(step.status.isPending).toBe(true);
    expect(step.estimatedDuration).toBe(15);
    expect(step.order).toBe(0);
  });

  it('creates a step with custom values', () => {
    const step = new ExecutionStep({
      id: 'step_2',
      label: 'Long Step',
      description: 'Takes time',
      estimatedDuration: 45,
      order: 2,
    });
    expect(step.estimatedDuration).toBe(45);
    expect(step.order).toBe(2);
  });

  it('starts execution', () => {
    const step = new ExecutionStep({ id: 's1', label: 'Start', description: 'Go' });
    step.start();
    expect(step.status.isInProgress).toBe(true);
  });

  it('completes with a result', () => {
    const step = new ExecutionStep({ id: 's2', label: 'Complete', description: 'Done' });
    step.start();
    step.complete(ExecutionResult.success('Finished'));
    expect(step.status.isCompleted).toBe(true);
    expect(step.result?.value).toBe('success');
    expect(step.result?.description).toBe('Finished');
  });

  it('fails with a reason', () => {
    const step = new ExecutionStep({ id: 's3', label: 'Fail', description: 'Broke' });
    step.fail('Error occurred');
    expect(step.status.isFailed).toBe(true);
    expect(step.result?.description).toBe('Error occurred');
  });

  it('pauses and resumes', () => {
    const step = new ExecutionStep({ id: 's4', label: 'Pause', description: 'Wait' });
    step.start();
    step.pause('Need input');
    expect(step.status.isPaused).toBe(true);
    step.resume();
    expect(step.status.isInProgress).toBe(true);
  });

  it('marks as ready', () => {
    const step = new ExecutionStep({ id: 's5', label: 'Ready', description: 'Prep' });
    expect(step.status.isPending).toBe(true);
    step.markReady();
    expect(step.status.isReady).toBe(true);
    // markReady should not change from non-pending states
    step.markReady();
    expect(step.status.isReady).toBe(true);
  });

  it('checks if completable', () => {
    const step = new ExecutionStep({ id: 's6', label: 'Check', description: 'Test' });
    expect(step.isCompletable).toBe(false);
    step.markReady();
    expect(step.isCompletable).toBe(true);
    step.start();
    expect(step.isCompletable).toBe(true);
    step.complete(ExecutionResult.success('Done'));
    expect(step.isCompletable).toBe(false);
  });

  it('returns string representation', () => {
    const step = new ExecutionStep({ id: 's7', label: 'My Step', description: 'Desc', order: 1 });
    expect(step.toString()).toContain('[1]');
    expect(step.toString()).toContain('My Step');
    expect(step.toString()).toContain('pending');
  });
});
