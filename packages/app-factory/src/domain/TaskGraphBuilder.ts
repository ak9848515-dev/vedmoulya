// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Task Graph Builder
// EPIC-007 — Phase 3. Converts an architecture into an application
// task graph. Sequential stages first (requirements → architecture),
// then PARALLEL groups where safe (data model ∥ API contract ∥ UI
// design), then sequential integration/testing/security/build/final
// validation. Dependent tasks never run before prerequisites complete.
// The graph is later translated into a loop-engine task graph so the
// generation executes through the bounded EPIC-006 loop.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  ApplicationArchitecture,
  ApplicationTask,
  ApplicationTaskGraph,
  ApplicationTaskPhase,
} from '../types/app-types.js';
import { roleById } from '../catalog/archetypes.js';

export class TaskGraphBuilder {
  build(architecture: ApplicationArchitecture): ApplicationTaskGraph {
    const tasks: ApplicationTask[] = [];

    // Sequential spine: requirements → architecture.
    tasks.push(
      this.task(
        tasks.length,
        'requirements',
        'Requirements analysis',
        'requirements-analyst',
        [],
        'Produce the functional and non-functional requirements from the specification.',
        'A complete requirements document.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'architecture',
        'Application architecture',
        'product-architect',
        [0],
        'Produce the application architecture: layers, data flow and technology choices.',
        'A complete architecture description.',
      ),
    );

    // Parallel wave: data model ∥ API contract ∥ UI design.
    tasks.push(
      this.task(
        tasks.length,
        'data_model',
        'Data model & schema',
        'database-engineer',
        [1],
        'Produce the data model and SQL schema.',
        'A complete data model with entities and fields.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'api_contract',
        'API contract',
        'backend-engineer',
        [1],
        'Produce the typed API contract.',
        'A complete API contract with endpoints and methods.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'ui_design',
        'UI/UX design',
        'ui-ux-designer',
        [1],
        'Produce the UI design: screens, navigation, responsive behavior and accessibility.',
        'A complete UI design.',
      ),
    );

    // Implementation depends on all three parallel outputs.
    tasks.push(
      this.task(
        tasks.length,
        'implementation',
        'Implementation',
        'frontend-engineer',
        [2, 3, 4],
        'Implement the application: typed source files, API wiring and UI components.',
        'Typed, structured implementation files.',
      ),
    );

    // Sequential validation spine.
    tasks.push(
      this.task(
        tasks.length,
        'testing',
        'Testing',
        'test-engineer',
        [5],
        'Write unit and integration tests covering the core workflows.',
        'A passing test suite.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'security_review',
        'Security review',
        'security-engineer',
        [5],
        'Review authentication, authorization, IDOR, secrets and injection.',
        'A security report with classified findings.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'performance_review',
        'Performance review',
        'performance-engineer',
        [5],
        'Review latency, data access patterns and bundle size.',
        'A performance report.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'build',
        'Build & packaging',
        'deployment-engineer',
        [6, 7, 8],
        'Assemble the buildable project: configuration, dependencies and package scripts.',
        'A buildable project.',
      ),
    );
    tasks.push(
      this.task(
        tasks.length,
        'final_validation',
        'Final validation',
        'code-reviewer',
        [9],
        'Independent critique + final validation against acceptance criteria.',
        'A final validation report.',
      ),
    );

    const graph: ApplicationTaskGraph = {
      applicationId: architecture.applicationId,
      tasks,
      entryTaskIds: ['task-0'],
      terminalTaskIds: ['task-10'],
      validated: true,
      validationReasons: [
        'requirements → architecture → (data model ∥ API ∥ UI) → implementation → testing/security/performance → build → final validation',
      ],
    };
    return graph;
  }

  /**
   * Map the application graph to a loop-engine-compatible shape (Phase 3
   * reuses the EPIC-006 loop). Returns the subset the loop needs: each
   * task's capability, phase, dependencies and prompt.
   */
  toLoopTasks(graph: ApplicationTaskGraph): Array<{
    taskId: string;
    title: string;
    capability: CapabilityType;
    phase: ApplicationTaskPhase;
    dependencies: string[];
    parallelEligible: boolean;
    prompt: string;
    expectedOutput: string;
    loopPhase:
      | 'understand'
      | 'retrieve'
      | 'analyze'
      | 'produce'
      | 'validate'
      | 'critique'
      | 'refine'
      | 'finalize';
  }> {
    const loopPhaseMap: Record<
      ApplicationTaskPhase,
      | 'understand'
      | 'retrieve'
      | 'analyze'
      | 'produce'
      | 'validate'
      | 'critique'
      | 'refine'
      | 'finalize'
    > = {
      requirements: 'understand',
      architecture: 'analyze',
      data_model: 'produce',
      api_contract: 'produce',
      ui_design: 'produce',
      implementation: 'produce',
      testing: 'validate',
      security_review: 'validate',
      performance_review: 'validate',
      build: 'produce',
      final_validation: 'critique',
    };
    return graph.tasks.map((task) => ({
      taskId: task.taskId,
      title: task.title,
      capability: task.capability,
      phase: task.phase,
      dependencies: task.dependencies,
      parallelEligible: task.parallelEligible,
      prompt: task.prompt,
      expectedOutput: task.expectedOutput,
      loopPhase: loopPhaseMap[task.phase],
    }));
  }

  private task(
    index: number,
    phase: ApplicationTaskPhase,
    title: string,
    roleId: Parameters<typeof roleById>[0],
    dependencyIndexes: number[],
    prompt: string,
    expectedOutput: string,
  ): ApplicationTask {
    const role = roleById(roleId);
    return {
      taskId: `task-${String(index)}`,
      title,
      role: role.id,
      phase,
      dependencies: dependencyIndexes.map((i) => `task-${String(i)}`),
      parallelEligible: phase === 'data_model' || phase === 'api_contract' || phase === 'ui_design',
      producesFiles: [],
      capability: role.capabilities[0] ?? 'reasoning',
      qualityTier: 'standard',
      prompt,
      expectedOutput,
      loopPhase: 'produce',
    };
  }
}

/** Deterministic task id generator for stable tests. */
export function taskId(index: number): string {
  return `task-${String(index)}`;
}
