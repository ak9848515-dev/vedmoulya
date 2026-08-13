// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Pipeline Validation
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Validates the 15-stage end-to-end pipeline
// (Goal → Project → Task Planning → Capability Selection → Knowledge
// Retrieval → Memory Retrieval → Provider Selection → Context
// Assembly → Decision → Execution Strategy → Execution Graph →
// Execution Session → Learning → Knowledge Update → Memory Update)
// against the live data of the owning engine. Every stage reports its
// evidence; engines that answer but hold no records yet report
// "not_started" (available, not yet exercised) — only reachability or
// validation failures block the pipeline.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access uses developer-provided literal keys against engine
   DTO shapes and the closed stage-id union — never attacker-controlled
   property names. */

import type {
  OSPipelineHealth,
  OSPipelineOverallStatus,
  OSPipelineStage,
  OSPipelineStageId,
  OSPipelineStageStatus,
} from '../../types/os-types.js';
import {
  OSPIPELINE_ENGINE,
  OSPIPELINE_LABELS,
  OSPIPELINE_STAGES,
} from '../../catalog/os-pipeline.js';
import { stageStatusRule } from '../rules/OSRules.js';
import type { OSEngineProbe } from './OSEngineProbeService.js';
import { firstNum, totalsNum, numOf, firstTotalsNum } from './os-data.js';

export interface StageEvidence {
  hasData: boolean;
  detail: string;
}

export class OSPipelineValidationService {
  /** Validate every stage against the owning engine's probe data. */
  validate(probes: readonly OSEngineProbe[]): OSPipelineHealth {
    const byEngine = new Map(probes.map((probe) => [probe.spec.engine, probe]));
    const stages: OSPipelineStage[] = OSPIPELINE_STAGES.map((stage) =>
      this.validateStage(stage, byEngine),
    );
    const passedStages = stages.filter((s) => s.status === 'passed').length;
    const notStartedStages = stages.filter((s) => s.status === 'not_started').length;
    const failedStages = stages.filter((s) => s.status === 'failed').length;
    const skippedStages = stages.filter((s) => s.status === 'skipped').length;
    const totalLatencyMs = stages.reduce((sum, s) => sum + s.latencyMs, 0);
    const overallStatus: OSPipelineOverallStatus =
      failedStages > 0 || skippedStages > 0
        ? 'blocked'
        : notStartedStages > 0
          ? 'degraded'
          : 'ready';
    return {
      stages,
      overallStatus,
      totalLatencyMs: Math.round(totalLatencyMs),
      valid: failedStages === 0 && skippedStages === 0,
      passedStages,
      notStartedStages,
      failedStages,
    };
  }

  private validateStage(
    stage: OSPipelineStageId,
    byEngine: Map<string, OSEngineProbe>,
  ): OSPipelineStage {
    const engine = OSPIPELINE_ENGINE[stage];
    const probe = byEngine.get(engine);
    if (!probe) {
      return {
        stage,
        engine,
        label: OSPIPELINE_LABELS[stage],
        status: 'skipped',
        latencyMs: 0,
        detail: 'engine not probed',
        error: 'engine registry missing',
      };
    }
    const evidence = this.evidence(stage, probe);
    const status: OSPipelineStageStatus = stageStatusRule(
      probe.success,
      evidence.hasData,
      probe.error,
    );
    return {
      stage,
      engine,
      label: OSPIPELINE_LABELS[stage],
      status,
      latencyMs: Math.round(probe.latencyMs),
      detail: evidence.detail,
      error: probe.error,
    };
  }

