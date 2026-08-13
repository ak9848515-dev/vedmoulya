// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Task Decomposition Service
// EPIC-006 — Phase 2. Converts a GoalSpecification into a typed
// TaskGraph: every task has an id, dependencies, capability, input,
// expected output, evidence requirement, budget, timeout, retry
// policy and status. Supports sequential and parallel execution
// (parallelEligible + dependency waves). Adaptive refinements
// (Phase 7) insert new tasks with precise dependencies.
// ──────────────────────────────────────────────────────────────────

import { templatesForPattern, type TaskTemplate } from '../catalog/loop-catalog.js';
import type {
  GoalSpecification,
  LoopTask,
  LoopTaskGraph,
  RefinementDecision,
} from '../types/loop-types.js';

export interface TaskGraphBuildOptions {
  /** Base timeout for specialist tasks in ms. */
  taskTimeoutMs?: number;
  /** Base max output tokens per specialist task. */
  taskMaxTokens?: number;
}

const DEFAULT_TASK_TIMEOUT_MS = 90_000;
const DEFAULT_TASK_MAX_TOKENS = 1_500;

export class TaskDecompositionService {
  /**
   * Build the initial TaskGraph for a GoalSpecification. Deterministic:
   * same specification → same graph.
   */
  buildGraph(spec: GoalSpecification, options: TaskGraphBuildOptions = {}): LoopTaskGraph {
    const templates = templatesForPattern(spec.pattern);
    const taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    const taskMaxTokens = options.taskMaxTokens ?? DEFAULT_TASK_MAX_TOKENS;

    const tasks: LoopTask[] = templates.map((template, index) => {
      const dependencies = (template.dependsOn ?? [])
        .filter((depIndex) => depIndex < index)
        .map((depIndex) => `task-${depIndex + 1}`);
      return this.toTask(template, index, dependencies, spec, { taskTimeoutMs, taskMaxTokens });
    });

    return this.finalizeGraph(spec, tasks);
  }

  /**
   * Phase 7 — insert the adaptive task decided by the RefinementPlanner.
   * Returns true when a task was inserted, false when the graph is terminal
   * (no further adaptation is meaningful).
   */
  applyRefinement(
    graph: LoopTaskGraph,
    spec: GoalSpecification,
    decision: RefinementDecision,
  ): boolean {
    const lastTasks = graph.tasks.filter((t) => t.status !== 'failed');
    const dependsOn = lastTasks.length > 0 ? [lastTasks[lastTasks.length - 1]?.taskId ?? ''] : [];
    const safeDepends = dependsOn[0] ? dependsOn : [];
    const base = graph.tasks.length + 1;

    let task: LoopTask | undefined;
    switch (decision.action) {
      case 'retrieve_more_evidence': {
        const requirement = spec.evidenceRequirements[0];
        task = {
          taskId: `task-${base}`,
          title: 'Retrieve additional evidence',
          description: 'Phase 6: evidence was insufficient — retrieve more, focused evidence.',
          capability: 'reasoning',
          qualityTier: spec.qualityTier,
          dependencies: safeDepends,
          parallelEligible: false,
          input: `The previous evidence was insufficient. Retrieve additional focused evidence for: ${spec.rawGoal}\n\n${decision.reason}`,
          expectedOutput: 'Additional relevant evidence that satisfies the evidence requirement.',
          evidenceRequirement: requirement
            ? {
                collection: requirement.collection,
                query: requirement.queryTemplate,
                topK: requirement.topK ?? 5,
                groundingRequired: requirement.groundingRequired,
              }
            : undefined,
          allowedTools: [],
          budget: { timeoutMs: 90_000, maxTokens: 1_000 },
          retryPolicy: { maxRetries: 1, retryDelayMs: 50 },
          status: 'pending',
          order: base,
          phase: 'retrieve',
        };
        break;
      }
      case 'reason_deeper': {
        task = {
          taskId: `task-${base}`,
          title: 'Deeper reasoning',
          description:
            'Phase 7: the reasoning was weak — run a deeper reasoning pass over the accumulated work.',
          capability: 'reasoning',
          qualityTier: spec.qualityTier === 'standard' ? 'premium' : spec.qualityTier,
          dependencies: safeDepends,
          parallelEligible: false,
          input: `Reason deeper about the goal and the work so far, then strengthen the weak reasoning.\n\n${decision.reason}\n\nGoal: ${spec.rawGoal}`,
          expectedOutput: 'Strengthened reasoning that addresses the critic feedback.',
          allowedTools: spec.allowedTools,
          budget: { timeoutMs: 120_000, maxTokens: 1_500 },
          retryPolicy: { maxRetries: 1, retryDelayMs: 50 },
          status: 'pending',
          order: base,
          phase: 'refine',
        };
        break;
      }
      case 'fix_output': {
        task = {
          taskId: `task-${base}`,
          title: 'Refine output — critic feedback',
          description:
            'Phase 5: the critic found defects — regenerate the output addressing every finding.',
          capability: 'content_generation',
          qualityTier: spec.qualityTier === 'standard' ? 'premium' : spec.qualityTier,
          dependencies: safeDepends,
          parallelEligible: false,
          input: `Revise the previous output so it satisfies the success criteria. Address every critic finding precisely.\n\n${decision.reason}\n\nSuccess criteria: ${spec.successCriteria
            .map((c) => c.description)
            .join(' | ')}\n\nGoal: ${spec.rawGoal}`,
          expectedOutput: 'A revised output that satisfies the success criteria.',
          allowedTools: spec.allowedTools,
          budget: { timeoutMs: 120_000, maxTokens: 1_500 },
          retryPolicy: { maxRetries: 1, retryDelayMs: 50 },
          status: 'pending',
          order: base,
          phase: 'refine',
        };
        break;
      }
      case 'verify_conflict': {
        task = {
          taskId: `task-${base}`,
          title: 'Investigate conflicting evidence',
          description: 'Phase 6: evidence conflicts — investigate the conflict before continuing.',
          capability: 'reasoning',
          qualityTier: 'premium',
          dependencies: safeDepends,
          parallelEligible: false,
          input: `Conflicting evidence was detected. Investigate the conflict, identify which sources disagree and why, and attempt to reconcile or reject the unreliable side.\n\n${decision.reason}\n\nGoal: ${spec.rawGoal}`,
          expectedOutput:
            'A conflict resolution: reconciled sources or a rejected unreliable side.',
          allowedTools: [],
          budget: { timeoutMs: 120_000, maxTokens: 1_500 },
          retryPolicy: { maxRetries: 1, retryDelayMs: 50 },
          status: 'pending',
          order: base,
          phase: 'refine',
        };
        break;
      }
      case 'clarification_required':
      case 'finish':
      case 'stop':
        return false;
      default:
        return false;
    }

    graph.tasks.push(task);
    graph.terminalTaskIds = [task.taskId];
    graph.validated = true;
    return true;
  }

