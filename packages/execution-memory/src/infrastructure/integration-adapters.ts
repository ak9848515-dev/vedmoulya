// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Integration Adapters (PHASE 13/14/15)
//
// Narrow advisory adapters for the three consumers:
//   - PlanningMemoryAdapter  — supplies relevant verified plan/tool/task
//     evidence as advisory context. The frozen planner STILL validates
//     capabilities/tools/permissions/verification/budgets/readiness
//     independently — memory cannot make an unavailable tool available.
//   - AdaptiveMemoryAdapter  — supplies a bounded evidence block for the
//     decision model. Memory suggests; the frozen adaptive loop still
//     validates through ToolRegistry/authorization/capability/governance/
//     schema/ToolRuntime before anything executes.
//   - RoutingMemoryAdapter   — supplies ROUTING_SIGNAL evidence ONLY as
//     an additional evidence source. ProviderRoutingAdvisor remains
//     authoritative; current health/availability always wins.
//
// All output is compact, structured, sanitized and bounded.
// ──────────────────────────────────────────────────────────────────

import type { ExecutionMemoryService } from '../application/ExecutionMemoryService.js';
import type {
  MemoryEvidence,
  MemoryEvidenceBlock,
  MemoryQuery,
  RuntimeTruth,
} from '../types/execution-memory-types.js';

export class PlanningMemoryAdapter {
  constructor(private readonly service: ExecutionMemoryService) {}

  /** Advisory evidence for a planning pass (never authority). */
  async retrieve(query: MemoryQuery): Promise<MemoryEvidence[]> {
    return this.service.retrieveForPlanning(query);
  }
}

export class AdaptiveMemoryAdapter {
  constructor(private readonly service: ExecutionMemoryService) {}

  /** Bounded evidence block for the decision model context. */
  async retrieveForDecision(
    query: MemoryQuery,
    runtimeTruth?: RuntimeTruth,
  ): Promise<MemoryEvidenceBlock> {
    return this.service.retrieveForDecision(query, runtimeTruth);
  }
}

export class RoutingMemoryAdapter {
  constructor(private readonly service: ExecutionMemoryService) {}

  /** Advisory routing signal only — current health/routing stay authoritative. */
  async provideAdvisory(
    query: MemoryQuery,
    runtimeTruth?: RuntimeTruth,
  ): Promise<MemoryEvidence[]> {
    return this.service.provideRoutingAdvisory(query, runtimeTruth);
  }
}
