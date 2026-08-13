// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/brain — Brain Ports
// EPIC-016
//
// The ONLY seams the Brain uses to reach the frozen estate. Every
// specialized system stays specialized; the Brain coordinates through
// these narrow interfaces and never reaches inside another engine.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type { SpecialistExecutionInput, SpecialistExecutionResult } from '@vedmoulya/loop-engine';
import type { ExecutionPreferenceEvent } from '@vedmoulya/execution-bridge';
import type { BrainTask, BrainDecisionRecord } from '../types/brain-types.js';
import type {
  ProviderUsageFact,
  ProviderPerformanceScore,
  BrainOutcomeMemory,
  IntelligenceEvent,
  Opportunity,
} from '../types/continuous-types.js';

// ── Clock ──────────────────────────────────────────────────────────
export interface ClockPort {
  now(): string;
}

// ── Capability plan source (EPIC-013 REUSE) ────────────────────────
export interface BrainPlanPort {
  planFor(userId: string, outcome: string): Promise<FactoryCapabilityPlan>;
}

// ── Provider / discovery / local candidate sources (EPIC-012A/B/C REUSE) ──
export interface BrainCandidatePort {
  providerCandidates(capability: CapabilityId): Promise<ProviderCandidateFact[]>;
  discoveryCandidates(capability: CapabilityId): Promise<DiscoveryCandidateFact[]>;
  localModelCandidates(capability: CapabilityId): Promise<LocalModelCandidateFact[]>;
}

// ── Execution (EPIC-006 LoopEngine + EPIC-014 execution bridge REUSE) ──
export interface BrainExecutionPort {
  execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult>;
}

// ── Memory / context assembly (memory-intelligence + context REUSE) ──
export interface BrainContextPort {
  /** Minimal, task-relevant, authorized context. Never dumps the profile. */
  assemble(userId: string, capabilities: CapabilityId[]): Promise<string>;
}

// ── Preference ledger (EPIC-014 REUSE) ─────────────────────────────
export interface BrainPreferencePort {
  record(event: Omit<ExecutionPreferenceEvent, 'eventId' | 'timestamp'>): Promise<void>;
}

// ── EPIC-020 · Provider usage/limits evidence (mission §3) ─────────
// Narrow port: provider adapters supply evidence (KNOWN / UNKNOWN /
// ESTIMATED). The Brain never invents provider limits.
export interface BrainUsagePort {
  usageFacts(userId: string, providerIds: string[]): Promise<ProviderUsageFact[]>;
}

// ── EPIC-020 · Adaptive task×provider performance evidence (§4) ───
export interface BrainExperiencePort {
  recordPerformance(input: {
    providerId: string;
    capability: CapabilityId;
    succeeded: boolean;
    /** Explicit user feedback vs inferred observation — never silently promoted. */
    explicit: boolean;
    quality?: number;
    at: string;
  }): Promise<void>;
  scoresFor(capability: CapabilityId): ProviderPerformanceScore[];
}

// ── EPIC-020 · Memory/learning feedback (mission §10) ──────────────
// Structured outcome evidence only: decisions, provenance, concise
// reasons. Never hidden chain-of-thought.
export interface BrainMemoryPort {
  recordOutcome(memory: BrainOutcomeMemory): Promise<void>;
}

// ── EPIC-020 · Continuous AI World / scheduler bridge (mission §8) ─
// Screened, security-tagged intelligence events for the Brain. The
// gateway adapter composes the frozen scheduler + AI World discovery
// — the Brain never reaches inside those engines.
export interface BrainDiscoveryBridgePort {
  fetchIntelligenceEvents(userId: string): Promise<IntelligenceEvent[]>;
}

// ── EPIC-020 · Owner-scoped stores (in-memory convention) ──────────
export interface OpportunityStore {
  save(opportunity: Opportunity): void;
  list(userId: string): Opportunity[];
  update(
    userId: string,
    opportunityId: string,
    patch: Partial<Pick<Opportunity, 'status'>>,
  ): Opportunity | undefined;
}

export interface IntelligenceEventStore {
  save(event: IntelligenceEvent): void;
  list(userId: string): IntelligenceEvent[];
  update(
    userId: string,
    eventId: string,
    patch: Partial<Pick<IntelligenceEvent, 'status'>>,
  ): IntelligenceEvent | undefined;
}

// ── Stores (owner-scoped; synchronous in-memory convention) ───────
export interface BrainTaskStore {
  save(task: BrainTask): void;
  get(userId: string, taskId: string): BrainTask | undefined;
  list(userId: string): BrainTask[];
}

export interface BrainDecisionStore {
  save(record: BrainDecisionRecord): void;
  get(userId: string, taskId: string): BrainDecisionRecord[];
}
