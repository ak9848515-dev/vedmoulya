import { describe, expect, it } from 'vitest';
import { GoalUnderstandingService } from '../GoalUnderstandingService.js';
import { TaskDecompositionService } from '../TaskDecompositionService.js';

describe('TaskDecompositionService', () => {
  const understanding = new GoalUnderstandingService();
  const decomposer = new TaskDecompositionService();

  it('builds a validated DAG with entry + terminal tasks for the ABAP pattern', () => {
    const spec = understanding.derive(
      'Build an ABAP debugger for short dumps in production SAP code.',
    );
    const graph = decomposer.buildGraph(spec);
    expect(graph.validated).toBe(true);
    expect(graph.tasks.length).toBeGreaterThanOrEqual(7);
    expect(graph.entryTaskIds.length).toBeGreaterThanOrEqual(2); // understand + retrieve (parallel)
    expect(graph.terminalTaskIds).toHaveLength(1);
    // Every task has an id, dependency list, capability, budget, retry policy and status.
    for (const task of graph.tasks) {
      expect(task.taskId).toMatch(/^task-\d+$/);
      expect(task.capability).toBeTruthy();
      expect(task.budget.timeoutMs).toBeGreaterThan(0);
      expect(task.retryPolicy.maxRetries).toBeGreaterThanOrEqual(0);
      expect(task.status).toBe('pending');
      expect(task.dependencies).toBeInstanceOf(Array);
    }
  });

  it('marks the retrieve task as parallel-eligible and evidence-bearing', () => {
    const spec = understanding.derive(
      'Build an ABAP debugger for short dumps in production SAP code.',
    );
    const graph = decomposer.buildGraph(spec);
    const retrieve = graph.tasks.find((t) => t.phase === 'retrieve');
    expect(retrieve?.parallelEligible).toBe(true);
    expect(retrieve?.evidenceRequirement?.groundingRequired).toBe(true);
    expect(retrieve?.slot).toBe('evidence');
  });

  it('computes dependency waves in topological order', () => {
    const spec = understanding.derive(
      'Build an ABAP debugger for short dumps in production SAP code.',
    );
    const graph = decomposer.buildGraph(spec);
    const waves = decomposer.computeWaves(graph);
    // Wave 0 contains understand + retrieve (no deps); later waves depend on earlier ones.
    const wave0 = waves[0] ?? [];
    expect(wave0).toContain('task-1');
    expect(wave0).toContain('task-2');
    // The finalize task is last.
    const all = waves.flat();
    expect(all[all.length - 1]).toBe('task-7');
  });

  it('applies a retrieve-more-evidence refinement by inserting a new task', () => {
    const spec = understanding.derive(
      'Build an ABAP debugger for short dumps in production SAP code.',
    );
    const graph = decomposer.buildGraph(spec);
    const before = graph.tasks.length;
    const inserted = decomposer.applyRefinement(graph, spec, {
      action: 'retrieve_more_evidence',
      reason: 'evidence was insufficient',
    });
    expect(inserted).toBe(true);
    expect(graph.tasks).toHaveLength(before + 1);
    const added = graph.tasks[graph.tasks.length - 1];
    expect(added?.phase).toBe('retrieve');
    expect(added?.evidenceRequirement).toBeDefined();
    expect(graph.terminalTaskIds).toEqual([added?.taskId]);
  });

  it('applies a fix-output refinement with critic feedback in the prompt', () => {
    const spec = understanding.derive('Build a modern restaurant application.');
    const graph = decomposer.buildGraph(spec);
    const inserted = decomposer.applyRefinement(graph, spec, {
      action: 'fix_output',
      reason: 'critic found missing sections',
    });
    expect(inserted).toBe(true);
    const added = graph.tasks[graph.tasks.length - 1];
    expect(added?.phase).toBe('refine');
    expect(added?.input).toContain('critic found missing sections');
  });

  it('does not insert a task for finish/stop/clarification actions', () => {
    const spec = understanding.derive('Build a modern restaurant application.');
    const graph = decomposer.buildGraph(spec);
    expect(decomposer.applyRefinement(graph, spec, { action: 'finish', reason: 'done' })).toBe(
      false,
    );
    expect(decomposer.applyRefinement(graph, spec, { action: 'stop', reason: 'stop' })).toBe(false);
    expect(
      decomposer.applyRefinement(graph, spec, { action: 'clarification_required', reason: 'ask' }),
    ).toBe(false);
    expect(graph.tasks).toHaveLength(6);
  });

  it('applies reason-deeper and verify-conflict refinements', () => {
    const spec = understanding.derive('Build an AI application for support automation.');
    const graph = decomposer.buildGraph(spec);
    expect(
      decomposer.applyRefinement(graph, spec, { action: 'reason_deeper', reason: 'weak' }),
    ).toBe(true);
    const reasoned = graph.tasks[graph.tasks.length - 1];
    expect(reasoned?.phase).toBe('refine');
    expect(reasoned?.capability).toBe('reasoning');
    expect(
      decomposer.applyRefinement(graph, spec, { action: 'verify_conflict', reason: 'conflict' }),
    ).toBe(true);
    const verified = graph.tasks[graph.tasks.length - 1];
    expect(verified?.phase).toBe('refine');
    expect(verified?.input).toContain('Conflicting evidence');
  });

  it('is deterministic — the same spec yields the same graph', () => {
    const specA = understanding.derive('Build a modern restaurant application.');
    const specB = understanding.derive('Build a modern restaurant application.');
    const graphA = decomposer.buildGraph(specA);
    const graphB = decomposer.buildGraph(specB);
    expect(graphA.tasks.map((t) => t.taskId)).toEqual(graphB.tasks.map((t) => t.taskId));
    expect(graphA.tasks.map((t) => t.dependencies)).toEqual(
      graphB.tasks.map((t) => t.dependencies),
    );
  });
});
