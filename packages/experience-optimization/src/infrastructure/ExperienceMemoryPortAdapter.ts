// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Optimization: Memory Port Adapter
//
// The optimization layer consumes evidence through this narrow port.
// Production wiring: wraps the previous sprint's ExecutionMemoryService
// (which persists through the enterprise memory platform) — NO second
// memory system, NO second database. Passive decay is applied at read
// time with the same semantics as the frozen memory retrieval, so stale
// evidence loses influence while the historical record is retained.
// Cross-user isolation is enforced by the underlying store (USER-scoped
// entries only for the requesting userId).
// ──────────────────────────────────────────────────────────────────

import {
  applyPassiveDecay,
  DEFAULT_HALF_LIFE_DAYS,
  type ExecutionMemoryService,
  type MemoryCategory,
  type MemoryEntry,
} from '@vedmoulya/execution-memory';
import type {
  ExperienceMemoryPort,
  MemoryEntryQuery,
} from '../contracts/experience-optimization-ports.js';

export const MAX_OPTIMIZATION_ENTRIES = 64;

export class ExperienceMemoryPortAdapter implements ExperienceMemoryPort {
  constructor(
    private readonly service: ExecutionMemoryService,
    private readonly halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS,
    private readonly nowMs: () => number = (): number => Date.now(),
  ) {}

  async entries(query: MemoryEntryQuery): Promise<MemoryEntry[]> {
    const search: { userId?: string; category?: MemoryCategory } = {};
    if (query.userId !== undefined) search.userId = query.userId;
    if (query.category !== undefined) search.category = query.category;
    const entries = await this.service.listEntries(search);
    return entries
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_OPTIMIZATION_ENTRIES)
      .map((entry) => applyPassiveDecay(entry, this.nowMs(), this.halfLifeDays));
  }
}
