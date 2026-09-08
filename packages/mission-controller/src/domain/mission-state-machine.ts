/* eslint-disable security/detect-object-injection */
import type { MissionState, MissionCommand } from '../types/mission-types.js';
export type { MissionCommand };

type TransitionMap = Partial<Record<MissionCommand['type'], MissionState>>;

const TRANSITIONS: Record<MissionState, TransitionMap> = {
  CREATED: { START: 'RUNNING', CANCEL: 'CANCELLED', FAIL: 'FAILED' },
  RUNNING: {
    PAUSE: 'PAUSED',
    CANCEL: 'CANCELLED',
    COMPLETE: 'COMPLETED',
    FAIL: 'FAILED',
    WAIT_FOR_APPROVAL: 'WAITING_FOR_APPROVAL',
    WAIT_FOR_PROVIDER: 'WAITING_FOR_PROVIDER',
    BLOCK: 'BLOCKED',
  },
  PAUSED: { RESUME: 'RUNNING', CANCEL: 'CANCELLED', FAIL: 'FAILED' },
  WAITING_FOR_APPROVAL: { APPROVE: 'RUNNING', REJECT_APPROVAL: 'FAILED', CANCEL: 'CANCELLED' },
  WAITING_FOR_PROVIDER: {
    PROVIDER_AVAILABLE: 'RUNNING',
    CANCEL: 'CANCELLED',
    FAIL: 'FAILED',
    PAUSE: 'PAUSED',
  },
  BLOCKED: { UNBLOCK: 'RUNNING', CANCEL: 'CANCELLED', FAIL: 'FAILED', PAUSE: 'PAUSED' },
  COMPLETED: {},
  FAILED: {},
  CANCELLED: {},
};

function getAllowedTransitions(from: MissionState): TransitionMap {
  return TRANSITIONS[from];
}

export function canTransition(from: MissionState, command: MissionCommand): boolean {
  const allowed = getAllowedTransitions(from);
  const next = allowed[command.type];
  return next !== undefined;
}

export function transition(from: MissionState, command: MissionCommand): MissionState {
  const allowed = getAllowedTransitions(from);
  const next = allowed[command.type];
  if (next === undefined) {
    throw new Error(`Illegal mission transition: ${from} -> ${command.type}`);
  }
  return next;
}

export function isTerminal(state: MissionState): boolean {
  const transitions = getAllowedTransitions(state);
  return Object.keys(transitions).length === 0;
}

export { TRANSITIONS as MISSION_TRANSITIONS };
