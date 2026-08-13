// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Worker Registry Contract
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { ExecutionWorker } from '../../types/orchestrator-types.js';
import type { WorkerId } from '../value-objects/Identifiers.js';

export interface WorkerRegistry {
  register(worker: ExecutionWorker): Promise<void>;
  findById(id: WorkerId): Promise<ExecutionWorker | undefined>;
  listAll(): Promise<ExecutionWorker[]>;
  listByKind(kind: string): Promise<ExecutionWorker[]>;
  /** Pick the least-loaded worker able to run a capability. */
  claim(capability: CapabilityType): Promise<ExecutionWorker | undefined>;
  release(workerId: WorkerId): Promise<void>;
  update(worker: ExecutionWorker): Promise<void>;
}
