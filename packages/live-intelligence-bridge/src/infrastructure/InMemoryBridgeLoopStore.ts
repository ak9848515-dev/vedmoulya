// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge
// InMemoryBridgeLoopStore — owner-scoped, bounded FIFO (IDOR-safe).
// ──────────────────────────────────────────────────────────────────

import type { BridgeLoopRun } from '../types/bridge-types.js';
import type { BridgeLoopStore } from '../contracts/bridge-ports.js';

export interface InMemoryBridgeLoopStoreOptions {
  /** Bounded FIFO per owner (evicts oldest first). */
  maxLoopsPerOwner?: number;
}

export class InMemoryBridgeLoopStore implements BridgeLoopStore {
  private readonly runs: BridgeLoopRun[] = [];
  private readonly maxLoopsPerOwner: number;

  constructor(options: InMemoryBridgeLoopStoreOptions = {}) {
    this.maxLoopsPerOwner = options.maxLoopsPerOwner ?? 50;
  }

  save(loop: BridgeLoopRun): void {
    const index = this.runs.findIndex((r) => r.loopId === loop.loopId);
    if (index >= 0) {
      // eslint-disable-next-line security/detect-object-injection -- plain array index write; loop is the loop being saved, never user-controlled lookup
      this.runs[index] = loop;
      return;
    }
    this.runs.push(loop);
    const owned = this.runs.filter((r) => r.userId === loop.userId);
    const excess = owned.length - this.maxLoopsPerOwner;
    if (excess > 0) {
      const oldest = owned.slice(0, excess);
      for (const old of oldest) {
        const i = this.runs.findIndex((r) => r.loopId === old.loopId);
        if (i >= 0) {
          this.runs.splice(i, 1);
        }
      }
    }
  }

  get(userId: string, loopId: string): BridgeLoopRun | undefined {
    const run = this.runs.find((r) => r.loopId === loopId);
    return run && run.userId === userId ? run : undefined;
  }

  list(userId: string): BridgeLoopRun[] {
    return this.runs.filter((r) => r.userId === userId);
  }
}
