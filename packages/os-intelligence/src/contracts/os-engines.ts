// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Engine Ports
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The OS Integration Layer CONSUMES every Enterprise Intelligence
// Engine through narrow ports — it OWNS none and duplicates no logic.
// Each port is structurally satisfied by the owning engine's
// application service (the same seam pattern as `MemoryEngines`
// (EI-010), `KnowledgeEngines` (EI-009) and `BrainEngines` (EI-008)):
//
//   Goals (EI-006) · Capabilities (EI-001) · Providers (EI-002)
//   Context (EI-003) · Strategies (EI-004) · Orchestrator (EI-005)
//   Intelligence (EI-006 INT-001) · Learning (EI-007) · Brain (EI-008)
//   Knowledge (EI-009) · Memory (EI-010)
// ──────────────────────────────────────────────────────────────────

import type { GoalSummaryDTO } from '@vedmoulya/goals';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type { IntelligenceDashboardDTO } from '@vedmoulya/intelligence';
import type { LearningDashboardDTO } from '@vedmoulya/learning-intelligence';
import type { BrainDashboardDTO } from '@vedmoulya/enterprise-brain';
import type { KnowledgeDashboardDTO } from '@vedmoulya/knowledge-intelligence';
import type { MemoryDashboardDTO } from '@vedmoulya/memory-intelligence';

export interface PortResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Enterprise Goal & Task Intelligence Engine (EI-006 / goals) ───

export interface OSGoalEnginePort {
  getSummary(): Promise<PortResult<GoalSummaryDTO>>;
}

// ── Enterprise Capability Registry (EI-001) ───────────────────────

export interface OSCapabilityEnginePort {
  getMarketplace(): Promise<PortResult<CapabilityMarketplaceDTO>>;
}

// ── Enterprise Provider Registry (EI-002) ─────────────────────────

export interface OSProviderEnginePort {
  getMarketplace(): Promise<PortResult<ProviderMarketplaceDTO>>;
}

// ── Enterprise Context Intelligence Engine (EI-003) ───────────────

export interface OSContextEnginePort {
  getContextSummary(): Promise<PortResult<ContextRegistrySummaryDTO>>;
}

// ── Enterprise Execution Strategy Engine (EI-004) ─────────────────

export interface OSStrategyEnginePort {
  getSummary(): Promise<PortResult<StrategySummaryDTO>>;
}

// ── Enterprise Execution Orchestrator (EI-005) ────────────────────

export interface OSOrchestratorEnginePort {
  getSummary(): Promise<PortResult<OrchestratorSummaryDTO>>;
}

// ── Enterprise Intelligence Integration Platform (EI-006 / INT-001) ──

export interface OSIntelligenceEnginePort {
  getDashboard(): Promise<PortResult<IntelligenceDashboardDTO>>;
}

// ── Enterprise Learning Intelligence Platform (EI-007) ────────────

export interface OSLearningEnginePort {
  getDashboard(): Promise<PortResult<LearningDashboardDTO>>;
}

// ── Enterprise Brain (EI-008) ─────────────────────────────────────

export interface OSBrainEnginePort {
  getDashboard(): Promise<PortResult<BrainDashboardDTO>>;
}

// ── Enterprise Knowledge Intelligence Platform (EI-009) ───────────

export interface OSKnowledgeEnginePort {
  getDashboard(): Promise<PortResult<KnowledgeDashboardDTO>>;
}

// ── Enterprise Memory Intelligence Platform (EI-010) ──────────────

export interface OSMemoryEnginePort {
  getDashboard(): Promise<PortResult<MemoryDashboardDTO>>;
}

// ── Combined engine bundle consumed by the OS Integration Layer ───

export interface OSEngines {
  goals: OSGoalEnginePort;
  capabilities: OSCapabilityEnginePort;
  providers: OSProviderEnginePort;
  context: OSContextEnginePort;
  strategies: OSStrategyEnginePort;
  orchestrator: OSOrchestratorEnginePort;
  intelligence: OSIntelligenceEnginePort;
  learning: OSLearningEnginePort;
  brain: OSBrainEnginePort;
  knowledge: OSKnowledgeEnginePort;
  memory: OSMemoryEnginePort;
}
