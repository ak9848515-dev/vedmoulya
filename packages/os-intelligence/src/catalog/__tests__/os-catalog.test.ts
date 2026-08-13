// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Catalog tests
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  OS_ENGINE_SPECS,
  OS_CROSS_ENGINE_PAIRS,
  OS_CONSUMPTION_MATRIX,
  OS_CONSUMPTION_REASONS,
  OS_PACKAGE_DEPENDENCIES,
  createCatalogOSSnapshot,
} from '../os-catalog.js';
import { OSPIPELINE_STAGES, OSPIPELINE_ENGINE } from '../os-pipeline.js';
import { engineSpecsRule, matrixRule, pipelineRule } from '../../domain/rules/OSRules.js';

describe('OS catalog integrity', () => {
  it('defines exactly eleven engines', () => {
    expect(OS_ENGINE_SPECS).toHaveLength(11);
    expect(engineSpecsRule().passed).toBe(true);
  });

  it('covers EI-001 through EI-010 plus INT-001', () => {
    const sprints = OS_ENGINE_SPECS.map((s) => s.sprint);
    expect(sprints).toContain('EI-001');
    expect(sprints).toContain('EI-010');
    expect(sprints).toContain('EI-006 INT-001');
  });

  it('maps every engine to a Postgres repository and JSONB table', () => {
    for (const spec of OS_ENGINE_SPECS) {
      expect(spec.repository).toMatch(/^Postgres/);
      expect(spec.table).toMatch(/_registry$/);
    }
  });

  it('references only registered engines in both matrices', () => {
    expect(matrixRule(OS_CONSUMPTION_MATRIX).passed).toBe(true);
    expect(matrixRule(OS_PACKAGE_DEPENDENCIES).passed).toBe(true);
  });

  it('keeps the package build graph acyclic', () => {
    // DFS over the package graph must not revisit nodes on the stack.
    const visited = new Set<string>();
    const stack = new Set<string>();
    let cyclic = false;
    const visit = (node: string): void => {
      if (stack.has(node)) cyclic = true;
      if (visited.has(node) || cyclic) return;
      visited.add(node);
      stack.add(node);
      for (const next of OS_PACKAGE_DEPENDENCIES[node as never] ?? []) visit(next);
      stack.delete(node);
    };
    for (const node of Object.keys(OS_PACKAGE_DEPENDENCIES)) visit(node);
    expect(cyclic).toBe(false);
  });

  it('defines the nine cross-engine pairs of the sprint spec', () => {
    expect(OS_CROSS_ENGINE_PAIRS).toHaveLength(9);
    const labels = OS_CROSS_ENGINE_PAIRS.map((p) => p.pair);
    expect(labels).toEqual([
      'Capability ↔ Provider',
      'Provider ↔ Context',
      'Context ↔ Knowledge',
      'Knowledge ↔ Memory',
      'Memory ↔ Learning',
      'Learning ↔ Brain',
      'Brain ↔ Strategy',
      'Strategy ↔ Execution',
      'Execution ↔ Learning',
    ]);
  });

  it('defines the canonical 15-stage pipeline', () => {
    expect(OSPIPELINE_STAGES).toHaveLength(15);
    expect(pipelineRule().passed).toBe(true);
    expect(OSPIPELINE_STAGES[0]).toBe('goal');
    expect(OSPIPELINE_STAGES[OSPIPELINE_STAGES.length - 1]).toBe('memory_update');
  });

  it('maps every pipeline stage to a registered engine', () => {
    const engines = new Set(OS_ENGINE_SPECS.map((s) => s.engine));
    for (const stage of OSPIPELINE_STAGES) {
      expect(engines.has(OSPIPELINE_ENGINE[stage])).toBe(true);
    }
  });

  it('produces a deterministic seed snapshot for the dashboard history', () => {
    const snapshot = createCatalogOSSnapshot();
    expect(snapshot.snapshotId).toBe('snapshot_os_seed_20260806');
    expect(snapshot.engineCount).toBe(11);
    expect(snapshot.healthyCount).toBe(11);
    expect(snapshot.status).toBe('healthy');
    expect(snapshot.pipelineValid).toBe(true);
    expect(snapshot.dependencyAcyclic).toBe(true);
    expect(snapshot.criticalFindings).toBe(0);
  });

  it('documents every consultation edge with a reason', () => {
    for (const [from, targets] of Object.entries(OS_CONSUMPTION_MATRIX)) {
      for (const to of targets) {
        const reason = OS_CONSUMPTION_REASONS[`${from}→${to}`];
        expect(reason, `missing reason for ${from}→${to}`).toBeDefined();
      }
    }
  });
});
