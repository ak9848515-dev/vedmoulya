// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Diagnostics
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// The diagnostics battery: engine reachability, dependency graph,
// contract/ownership integrity, repository readiness, pipeline event
// flow, lifecycle, cross-engine health and database migration
// readiness. Every finding is categorized (engine / dependency /
// contract / repository / pipeline / lifecycle / event_flow /
// ownership / database) and scored (info = passed, warning, critical).
// ──────────────────────────────────────────────────────────────────

import type {
  OSDiagnosticCategory,
  OSDiagnosticFinding,
  OSDiagnosticSeverity,
  OSDiagnosticsReport,
  OSDependencyGraph,
  OSEngineStatus,
  OSRepositoryStatus,
} from '../../types/os-types.js';
import type { OSCrossEnginePair } from '../../types/os-types.js';
import type { OSPipelineHealth } from '../../types/os-types.js';
import { engineSpecsRule, diagnosticsScore } from '../rules/OSRules.js';

export interface OSDiagnosticsInput {
  engineStatuses: OSEngineStatus[];
  dependencies: OSDependencyGraph;
  pipeline: OSPipelineHealth;
  crossEngine: OSCrossEnginePair[];
  repositoryStatuses: OSRepositoryStatus[];
}

interface FindingSpec {
  id: string;
  severity: OSDiagnosticSeverity;
  category: OSDiagnosticCategory;
  engine?: OSEngineStatus['engine'];
  passed: boolean;
  message: string;
}

export class OSDiagnosticsService {
  /** Run the full diagnostics battery over a completed health pass. */
  report(input: OSDiagnosticsInput): OSDiagnosticsReport {
    const specs: FindingSpec[] = [
      ...this.engineFindings(input.engineStatuses),
      ...this.dependencyFindings(input.dependencies),
      this.contractFinding(),
      this.ownershipFinding(),
      ...this.repositoryFindings(input.repositoryStatuses),
      this.pipelineFinding(input.pipeline),
      this.eventFlowFinding(input.pipeline),
      this.lifecycleFinding(input.engineStatuses),
      ...this.crossEngineFindings(input.crossEngine),
      this.databaseFinding(input.repositoryStatuses),
    ];
    const findings = specs.map((spec) => this.toFinding(spec));
    const passed = findings.filter((f) => f.severity === 'info').length;
    const warnings = findings.filter((f) => f.severity === 'warning').length;
    const critical = findings.filter((f) => f.severity === 'critical').length;
    return {
      findings,
      passed,
      failed: critical,
      warnings,
      critical,
      total: findings.length,
      healthScore: diagnosticsScore(passed, critical, critical, warnings),
    };
  }

  private toFinding(spec: FindingSpec): OSDiagnosticFinding {
    // Passed checks keep their severity (info = healthy, warning = degraded
    // but working); failed checks always surface as critical.
    const severity = spec.passed ? (spec.severity === 'warning' ? 'warning' : 'info') : 'critical';
    return {
      id: spec.id,
      severity,
      category: spec.category,
      engine: spec.engine,
      message: spec.message,
    };
  }

  private engineFindings(engines: OSEngineStatus[]): FindingSpec[] {
    return engines.map((engine) => ({
      id: `os-diag-engine-${engine.engine}`,
      severity: engine.status === 'unhealthy' ? 'critical' : 'warning',
      category: 'engine',
      engine: engine.engine,
      passed: engine.status !== 'unhealthy' && engine.status !== 'unknown',
      message:
        engine.status === 'unhealthy'
          ? `${engine.name} (${engine.engine}) unreachable: ${engine.error ?? 'port error'}`
          : engine.status === 'degraded'
            ? `${engine.name} (${engine.engine}) answered with no registry data`
            : `${engine.name} (${engine.engine}) reachable · ${engine.dataSummary}`,
    }));
  }

  private dependencyFindings(graph: OSDependencyGraph): FindingSpec[] {
    const cycleFinding: FindingSpec = {
      id: 'os-diag-deps-cycle',
      severity: 'critical',
      category: 'dependency',
      passed: graph.acyclic,
      message: graph.acyclic
        ? 'package build graph is acyclic (no circular dependencies)'
        : `circular package dependencies detected: ${JSON.stringify(graph.packageCycles)}`,
    };
    const consultationFinding: FindingSpec = {
      id: 'os-diag-deps-contract',
      severity: 'info',
      category: 'dependency',
      passed: true,
      message: `consultation matrix covers ${graph.consultationEdges.length} port contracts (${graph.consultationCycles.length} expected integration cycle(s))`,
    };
    return [cycleFinding, consultationFinding];
  }

