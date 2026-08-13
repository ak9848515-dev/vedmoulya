// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Graph Repository Contract
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type { ExecutionGraph } from '../../types/orchestrator-types.js';
import type { GraphId } from '../value-objects/Identifiers.js';

export interface ExecutionGraphRepository {
  save(graph: ExecutionGraph): Promise<void>;
  findById(id: GraphId): Promise<ExecutionGraph | undefined>;
  findByStrategy(strategyId: string): Promise<ExecutionGraph[]>;
  listAll(): Promise<ExecutionGraph[]>;
  delete(id: GraphId): Promise<boolean>;
  exists(id: GraphId): Promise<boolean>;
}
