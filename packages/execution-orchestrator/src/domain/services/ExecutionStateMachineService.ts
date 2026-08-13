// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Session State Machine
// EI-005 — Enterprise Execution Orchestrator
// Owns the legal session state transitions (created → validated →
// ready → running → … → completed/failed/cancelled) and enforces
// guards. Pure state logic — no side effects, no AI execution.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionState, SessionCommand } from '../../types/orchestrator-types.js';

const TRANSITIONS: Record<
  ExecutionState,
  Partial<Record<SessionCommand['type'], ExecutionState>>
> = {
  created: { start: 'validated' },
  validated: { start: 'ready', fail: 'failed' },
  ready: { start: 'running', pause: 'paused', cancel: 'cancelled', fail: 'failed' },
  running: { pause: 'paused', cancel: 'cancelled', fail: 'failed', complete: 'completed' },
  waiting: { start: 'running', pause: 'paused', cancel: 'cancelled', fail: 'failed' },
  paused: { resume: 'ready', cancel: 'cancelled', fail: 'failed' },
  retrying: { start: 'running', fail: 'failed', cancel: 'cancelled' },
  completed: {},
  failed: { retry: 'ready', start: 'running' },
  cancelled: {},
};

export class ExecutionStateMachineService {
  /** The target state for a command from a given state (undefined = illegal). */
  transition(from: ExecutionState, command: SessionCommand): ExecutionState | undefined {
    const byCommand = TRANSITIONS[from];
    return byCommand[command.type];
  }

  can(from: ExecutionState, command: SessionCommand): boolean {
    return this.transition(from, command) !== undefined;
  }

  isTerminal(state: ExecutionState): boolean {
    return state === 'completed' || state === 'failed' || state === 'cancelled';
  }

  isActive(state: ExecutionState): boolean {
    return state === 'running' || state === 'waiting' || state === 'retrying';
  }

  /** Legal command types from a given state (for UI affordances). */
  allowedCommands(from: ExecutionState): SessionCommand['type'][] {
    const byCommand = TRANSITIONS[from];
    return Object.keys(byCommand) as SessionCommand['type'][];
  }
}
