// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Engine Ports
// APP-001 — Post-V1 Application Platform Layer
// The Context Fabric CONSUMES the frozen Enterprise Intelligence
// engines through narrow ports — it OWNS none and duplicates no
// logic. Each port is structurally satisfied by the owning engine's
// application service (the same seam pattern as `OSEngines` (OS-001),
// `MemoryEngines` (EI-010) and `KnowledgeEngines` (EI-009)):
//
//   Context (EI-003) · Knowledge (EI-009) · Memory (EI-010)
//   Goals (EI-006) · Capabilities (EI-001)
//
// The fabric stays provider-independent: no LLM is required for basic
// retrieval — AI may be added later behind these same ports.
// ──────────────────────────────────────────────────────────────────

import type { ContextQueryDTO, ContextItemDTO } from '@vedmoulya/context';
import type { MemoryRetrievalDTO, MemorySearchResult } from '@vedmoulya/memory-intelligence';
import type {
  KnowledgeSearchQueryDTO,
  KnowledgeSearchResult,
} from '@vedmoulya/knowledge-intelligence';
import type { GoalSearchCriteria, GoalDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';

export interface PortResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Enterprise Context Intelligence Engine (EI-003) ───────────────

export interface FabricContextEnginePort {
  searchContext(
    query: ContextQueryDTO,
  ): Promise<PortResult<{ items: ContextItemDTO[]; total: number }>>;
}

// ── Enterprise Memory Intelligence Platform (EI-010) ──────────────

export interface FabricMemoryEnginePort {
  retrieve(query?: MemoryRetrievalDTO): Promise<PortResult<MemorySearchResult[]>>;
}

// ── Enterprise Knowledge Intelligence Platform (EI-009) ───────────

export interface FabricKnowledgeEnginePort {
  search(query?: KnowledgeSearchQueryDTO): Promise<PortResult<KnowledgeSearchResult[]>>;
}

// ── Enterprise Goal & Task Intelligence Engine (EI-006) ───────────

export interface FabricGoalsEnginePort {
  searchGoals(
    criteria: GoalSearchCriteria,
  ): Promise<PortResult<{ items: GoalDTO[]; total: number }>>;
}

// ── Enterprise Capability Registry (EI-001) ───────────────────────

export interface FabricCapabilitiesEnginePort {
  getMarketplace(): Promise<PortResult<CapabilityMarketplaceDTO>>;
}

// ── Combined engine bundle consumed by the Context Fabric ─────────

export interface FabricEngines {
  context: FabricContextEnginePort;
  memory: FabricMemoryEnginePort;
  knowledge: FabricKnowledgeEnginePort;
  goals: FabricGoalsEnginePort;
  capabilities: FabricCapabilitiesEnginePort;
}