  /** Per-stage evidence — the live output the stage must produce. */
  evidence(stage: OSPipelineStageId, probe: OSEngineProbe): StageEvidence {
    if (!probe.success || probe.data === undefined || probe.data === null) {
      return { hasData: false, detail: probe.error ?? 'engine unreachable' };
    }
    const data = probe.data;
    switch (stage) {
      case 'goal': {
        const goals = firstNum(data, ['totalGoals']);
        return {
          hasData: (goals ?? 0) > 0,
          detail: goals === undefined ? 'goal registry empty' : `${goals} goal(s) registered`,
        };
      }
      case 'project': {
        const active = firstNum(data, ['activeGoals']);
        return {
          hasData: (active ?? 0) > 0,
          detail:
            active === undefined ? 'no active goals' : `${active} active goal(s) (project scoping)`,
        };
      }
      case 'task_planning': {
        const tasks = firstNum(data, ['totalTasks']);
        return {
          hasData: (tasks ?? 0) > 0,
          detail: tasks === undefined ? 'no tasks planned' : `${tasks} task(s) planned`,
        };
      }
      case 'capability_selection': {
        const capabilities = firstNum(data, ['total']);
        return {
          hasData: (capabilities ?? 0) > 0,
          detail:
            capabilities === undefined
              ? 'capability registry empty'
              : `${capabilities} capabilit(ies) selectable`,
        };
      }
      case 'knowledge_retrieval': {
        const items = totalsNum(data, 'items');
        return {
          hasData: (items ?? 0) > 0,
          detail:
            items === undefined
              ? 'knowledge registry empty'
              : `${items} knowledge item(s) retrievable`,
        };
      }
      case 'memory_retrieval': {
        const memories = totalsNum(data, 'memories');
        return {
          hasData: (memories ?? 0) > 0,
          detail:
            memories === undefined ? 'memory registry empty' : `${memories} memorie(s) retrievable`,
        };
      }
      case 'provider_selection': {
        const providers = firstNum(data, ['total']);
        return {
          hasData: (providers ?? 0) > 0,
          detail:
            providers === undefined
              ? 'provider registry empty'
              : `${providers} provider(s) selectable`,
        };
      }
      case 'context_assembly': {
        const items = firstNum(data, ['total']);
        return {
          hasData: (items ?? 0) > 0,
          detail:
            items === undefined ? 'context registry empty' : `${items} context item(s) assemblable`,
        };
      }
      case 'decision': {
        const decisions = totalsNum(data, 'decisions');
        return {
          hasData: (decisions ?? 0) > 0,
          detail:
            decisions === undefined ? 'no decisions recorded' : `${decisions} decision(s) recorded`,
        };
      }
      case 'execution_strategy': {
        const strategies = firstNum(data, ['total']);
        return {
          hasData: (strategies ?? 0) > 0,
          detail:
            strategies === undefined ? 'no strategies' : `${strategies} strateg(ies) available`,
        };
      }
      case 'execution_graph': {
        const graphs = firstNum(data, ['totalGraphs']);
        return {
          hasData: (graphs ?? 0) > 0,
          detail:
            graphs === undefined ? 'no execution graphs' : `${graphs} execution graph(s) built`,
        };
      }
      case 'execution_session': {
        const sessions = firstNum(data, ['totalSessions']);
        return {
          hasData: (sessions ?? 0) > 0,
          detail:
            sessions === undefined
              ? 'no execution sessions'
              : `${sessions} execution session(s) run`,
        };
      }
      case 'learning': {
        const events = totalsNum(data, 'events');
        return {
          hasData: (events ?? 0) > 0,
          detail:
            events === undefined ? 'no learning events' : `${events} learning event(s) recorded`,
        };
      }
      case 'knowledge_update': {
        const citations = numOf(data, 'citations') ?? totalsNum(data, 'citations');
        const consumers = firstTotalsNum(data, ['consumers']);
        const has = (citations ?? 0) > 0 || (consumers ?? 0) > 0;
        return {
          hasData: has,
          detail: has
            ? `knowledge consumed (citations ${citations ?? 0} · consumers ${consumers ?? 0})`
            : 'no knowledge consumption recorded',
        };
      }
      case 'memory_update': {
        const memories = totalsNum(data, 'memories');
        const consumers = totalsNum(data, 'consumers');
        const has = (memories ?? 0) > 0 && (consumers ?? 0) > 0;
        return {
          hasData: has,
          detail: has
            ? `memories reinforced (${memories ?? 0} memories · ${consumers ?? 0} consumers)`
            : 'no memory consumption recorded',
        };
      }
      default:
        return { hasData: false, detail: 'stage not validated' };
    }
  }
}
