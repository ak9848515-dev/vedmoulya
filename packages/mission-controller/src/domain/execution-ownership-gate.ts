// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: Execution ownership gate (OWNERSHIP-01)
//
// WHY THIS EXISTS
// ---------------
// The controller already refuses to PERSIST a result it no longer owns
// (LEASE-02 fencing). It did not, however, refuse to START work: an attempt
// whose lease had been healed/replaced could still call the executor (agent →
// governed tools → real workspace writes and commands) and only discover the
// loss afterwards, when its result was rejected. The side effects were already
// on disk.
//
// This gate answers ONE question, immediately before an initiation point:
// "may this attempt still cause a side effect?" It is deliberately a READ:
//   • the objective lease this heartbeat knows about must be unexpired;
//   • the store must still record this exact acquisition (owner + fencing
//     token) as the objective's owner;
//   • when a workspace lease is in use, this token must still hold it.
//
// It grants nothing and mutates nothing. A denial is latched (so a caller that
// ignores the first answer cannot continue into a second initiation), and the
// honest reason is returned for the durable activity trail.
//
// SCOPE / HONEST LIMIT
// --------------------
// The controller consults this gate before every initiation IT performs
// (execution, verification). It cannot interrupt an executor that is already
// running: `ExecutionPort` has no interruption API, so a mid-run tool action
// issued by `AgentExecutionService` is outside this gate's reach. That limit is
// reported, not papered over — the executor may consult the same gate itself
// (it is passed in the execution context) before each tool/command.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionOwnershipGate } from '../contracts/mission-ports.js';
import type { ObjectiveLeaseHeartbeat } from './objective-lease-heartbeat.js';
import type { WorkspaceLeasePort } from './workspace-execution-lease.js';

export interface MissionExecutionOwnershipGateOptions {
  heartbeat: ObjectiveLeaseHeartbeat;
  /** The workspace lease this attempt acquired (absent ⇒ not configured). */
  workspace?: {
    key: string;
    token: string;
    store: WorkspaceLeasePort;
  };
}

export class MissionExecutionOwnershipGate implements ExecutionOwnershipGate {
  private denial: string | undefined;

  constructor(private readonly options: MissionExecutionOwnershipGateOptions) {}

  /** The first refusal (if any) — the latch makes it permanent for this attempt. */
  get deniedReason(): string | undefined {
    return this.denial;
  }

  /**
   * `undefined` ⇒ the caller may initiate `operation`.
   * A string ⇒ the caller MUST NOT initiate it, and must not try again.
   */
  async refusal(operation: string): Promise<string | undefined> {
    if (this.denial !== undefined) return this.denial;
    const leaseRefusal = await this.options.heartbeat.ownershipRefusal(operation);
    if (leaseRefusal !== undefined) {
      this.denial = leaseRefusal;
      return leaseRefusal;
    }
    const workspace = this.options.workspace;
    if (workspace?.store.held !== undefined) {
      let held = false;
      try {
        held = await workspace.store.held(workspace.key, workspace.token);
      } catch {
        // A workspace lease that cannot be verified is not held.
        held = false;
      }
      if (!held) {
        this.denial = `this execution no longer holds the workspace lease for ${workspace.key} — ${operation} was not initiated`;
        return this.denial;
      }
    }
    return undefined;
  }
}
