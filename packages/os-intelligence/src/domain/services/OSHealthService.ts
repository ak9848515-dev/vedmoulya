// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Health
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Aggregates the System Health report from one measured probe pass:
//   - per-engine status (healthy / degraded / unhealthy / unknown)
//     with extracted totals + a human summary;
//   - the dependency graph (package gate + consultation matrix);
//   - the 15-stage pipeline health;
//   - the nine cross-engine integration pairs;
//   - the diagnostics report;
//   - the performance metrics;
//   - the overall OS health score (engines 50% · dependencies 15% ·
//     pipeline 20% · diagnostics 15%).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access uses developer-provided literal keys against engine
   DTO shapes and the closed engine-id union — never attacker-controlled
   property names. */

import type { OSEngineId, OSEngineStatus, OSSystemHealth } from '../../types/os-types.js';
import { overallOSScore, osHealthStatusFromScore, engineStatusRule } from '../rules/OSRules.js';
import { OSEngineProbeService } from './OSEngineProbeService.js';
import type { OSEngineProbe } from './OSEngineProbeService.js';
import { OSDependencyGraphService } from './OSDependencyGraphService.js';
import { OSPipelineValidationService } from './OSPipelineValidationService.js';
import { OSCrossEngineValidationService } from './OSCrossEngineValidationService.js';
import { OSDiagnosticsService } from './OSDiagnosticsService.js';
import { OSPerformanceService } from './OSPerformanceService.js';
import { OSRepositoryStatusService } from './OSRepositoryStatusService.js';
import { firstNum, arrLen, totalsNum, byTypeNum, pipelineSummaryNum } from './os-data.js';

interface SummarySpec {
  /** totals key → friendly label. */
  labels: Record<string, string>;
}

/** Per-engine totals extraction config (engine DTO shapes are stable). */
const SUMMARY_SPECS: Partial<Record<OSEngineId, SummarySpec>> = {
  goals: { labels: { goals: 'goals', tasks: 'tasks', activeGoals: 'active' } },
  capabilities: {
    labels: { capabilities: 'capabilities', active: 'active', compositions: 'compositions' },
  },
  providers: { labels: { providers: 'providers', healthy: 'healthy' } },
  context: { labels: { items: 'contexts', tokens: 'tokens' } },
  strategy: { labels: { strategies: 'strategies' } },
  orchestrator: { labels: { graphs: 'graphs', sessions: 'sessions', activeSessions: 'active' } },
  intelligence: { labels: { pipelines: 'pipelines', ready: 'ready' } },
  learning: {
    labels: {
      events: 'events',
      successes: 'successes',
      failures: 'failures',
      approvals: 'approvals',
    },
  },
  brain: {
    labels: {
      decisions: 'decisions',
      plans: 'plans',
      approved: 'approved',
      handedOff: 'handed off',
    },
  },
  knowledge: {
    labels: {
      items: 'items',
      active: 'active',
      validated: 'validated',
      relationships: 'relationships',
    },
  },
  memory: {
    labels: { memories: 'memories', active: 'active', expired: 'expired', citations: 'citations' },
  },
};

export class OSHealthService {
  private readonly probeService = new OSEngineProbeService();
  private readonly graph = new OSDependencyGraphService();
  private readonly pipelineService = new OSPipelineValidationService();
  private readonly crossEngine = new OSCrossEngineValidationService();
  private readonly diagnostics = new OSDiagnosticsService();
  private readonly performance = new OSPerformanceService();
  private readonly repositories = new OSRepositoryStatusService();

  /** Run the full system health pass (probe every engine, then aggregate). */
  async systemHealth(
    engines: Parameters<OSEngineProbeService['measure']>[0],
  ): Promise<OSSystemHealth> {
    const probes = await this.probeService.measure(engines);
    return this.aggregate(probes);
  }

  /** Aggregate a System Health report from an existing probe pass (no re-calls). */
  aggregate(probes: readonly OSEngineProbe[]): OSSystemHealth {
    const checkedAt = new Date().toISOString();
    const engineStatuses = probes.map((probe) => this.statusFromProbe(probe));
    const dependencies = this.graph.buildGraph();
    const pipeline = this.pipelineService.validate(probes);
    const crossEngine = this.crossEngine.validate(probes);
    const repositoryStatuses = this.repositories.build();
    const diagnostics = this.diagnostics.report({
      engineStatuses,
      dependencies,
      pipeline,
      crossEngine,
      repositoryStatuses,
    });
    const performance = this.performance.metrics(probes);
    const overallScore = overallOSScore(
      engineStatuses,
      dependencies.acyclic,
      pipeline,
      diagnostics,
    );
    return {
      engines: engineStatuses,
      overallScore,
      status: osHealthStatusFromScore(overallScore),
      dependencies,
      pipeline,
      repositories: repositoryStatuses,
      crossEngine,
      diagnostics,
      performance,
      checkedAt,
    };
  }

