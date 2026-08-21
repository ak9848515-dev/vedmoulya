// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · narrow ports
// SPRINT-030 — the ONLY seams through which this package reaches the frozen
// estate. Implemented in the gateway over the real CostLedger and the real
// provider registry — never duplicated inside this package.
// ─────────────────────────────────────────────────────────────────────────────

import type { CostSpendSnapshot, StrategyCandidate } from '../types/fabric-types.js';

/** Current spend per bucket — supplied by the EXISTING CostLedger (which
 *  MEASURES from the trace spine). The fabric only policy-checks. */
export interface FabricCostPort {
  snapshot(scope: {
    ownerId?: string;
    providerId?: string;
    workspaceId?: string;
  }): CostSpendSnapshot;
}

/** Strategy candidates — supplied by the gateway over the real provider
 *  registry (ProviderDTO evidence: capability match, quality, latency, cost,
 *  free/local, availability). The fabric never invents evidence. */
export interface FabricProviderPort {
  candidates(capability: string): Promise<StrategyCandidate[]>;
}
