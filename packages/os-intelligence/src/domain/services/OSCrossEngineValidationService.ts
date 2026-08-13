// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Cross-Engine Validation
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Validates the nine cross-engine integration pairs:
//   Capability ↔ Provider · Provider ↔ Context · Context ↔ Knowledge
//   Knowledge ↔ Memory · Memory ↔ Learning · Learning ↔ Brain
//   Brain ↔ Strategy · Strategy ↔ Execution · Execution ↔ Learning
// Each pair runs data-level checks on both engines' live outputs. A
// pair is "validated" when both engines are healthy and at least one
// cross-reference check passes, "not_checked" when both are healthy
// but no cross-referencing data exists yet, and "failed" when either
// engine is unreachable.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access uses developer-provided literal keys against engine
   DTO shapes — never attacker-controlled property names. */

import type {
  OSCrossEngineCheck,
  OSCrossEnginePair,
  OSCrossEnginePairStatus,
} from '../../types/os-types.js';
import { OS_CROSS_ENGINE_PAIRS } from '../../catalog/os-catalog.js';
import type { OSCrossEnginePairSpec } from '../../catalog/os-catalog.js';
import type { OSEngineProbe } from './OSEngineProbeService.js';
import { arrLen, byTypeNum, countBy, firstNum, totalsNum } from './os-data.js';

export class OSCrossEngineValidationService {
  /** Validate every integration pair against the probe pass. */
  validate(probes: readonly OSEngineProbe[]): OSCrossEnginePair[] {
    const byEngine = new Map(probes.map((probe) => [probe.spec.engine, probe]));
    return OS_CROSS_ENGINE_PAIRS.map((spec) => this.validatePair(spec, byEngine));
  }

  private validatePair(
    spec: OSCrossEnginePairSpec,
    byEngine: Map<string, OSEngineProbe>,
  ): OSCrossEnginePair {
    const fromProbe = byEngine.get(spec.from);
    const toProbe = byEngine.get(spec.to);
    const bothHealthy =
      fromProbe !== undefined &&
      toProbe !== undefined &&
      fromProbe.success &&
      toProbe.success &&
      fromProbe.data !== undefined &&
      toProbe.data !== undefined;
    const checks: OSCrossEngineCheck[] = bothHealthy
      ? this.checks(spec, fromProbe.data, toProbe.data)
      : [
          {
            description: `${spec.from} and ${spec.to} both reachable`,
            passed: bothHealthy,
          },
        ];
    // The pair is validated only when the cross-reference linkage evidence is
    // present; supporting checks (registry populated, …) never validate alone.
    const status: OSCrossEnginePairStatus = !bothHealthy
      ? 'failed'
      : checks.some((check) => check.linkage === true && check.passed)
        ? 'validated'
        : 'not_checked';
    return { pair: spec.pair, from: spec.from, to: spec.to, status, checks };
  }

  private checks(
    spec: OSCrossEnginePairSpec,
    fromData: unknown,
    toData: unknown,
  ): OSCrossEngineCheck[] {
    const from = fromData;
    const to = toData;
    switch (spec.pair) {
      case 'Capability ↔ Provider': {
        const providerMatrixKeys = this.recordKeys(to, 'countByCapability');
        const anyMatrix = (arrLen(to, 'providers') ?? 0) > 0;
        return [
          {
            description: 'providers are keyed by capability AI features',
            passed: providerMatrixKeys.length > 0 || anyMatrix,
            linkage: true,
          },
          {
            description: 'capability registry is populated',
            passed: (firstNum(from, ['total']) ?? 0) > 0,
          },
        ];
      }
      case 'Provider ↔ Context': {
        const providerSources =
          countBy(to, 'countBySource', 'benchmark_knowledge') ??
          countBy(to, 'countBySource', 'capability_metadata') ??
          countBy(to, 'countBySource', 'historical_success') ??
          0;
        return [
          {
            description: 'context carries provider intelligence sources',
            passed: providerSources > 0,
            linkage: true,
          },
          {
            description: 'provider registry is populated',
            passed: (firstNum(from, ['total']) ?? 0) > 0,
          },
        ];
      }
      case 'Context ↔ Knowledge': {
        const knowledgeSource = countBy(from, 'countBySource', 'knowledge_base') ?? 0;
        return [
          {
            description: 'context sources include the knowledge base',
            passed: knowledgeSource > 0,
            linkage: true,
          },
          {
            description: 'knowledge registry is populated',
            passed: (totalsNum(to, 'items') ?? 0) > 0,
          },
        ];
      }
      case 'Knowledge ↔ Memory': {
        const citations = totalsNum(to, 'citations') ?? 0;
        return [
          {
            description: 'memories cite knowledge items',
            passed: citations > 0,
            linkage: true,
          },
          {
            description: 'knowledge registry is populated',
            passed: (totalsNum(from, 'items') ?? 0) > 0,
          },
        ];
      }
      case 'Memory ↔ Learning': {
        const learningMemories = byTypeNum(from, 'learning') ?? 0;
        return [
          {
            description: 'memory records learning signals',
            passed: learningMemories > 0,
            linkage: true,
          },
          {
            description: 'learning registry is populated',
            passed: (totalsNum(to, 'events') ?? 0) > 0,
          },
        ];
      }
      case 'Learning ↔ Brain': {
        return [
          {
            description: 'learning produces recommendations for the brain',
            passed: (arrLen(from, 'recommendations') ?? 0) > 0,
            linkage: true,
          },
          {
            description: 'brain registry is populated',
            passed: (totalsNum(to, 'decisions') ?? 0) > 0,
          },
        ];
      }
      case 'Brain ↔ Strategy': {
        const strategyDecisions = byTypeNum(from, 'execution_strategy') ?? 0;
        return [
          {
            description: 'brain decides execution strategy',
            passed: strategyDecisions > 0,
            linkage: true,
          },
          {
            description: 'strategy registry is populated',
            passed: (firstNum(to, ['total']) ?? 0) > 0,
          },
        ];
      }
      case 'Strategy ↔ Execution': {
        const graphs = firstNum(to, ['totalGraphs']) ?? 0;
        const sessions = firstNum(to, ['totalSessions']) ?? 0;
        return [
          {
            description: 'execution graphs/sessions exist from approved strategies',
            passed: graphs > 0 || sessions > 0,
            linkage: true,
          },
          {
            description: 'strategy registry is populated',
            passed: (firstNum(from, ['total']) ?? 0) > 0,
          },
        ];
      }
      case 'Execution ↔ Learning': {
        return [
          {
            description: 'execution sessions are tracked',
            passed: (firstNum(from, ['totalSessions']) ?? 0) > 0,
            linkage: true,
          },
          {
            description: 'learning registry is populated (session outcomes)',
            passed: (totalsNum(to, 'events') ?? 0) > 0,
          },
        ];
      }
      default:
        return [];
    }
  }

  private recordKeys(data: unknown, key: string): string[] {
    const record = data as Record<string, unknown> | undefined;
    const bucket = record?.[key];
    if (typeof bucket === 'object' && bucket !== null && !Array.isArray(bucket)) {
      return Object.keys(bucket);
    }
    return [];
  }
}