  /** Build one task from a template. */
  private toTask(
    template: TaskTemplate,
    index: number,
    dependencies: string[],
    spec: GoalSpecification,
    options: { taskTimeoutMs: number; taskMaxTokens: number },
  ): LoopTask {
    const requirement = spec.evidenceRequirements[0];
    const id = `task-${index + 1}`;
    return {
      taskId: id,
      title: template.title,
      description: template.description,
      capability: template.capability,
      qualityTier: template.qualityTier,
      dependencies,
      parallelEligible: template.parallelEligible === true,
      input: template.prompt,
      expectedOutput: template.expectedOutput,
      slot: template.slot,
      evidenceRequirement:
        template.evidence === true && requirement
          ? {
              collection: requirement.collection,
              query: requirement.queryTemplate,
              topK: requirement.topK ?? 5,
              groundingRequired: template.groundingRequired ?? requirement.groundingRequired,
            }
          : undefined,
      allowedTools: template.allowedTools,
      toolArguments: template.toolArguments,
      budget: {
        timeoutMs: options.taskTimeoutMs,
        maxTokens: options.taskMaxTokens,
      },
      retryPolicy: { maxRetries: 2, retryDelayMs: 100 },
      status: 'pending',
      order: index + 1,
      phase: template.phase,
    };
  }

  /** Validate the DAG and compute entry/terminal task ids. */
  private finalizeGraph(spec: GoalSpecification, tasks: LoopTask[]): LoopTaskGraph {
    const ids = new Set(tasks.map((t) => t.taskId));
    const validationReasons: string[] = [];

    // Acyclic + resolvable dependency check (simple: dependencies must exist).
    let valid = true;
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        if (!ids.has(dep)) {
          valid = false;
          validationReasons.push(`task ${task.taskId} depends on unknown task ${dep}`);
        }
      }
    }
    if (valid) {
      validationReasons.push('dependency graph is acyclic (no cycles by construction)');
    }

    const entryTaskIds = tasks.filter((t) => t.dependencies.length === 0).map((t) => t.taskId);
    const dependents = new Set<string>();
    for (const task of tasks) {
      for (const dep of task.dependencies) {
        dependents.add(dep);
      }
    }
    const terminalTaskIds = tasks.filter((t) => !dependents.has(t.taskId)).map((t) => t.taskId);

    return {
      goalId: spec.goalId,
      tasks,
      entryTaskIds,
      terminalTaskIds,
      validated: valid,
      validationReasons,
      createdAt: new Date().toISOString(),
      version: '1',
    };
  }

  /**
   * Deterministic dependency "waves": wave 0 = entry tasks; wave n = tasks
   * whose dependencies are all in earlier waves. Already-completed/failed
   * tasks count as satisfied dependencies (so adaptive refinement tasks that
   * depend on the last completed task become ready). Used to execute parallel
   * tasks in the same wave concurrently (bounded).
   */
  computeWaves(graph: LoopTaskGraph): string[][] {
    const waves: string[][] = [];
    // Non-pending tasks already satisfied their dependencies by construction.
    const placed = new Set<string>(
      graph.tasks.filter((t) => t.status !== 'pending').map((t) => t.taskId),
    );
    let guard = 0;
    const maxGuards = graph.tasks.length * graph.tasks.length + 1;

    while (placed.size < graph.tasks.length && guard < maxGuards) {
      guard += 1;
      const wave: string[] = [];
      for (const task of graph.tasks) {
        if (placed.has(task.taskId) || task.status !== 'pending') continue;
        const depsReady = task.dependencies.every((dep) => placed.has(dep));
        if (depsReady) wave.push(task.taskId);
      }
      if (wave.length === 0) break; // no progress → cycle or blocked
      wave.forEach((id) => placed.add(id));
      waves.push(wave);
    }
    return waves;
  }
}