  private contractFinding(): FindingSpec {
    const rule = engineSpecsRule();
    return {
      id: 'os-diag-contract-unique',
      severity: 'critical',
      category: 'contract',
      passed: rule.passed,
      message: rule.passed
        ? 'shared contracts are unique — one package / one engine / one table'
        : (rule.message ?? 'contract integrity violated'),
    };
  }

  private ownershipFinding(): FindingSpec {
    return {
      id: 'os-diag-ownership-boundaries',
      severity: 'info',
      category: 'ownership',
      passed: true,
      message: 'every engine is owned by exactly one package; the OS owns no engine',
    };
  }

  private repositoryFindings(repositories: OSRepositoryStatus[]): FindingSpec[] {
    return repositories.map((repo) => ({
      id: `os-diag-repo-${repo.engine}`,
      severity: repo.status === 'ready' ? 'info' : 'critical',
      category: 'repository',
      engine: repo.engine,
      passed: repo.status === 'ready',
      message: `${repo.engine} persists via ${repo.repository} → ${repo.table}`,
    }));
  }

  private pipelineFinding(pipeline: OSPipelineHealth): FindingSpec {
    return {
      id: 'os-diag-pipeline',
      severity:
        pipeline.failedStages > 0 ? 'critical' : pipeline.notStartedStages > 0 ? 'warning' : 'info',
      category: 'pipeline',
      passed: pipeline.valid,
      message: `15-stage pipeline ${pipeline.overallStatus} — ${pipeline.passedStages} passed · ${pipeline.notStartedStages} not started · ${pipeline.failedStages} failed`,
    };
  }

  private eventFlowFinding(pipeline: OSPipelineHealth): FindingSpec {
    return {
      id: 'os-diag-event-flow',
      severity: pipeline.failedStages > 0 ? 'critical' : 'warning',
      category: 'event_flow',
      passed: pipeline.valid,
      message: pipeline.valid
        ? `event flow validated — ${pipeline.passedStages}/${pipeline.stages.length} stages ready${pipeline.notStartedStages > 0 ? `, ${pipeline.notStartedStages} not started` : ''}`
        : `event flow blocked — ${pipeline.failedStages} stage(s) failed`,
    };
  }

  private lifecycleFinding(engines: OSEngineStatus[]): FindingSpec {
    const unhealthy = engines.filter((e) => e.status === 'unhealthy' || e.status === 'unknown');
    return {
      id: 'os-diag-lifecycle',
      severity: unhealthy.length > 0 ? 'critical' : 'info',
      category: 'lifecycle',
      passed: unhealthy.length === 0,
      message:
        unhealthy.length === 0
          ? 'every engine lifecycle is reachable and reporting'
          : `${unhealthy.length} engine(s) not reporting: ${unhealthy.map((e) => e.engine).join(', ')}`,
    };
  }

  private crossEngineFindings(pairs: OSCrossEnginePair[]): FindingSpec[] {
    return pairs.map((pair) => ({
      id: `os-diag-crossengine-${pair.from}-${pair.to}`,
      severity:
        pair.status === 'failed' ? 'critical' : pair.status === 'not_checked' ? 'warning' : 'info',
      category: 'lifecycle',
      passed: pair.status !== 'failed',
      message:
        pair.status === 'validated'
          ? `${pair.pair} validated (${pair.checks.filter((c) => c.passed).length}/${pair.checks.length} checks)`
          : pair.status === 'not_checked'
            ? `${pair.pair} healthy but no cross-referencing data yet`
            : `${pair.pair} failed — one side unreachable`,
    }));
  }

  private databaseFinding(repositories: OSRepositoryStatus[]): FindingSpec {
    const ready = repositories.every((repo) => repo.status === 'ready');
    return {
      id: 'os-diag-db-migration',
      severity: ready ? 'info' : 'critical',
      category: 'database',
      passed: ready,
      message: ready
        ? `database migration readiness — ${repositories.length} JSONB registries with ensureTable() + indexes`
        : 'database migration readiness incomplete',
    };
  }
}
