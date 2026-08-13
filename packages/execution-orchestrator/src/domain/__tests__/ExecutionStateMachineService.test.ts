// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator Tests: State Machine
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ExecutionStateMachineService } from '../services/ExecutionStateMachineService.js';
import { EXECUTION_STATES } from '../../types/orchestrator-types.js';
import type { ExecutionState, SessionCommand } from '../../types/orchestrator-types.js';

describe('ExecutionStateMachineService', () => {
  const sm = new ExecutionStateMachineService();

  it('follows the happy path created → validated → ready → running → completed', () => {
    let state: ExecutionState = 'created';
    state = sm.transition(state, { type: 'start' }) as ExecutionState; // validated
    expect(state).toBe('validated');
    state = sm.transition(state, { type: 'start' }) as ExecutionState; // ready
    expect(state).toBe('ready');
    state = sm.transition(state, { type: 'start' }) as ExecutionState; // running
    expect(state).toBe('running');
    state = sm.transition(state, { type: 'complete' }) as ExecutionState;
    expect(state).toBe('completed');
  });

  it('supports pause → resume from running', () => {
    let state: ExecutionState = 'running';
    state = sm.transition(state, { type: 'pause' }) as ExecutionState;
    expect(state).toBe('paused');
    state = sm.transition(state, { type: 'resume' }) as ExecutionState;
    expect(state).toBe('ready');
  });

  it('supports fail → retry → running', () => {
    let state: ExecutionState = 'ready';
    state = sm.transition(state, { type: 'fail', reason: 'provider down' }) as ExecutionState;
    expect(state).toBe('failed');
    state = sm.transition(state, { type: 'retry' }) as ExecutionState;
    expect(state).toBe('ready');
    state = sm.transition(state, { type: 'start' }) as ExecutionState;
    expect(state).toBe('running');
  });

  it('rejects illegal transitions', () => {
    expect(sm.can('created', { type: 'complete' })).toBe(false);
    expect(sm.can('completed', { type: 'start' })).toBe(false);
    expect(sm.can('cancelled', { type: 'resume' })).toBe(false);
    expect(sm.transition('completed', { type: 'start' })).toBeUndefined();
  });

  it('marks terminal and active states', () => {
    expect(sm.isTerminal('completed')).toBe(true);
    expect(sm.isTerminal('failed')).toBe(true);
    expect(sm.isTerminal('cancelled')).toBe(true);
    expect(sm.isTerminal('running')).toBe(false);
    expect(sm.isActive('running')).toBe(true);
    expect(sm.isActive('waiting')).toBe(true);
    expect(sm.isActive('retrying')).toBe(true);
    expect(sm.isActive('paused')).toBe(false);
  });

  it('exposes allowed commands per state', () => {
    expect(sm.allowedCommands('created')).toEqual(['start']);
    expect(sm.allowedCommands('running')).toEqual(
      expect.arrayContaining(['pause', 'cancel', 'complete', 'fail']),
    );
    expect(sm.allowedCommands('completed')).toHaveLength(0);
  });

  it('every reachable state has at least one legal command (except hard stops)', () => {
    // completed/cancelled are true dead-ends; failed stays recoverable via retry.
    const deadEnds: ExecutionState[] = ['completed', 'cancelled'];
    for (const state of EXECUTION_STATES) {
      if (deadEnds.includes(state)) {
        expect(sm.allowedCommands(state)).toHaveLength(0);
      } else {
        expect(sm.allowedCommands(state).length).toBeGreaterThan(0);
      }
    }
  });
});
