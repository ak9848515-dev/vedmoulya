import { describe, expect, it } from 'vitest';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';
import { TaskGraphBuilder } from '../TaskGraphBuilder.js';

describe('TaskGraphBuilder — Phase 3', () => {
  const specEngine = new SpecificationEngine();
  const archEngine = new ArchitectureEngine();
  const builder = new TaskGraphBuilder();

  it('builds the application task graph with sequential + parallel stages', () => {
    const spec = specEngine.derive({
      applicationId: 'app-1',
      owner: 'u1',
      goal: 'Build a restaurant ordering app.',
    });
    const arch = archEngine.derive({ specification: spec });
    const graph = builder.build(arch);
    expect(graph.tasks).toHaveLength(11);
    expect(graph.entryTaskIds).toEqual(['task-0']);
    // parallel wave: data model ∥ API contract ∥ UI design
    const parallel = graph.tasks.filter((t) => t.parallelEligible);
    expect(parallel.map((t) => t.phase).sort()).toEqual([
      'api_contract',
      'data_model',
      'ui_design',
    ]);
    // dependent tasks reference existing prerequisites
    for (const task of graph.tasks) {
      for (const dep of task.dependencies) {
        expect(graph.tasks.some((t) => t.taskId === dep)).toBe(true);
      }
    }
    expect(graph.validated).toBe(true);
  });

  it('maps to loop-engine tasks with capabilities (reuses EPIC-006)', () => {
    const spec = specEngine.derive({
      applicationId: 'app-2',
      owner: 'u1',
      goal: 'Build a restaurant ordering app.',
    });
    const arch = archEngine.derive({ specification: spec });
    const graph = builder.build(arch);
    const loopTasks = builder.toLoopTasks(graph);
    expect(loopTasks).toHaveLength(11);
    for (const task of loopTasks) {
      expect(task.capability).toBeTruthy();
      expect(task.dependencies.every((d) => d.startsWith('task-'))).toBe(true);
    }
  });
});