  /** Convert one probe into an engine status (totals + summary extracted). */
  statusFromProbe(probe: OSEngineProbe): OSEngineStatus {
    const totals = this.extractTotals(probe);
    // The port responded (consulted) even when it answers with a failure;
    // the status is driven by the error flag and whether the engine
    // produced actionable data (any non-zero total).
    const hasData =
      probe.success &&
      probe.data !== undefined &&
      probe.data !== null &&
      Object.values(totals).some((value) => value > 0);
    const status = engineStatusRule(true, hasData, probe.error);
    return {
      engine: probe.spec.engine,
      name: probe.spec.name,
      packageName: probe.spec.packageName,
      sprint: probe.spec.sprint,
      status,
      latencyMs: Math.round(probe.latencyMs),
      consulted: true,
      dataSummary: this.summarize(probe, totals),
      totals,
      error: probe.error,
      lastCheckedAt: new Date().toISOString(),
    };
  }

  private extractTotals(probe: OSEngineProbe): Record<string, number> {
    const totals: Record<string, number> = {};
    const data = probe.success ? probe.data : undefined;
    if (data === undefined || data === null) return totals;
    switch (probe.spec.engine) {
      case 'goals':
        this.set(totals, 'goals', firstNum(data, ['totalGoals']));
        this.set(totals, 'tasks', firstNum(data, ['totalTasks']));
        this.set(totals, 'activeGoals', firstNum(data, ['activeGoals']));
        break;
      case 'capabilities':
        this.set(totals, 'capabilities', firstNum(data, ['total']));
        this.set(totals, 'active', firstNum(data, ['activeCount']));
        this.set(totals, 'compositions', firstNum(data, ['compositionCount']));
        break;
      case 'providers':
        this.set(totals, 'providers', firstNum(data, ['total']));
        this.set(totals, 'healthy', firstNum(data, ['healthyCount']));
        break;
      case 'context':
        this.set(totals, 'items', firstNum(data, ['total']));
        this.set(totals, 'tokens', firstNum(data, ['totalTokens']));
        break;
      case 'strategy':
        this.set(totals, 'strategies', firstNum(data, ['total']));
        break;
      case 'orchestrator':
        this.set(totals, 'graphs', firstNum(data, ['totalGraphs']));
        this.set(totals, 'sessions', firstNum(data, ['totalSessions']));
        this.set(totals, 'activeSessions', firstNum(data, ['activeSessions']));
        break;
      case 'intelligence':
        this.set(totals, 'pipelines', pipelineSummaryNum(data, 'total'));
        this.set(totals, 'ready', pipelineSummaryNum(data, 'ready'));
        break;
      case 'learning':
        this.set(totals, 'events', totalsNum(data, 'events'));
        this.set(totals, 'successes', totalsNum(data, 'successes'));
        this.set(totals, 'failures', totalsNum(data, 'failures'));
        this.set(totals, 'approvals', totalsNum(data, 'pendingApprovals'));
        this.set(totals, 'recommendations', arrLen(data, 'recommendations'));
        break;
      case 'brain':
        this.set(totals, 'decisions', totalsNum(data, 'decisions'));
        this.set(totals, 'plans', totalsNum(data, 'plans'));
        this.set(totals, 'approved', totalsNum(data, 'approved'));
        this.set(totals, 'handedOff', totalsNum(data, 'handedOff'));
        break;
      case 'knowledge':
        this.set(totals, 'items', totalsNum(data, 'items'));
        this.set(totals, 'active', totalsNum(data, 'active'));
        this.set(totals, 'validated', totalsNum(data, 'validated'));
        this.set(totals, 'relationships', totalsNum(data, 'relationships'));
        break;
      case 'memory':
        this.set(totals, 'memories', totalsNum(data, 'memories'));
        this.set(totals, 'active', totalsNum(data, 'active'));
        this.set(totals, 'expired', totalsNum(data, 'expired'));
        this.set(totals, 'citations', totalsNum(data, 'citations'));
        this.set(totals, 'learningMemories', byTypeNum(data, 'learning'));
        break;
      default:
        break;
    }
    return totals;
  }

  private set(target: Record<string, number>, key: string, value: number | undefined): void {
    if (value !== undefined && Number.isFinite(value)) target[key] = value;
  }

  private summarize(probe: OSEngineProbe, totals: Partial<Record<string, number>>): string {
    const spec = SUMMARY_SPECS[probe.spec.engine];
    if (!probe.success || !spec) return probe.error ? 'unreachable' : 'no data';
    const parts: string[] = [];
    for (const [key, label] of Object.entries(spec.labels)) {
      const value = totals[key];
      if (value !== undefined) parts.push(`${label} ${value}`);
    }
    return parts.length > 0 ? parts.join(' · ') : 'ready';
  }
}
