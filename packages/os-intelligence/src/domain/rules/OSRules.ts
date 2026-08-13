// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Rules
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Pure validation rules for the OS registry: engine-spec integrity,
// dependency-matrix integrity, pipeline integrity, health scoring and
// stage status derivation. No engine consultation, no I/O — the same
// rules convention as MemoryRules / KnowledgeRules / BrainDecisionRules.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   array/record index access here uses loop counters and developer-provided
   literal keys — never attacker-controlled property names. */

import type {
  OSEngineId,
  OSEngineHealthStatus,
  OSEngineStatus,
  OSPipelineHealth,
  OSPipelineStageId,
  OSPipelineStageStatus,
  OSSystemHealthStatus,
} from '../../types/os-types.js';
import { OS_ENGINE_IDS } from '../../types/os-types.js';
import { OS_ENGINE_SPECS } from '../../catalog/os-catalog.js';
import type { OSEngineSpec } from '../../catalog/os-catalog.js';
import { OSPIPELINE_STAGES } from '../../catalog/os-pipeline.js';

// ── Registry integrity ────────────────────────────────────────────

export interface RuleResult {
  passed: boolean;
  message?: string;
}

/** True when the engine specs are unique (engine + package + table) and complete. */
export function engineSpecsRule(specs: readonly OSEngineSpec[] = OS_ENGINE_SPECS): RuleResult {
  if (specs.length === 0) return { passed: false, message: 'no engine specs' };
  const engines = new Set<string>();
  const packages = new Set<string>();
  const tables = new Set<string>();
  for (const spec of specs) {
    engines.add(spec.engine);
    packages.add(spec.packageName);
    tables.add(spec.table);
    if (!spec.name || !spec.repository || !spec.port) {
      return { passed: false, message: `incomplete spec for ${spec.engine}` };
    }
  }
  if (engines.size !== specs.length) return { passed: false, message: 'duplicate engine ids' };
  if (packages.size !== specs.length)
    return { passed: false, message: 'duplicate packages (ownership boundary violated)' };
  if (tables.size !== specs.length)
    return { passed: false, message: 'duplicate repository tables' };
  return { passed: true, message: `${specs.length} unique engines / packages / tables` };
}

/** True when every engine id in a matrix is a known engine. */
export function matrixRule(matrix: Record<string, readonly OSEngineId[]>): RuleResult {
  const known = new Set<string>(OS_ENGINE_IDS);
  for (const [from, targets] of Object.entries(matrix)) {
    if (!known.has(from)) return { passed: false, message: `unknown engine in matrix: ${from}` };
    for (const target of targets) {
      if (!known.has(target))
        return { passed: false, message: `unknown engine target: ${from} → ${target}` };
    }
  }
  return { passed: true, message: 'matrix references only registered engines' };
}

/** True when the pipeline covers every canonical stage, in canonical order. */
export function pipelineRule(stages: readonly OSPipelineStageId[] = OSPIPELINE_STAGES): RuleResult {
  if (stages.length !== OSPIPELINE_STAGES.length) {
    return {
      passed: false,
      message: `expected ${OSPIPELINE_STAGES.length} stages, got ${stages.length}`,
    };
  }
  for (let i = 0; i < stages.length; i += 1) {
    if (stages[i] !== OSPIPELINE_STAGES[i]) {
      return {
        passed: false,
        message: `stage ${i} out of canonical order: ${stages[i] ?? 'undefined'}`,
      };
    }
  }
  return { passed: true, message: `${stages.length} stages in canonical order` };
}

// ── Health scoring ────────────────────────────────────────────────

export const OS_SCORE_WEIGHTS = {
  engines: 0.5,
  dependencies: 0.15,
  pipeline: 0.2,
  diagnostics: 0.15,
} as const;

export function engineHealthScore(engines: readonly OSEngineStatus[]): number {
  if (engines.length === 0) return 0;
  let sum = 0;
  for (const engine of engines) {
    if (engine.status === 'healthy') sum += 1;
    else if (engine.status === 'degraded') sum += 0.5;
    else if (engine.status === 'unknown') sum += 0.25;
  }
  return Math.round((sum / engines.length) * 100);
}

export function pipelineScore(health: OSPipelineHealth): number {
  const total = health.passedStages + health.notStartedStages + health.failedStages;
  if (total === 0) return 0;
  const weighted = health.passedStages + health.notStartedStages * 0.5;
  return Math.round((weighted / total) * 100);
}

export function diagnosticsScore(
  passed: number,
  failed: number,
  critical: number,
  warnings: number,
): number {
  const total = passed + failed;
  if (total === 0) return 0;
  const base = Math.round((passed / total) * 100);
  return Math.max(0, base - critical * 8 - Math.floor(warnings / 2));
}

export function overallOSScore(
  engines: readonly OSEngineStatus[],
  dependencyAcyclic: boolean,
  pipeline: OSPipelineHealth,
  diagnostics: { passed: number; failed: number; critical: number; warnings: number },
): number {
  const engineScore = engineHealthScore(engines);
  const dependencyScore = dependencyAcyclic ? 100 : 50;
  const pipelineValue = pipelineScore(pipeline);
  const diagScore = diagnosticsScore(
    diagnostics.passed,
    diagnostics.failed,
    diagnostics.critical,
    diagnostics.warnings,
  );
  const score = Math.round(
    OS_SCORE_WEIGHTS.engines * engineScore +
      OS_SCORE_WEIGHTS.dependencies * dependencyScore +
      OS_SCORE_WEIGHTS.pipeline * pipelineValue +
      OS_SCORE_WEIGHTS.diagnostics * diagScore,
  );
  return Math.min(100, Math.max(0, score));
}

export function osHealthStatusFromScore(score: number): OSSystemHealthStatus {
  if (score >= 90) return 'healthy';
  if (score >= 60) return 'degraded';
  return 'unhealthy';
}

// ── Stage status derivation ───────────────────────────────────────

/** Data-presence rule: engines with zero records report "not_started", not failure. */
export function stageStatusRule(
  consulted: boolean,
  hasData: boolean,
  error?: string,
): OSPipelineStageStatus {
  if (!consulted) return 'failed';
  if (error) return 'failed';
  if (hasData) return 'passed';
  return 'not_started';
}

/** Health status of a single engine from its consultation outcome. */
export function engineStatusRule(
  consulted: boolean,
  hasData: boolean,
  error?: string,
): OSEngineHealthStatus {
  if (!consulted) return 'unknown';
  if (error) return 'unhealthy';
  if (hasData) return 'healthy';
  return 'degraded';
}

/** Engine id guard (keeps dynamic access type-honest). */
export function isOSEngineId(value: string): value is OSEngineId {
  return (OS_ENGINE_IDS as readonly string[]).includes(value);
}
