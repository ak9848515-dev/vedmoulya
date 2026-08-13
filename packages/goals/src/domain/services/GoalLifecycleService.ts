// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Lifecycle State Machine
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Typed goal lifecycle per GOAL_ENGINE.md:
//   Proposed → Scored → Accepted → Active ⇄ Blocked → Completed → Archived
//                           ↘ Cancelled → Archived
// The engine understands and tracks goals — it never executes them.
// ──────────────────────────────────────────────────────────────────

import type { GoalLifecycleCommand, GoalStatus } from '../../types/goal-types.js';

const TRANSITIONS: Record<GoalStatus, ReadonlyArray<GoalStatus>> = {
  proposed: ['scored', 'cancelled'],
  scored: ['accepted', 'cancelled'],
  accepted: ['active', 'cancelled'],
  active: ['blocked', 'completed', 'cancelled'],
  blocked: ['active'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

/** Map a lifecycle command to its target status (per source status). */
function applyCommand(status: GoalStatus, command: GoalLifecycleCommand): GoalStatus | undefined {
  switch (command.type) {
    case 'score':
      return status === 'proposed' ? 'scored' : undefined;
    case 'accept':
      return status === 'scored' ? 'accepted' : undefined;
    case 'activate':
      return status === 'accepted' || status === 'blocked' ? 'active' : undefined;
    case 'block':
      return status === 'active' ? 'blocked' : undefined;
    case 'unblock':
      return status === 'blocked' ? 'active' : undefined;
    case 'complete':
      return status === 'active' ? 'completed' : undefined;
    case 'cancel':
      return status === 'proposed' ||
        status === 'scored' ||
        status === 'accepted' ||
        status === 'active'
        ? 'cancelled'
        : undefined;
    case 'archive':
      return status === 'completed' || status === 'cancelled' ? 'archived' : undefined;
  }
}

export class GoalLifecycleService {
  /** All legal source states for a command (for diagnostics). */
  isLegal(from: GoalStatus, command: GoalLifecycleCommand): boolean {
    return applyCommand(from, command) !== undefined;
  }

  /**
   * Transition a goal status. Throws on illegal transitions so callers can
   * surface a clean error (same convention as the orchestrator state machine).
   */
  transition(from: GoalStatus, command: GoalLifecycleCommand): GoalStatus {
    const target = applyCommand(from, command);
    if (!target) {
      throw new Error(`Illegal goal transition: ${from} → ${command.type}`);
    }
    // TRANSITIONS is keyed by every GoalStatus — `from` is a validated status.
    // eslint-disable-next-line security/detect-object-injection
    if (!TRANSITIONS[from].includes(target)) {
      throw new Error(`Illegal goal transition: ${from} → ${target}`);
    }
    return target;
  }

  /** Whether a status represents an in-flight (non-terminal) goal. */
  isActive(status: GoalStatus): boolean {
    return status === 'active' || status === 'blocked';
  }

  /** Whether a status is terminal. */
  isTerminal(status: GoalStatus): boolean {
    return status === 'completed' || status === 'cancelled' || status === 'archived';
  }
}
