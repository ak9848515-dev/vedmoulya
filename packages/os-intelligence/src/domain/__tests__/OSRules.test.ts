// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Rules tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  engineSpecsRule,
  matrixRule,
  pipelineRule,
  engineHealthScore,
  pipelineScore,
  diagnosticsScore,
  overallOSScore,
  osHealthStatusFromScore,
  stageStatusRule,
  engineStatusRule,
  isOSEngineId,
} from '../rules/OSRules.js';
import {
  OS_ENGINE_SPECS,
  OS_CONSUMPTION_MATRIX,
  OS_PACKAGE_DEPENDENCIES,
} from '../../catalog/os-catalog.js';
import { OSPIPELINE_STAGES } from '../../catalog/os-pipeline.js';
import type { OSEngineStatus, OSPipelineHealth } from '../../types/os-types.js';

describe('engineSpecsRule', () => {
  it('passes for the canonical OS engine catalog', () => {
    const result = engineSpecsRule();
    expect(result.passed).toBe(true);
    expect(result.message).toContain('11 unique engines');
  });

  it('fails on duplicate engines, packages or tables', () => {
    const dup = engineSpecsRule([OS_ENGINE_SPECS[0]!, { ...OS_ENGINE_SPECS[0]!, engine: 'brain' }]);
    expect(dup.passed).toBe(false);
    expect(dup.message).toContain('duplicate');
  });

  it('fails on an incomplete spec', () => {
    const incomplete = engineSpecsRule([
      {
        engine: 'goals',
        name: '',
        packageName: '@vedmoulya/goals',
        sprint: 'EI-006',
        repository: 'PostgresGoalRepository',
        table: 'goal_registry',
        port: 'goals',
      },
    ]);
    expect(incomplete.passed).toBe(false);
    expect(incomplete.message).toContain('incomplete');
  });

  it('fails on an empty catalog', () => {
    expect(engineSpecsRule([]).passed).toBe(false);
  });
});

describe('matrixRule', () => {
  it('passes for the canonical consumption matrix', () => {
    expect(matrixRule(OS_CONSUMPTION_MATRIX).passed).toBe(true);
  });

  it('passes for the canonical package matrix', () => {
    expect(matrixRule(OS_PACKAGE_DEPENDENCIES).passed).toBe(true);
  });

  it('fails on unknown engine ids', () => {
    const result = matrixRule({ goals: ['does-not-exist' as never] });
    expect(result.passed).toBe(false);
  });
});

describe('pipelineRule', () => {
  it('passes for the canonical 15-stage pipeline in order', () => {
    const result = pipelineRule();
    expect(result.passed).toBe(true);
    expect(result.message).toContain('15 stages');
  });

  it('fails on missing stages', () => {
    expect(pipelineRule(OSPIPELINE_STAGES.slice(0, 14)).passed).toBe(false);
  });

  it('fails on reordered stages', () => {
    const reordered = [...OSPIPELINE_STAGES];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    expect(pipelineRule(reordered).passed).toBe(false);
  });
});

describe('health scoring', () => {
  function status(engine: OSEngineStatus['status']): OSEngineStatus {
    return {
      engine: 'goals',
      name: 'x',
      packageName: '@vedmoulya/goals',
      sprint: 'EI-006',
      status: engine,
      latencyMs: 1,
      consulted: true,
      dataSummary: '',
      totals: {},
      lastCheckedAt: '',
    };
  }

  it('scores all-healthy engines at 100', () => {
    expect(engineHealthScore([status('healthy'), status('healthy')])).toBe(100);
  });

  it('scores degraded and unknown engines fractionally', () => {
    const score = engineHealthScore([status('healthy'), status('degraded'), status('unknown')]);
    expect(score).toBe(Math.round(((1 + 0.5 + 0.25) / 3) * 100));
  });

  it('returns 0 for an empty engine list', () => {
    expect(engineHealthScore([])).toBe(0);
  });

  it('scores pipeline by stage status', () => {
    const ready: OSPipelineHealth = {
      stages: [],
      overallStatus: 'ready',
      totalLatencyMs: 0,
      valid: true,
      passedStages: 10,
      notStartedStages: 5,
      failedStages: 0,
    };
    expect(pipelineScore(ready)).toBe(83);
    const blocked: OSPipelineHealth = {
      ...ready,
      passedStages: 5,
      notStartedStages: 5,
      failedStages: 5,
    };
    expect(pipelineScore(blocked)).toBe(50);
  });

  it('scores diagnostics with critical penalties', () => {
    expect(diagnosticsScore(10, 0, 0, 0)).toBe(100);
    // 12 total → base 83, minus 8 per critical, minus floor(4 warnings / 2).
    expect(diagnosticsScore(10, 2, 1, 4)).toBe(83 - 8 - 2);
  });

  it('computes the weighted overall score', () => {
    const score = overallOSScore(
      [status('healthy'), status('healthy')],
      true,
      {
        stages: [],
        overallStatus: 'ready',
        totalLatencyMs: 0,
        valid: true,
        passedStages: 10,
        notStartedStages: 0,
        failedStages: 0,
      },
      { passed: 10, failed: 0, critical: 0, warnings: 0 },
    );
    expect(score).toBe(100);
  });

  it('penalizes cyclic package graphs', () => {
    const score = overallOSScore(
      [status('healthy'), status('healthy')],
      false,
      {
        stages: [],
        overallStatus: 'ready',
        totalLatencyMs: 0,
        valid: true,
        passedStages: 10,
        notStartedStages: 0,
        failedStages: 0,
      },
      { passed: 10, failed: 0, critical: 0, warnings: 0 },
    );
    expect(score).toBeLessThan(100);
  });
});

describe('status derivation', () => {
  it('derives OS health status from score bands', () => {
    expect(osHealthStatusFromScore(95)).toBe('healthy');
    expect(osHealthStatusFromScore(70)).toBe('degraded');
    expect(osHealthStatusFromScore(30)).toBe('unhealthy');
  });

  it('derives stage status from consultation + data', () => {
    expect(stageStatusRule(true, true)).toBe('passed');
    expect(stageStatusRule(true, false)).toBe('not_started');
    expect(stageStatusRule(false, false)).toBe('failed');
    expect(stageStatusRule(true, false, 'boom')).toBe('failed');
  });

  it('derives engine status from consultation + data', () => {
    expect(engineStatusRule(true, true)).toBe('healthy');
    expect(engineStatusRule(true, false)).toBe('degraded');
    expect(engineStatusRule(false, false)).toBe('unknown');
    expect(engineStatusRule(true, true, 'boom')).toBe('unhealthy');
  });

  it('guards engine ids', () => {
    expect(isOSEngineId('memory')).toBe(true);
    expect(isOSEngineId('nope')).toBe(false);
  });
});
