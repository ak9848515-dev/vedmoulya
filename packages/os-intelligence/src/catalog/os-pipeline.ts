// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Pipeline Catalog
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The canonical 15-stage end-to-end pipeline:
//
//   Goal → Project → Task Planning → Capability Selection →
//   Knowledge Retrieval → Memory Retrieval → Provider Selection →
//   Context Assembly → Decision → Execution Strategy →
//   Execution Graph → Execution Session → Learning →
//   Knowledge Update → Memory Update
//
// Every stage is owned by exactly one engine and is validated against
// that engine's live registry data (OSPipelineValidationService).
// ──────────────────────────────────────────────────────────────────

import type { OSEngineId, OSPipelineStageId } from '../types/os-types.js';

export const OSPIPELINE_ENGINE: Record<OSPipelineStageId, OSEngineId> = {
  goal: 'goals',
  project: 'goals',
  task_planning: 'goals',
  capability_selection: 'capabilities',
  knowledge_retrieval: 'knowledge',
  memory_retrieval: 'memory',
  provider_selection: 'providers',
  context_assembly: 'context',
  decision: 'brain',
  execution_strategy: 'strategy',
  execution_graph: 'orchestrator',
  execution_session: 'orchestrator',
  learning: 'learning',
  knowledge_update: 'knowledge',
  memory_update: 'memory',
};

export const OSPIPELINE_LABELS: Record<OSPipelineStageId, string> = {
  goal: 'Goal',
  project: 'Project',
  task_planning: 'Task Planning',
  capability_selection: 'Capability Selection',
  knowledge_retrieval: 'Knowledge Retrieval',
  memory_retrieval: 'Memory Retrieval',
  provider_selection: 'Provider Selection',
  context_assembly: 'Context Assembly',
  decision: 'Decision',
  execution_strategy: 'Execution Strategy',
  execution_graph: 'Execution Graph',
  execution_session: 'Execution Session',
  learning: 'Learning',
  knowledge_update: 'Knowledge Update',
  memory_update: 'Memory Update',
};

/** Ordered stage ids — the canonical event-flow order validated by the OS. */
export const OSPIPELINE_STAGES: OSPipelineStageId[] = [
  'goal',
  'project',
  'task_planning',
  'capability_selection',
  'knowledge_retrieval',
  'memory_retrieval',
  'provider_selection',
  'context_assembly',
  'decision',
  'execution_strategy',
  'execution_graph',
  'execution_session',
  'learning',
  'knowledge_update',
  'memory_update',
];
