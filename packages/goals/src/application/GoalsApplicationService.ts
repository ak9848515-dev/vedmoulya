// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Application Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Facade over the domain goal/task services. Exposes the API surface:
// create/analyze/validate/explain/list/search goals, generate task
// plans (decomposition + prioritization + DAG + milestones), lifecycle
// transitions, task graph retrieval, strategy handoff (→ EI-004), and
// a summary. The engine understands goals — it never executes them.
// ──────────────────────────────────────────────────────────────────

import type {
  Goal,
  GoalInput,
  GoalLifecycleCommand,
  GoalSearchCriteria,
  StrategyHandoff,
  Task,
} from '../types/goal-types.js';
import { GoalUnderstandingService } from '../domain/services/GoalUnderstandingService.js';
import { ProblemUnderstandingService } from '../domain/services/ProblemUnderstandingService.js';
import type { ProblemDefinition } from '../types/problem-types.js';
import { GoalClassificationService } from '../domain/services/GoalClassificationService.js';
import { GoalHierarchyService } from '../domain/services/GoalHierarchyService.js';
import { GoalLifecycleService } from '../domain/services/GoalLifecycleService.js';
import { GoalEventService } from '../domain/services/GoalEventService.js';
import { SuccessCriteriaService } from '../domain/services/SuccessCriteriaService.js';
import { TaskDecompositionService } from '../domain/services/TaskDecompositionService.js';
import { TaskPrioritizationService } from '../domain/services/TaskPrioritizationService.js';
import { TaskDependencyGraphService } from '../domain/services/TaskDependencyGraphService.js';
import { GoalValidationService } from '../domain/services/GoalValidationService.js';
import type { GoalRepository } from '../domain/repository/GoalRepository.js';
import type { TaskRepository } from '../domain/repository/TaskRepository.js';
import { generateGoalId, generateMilestoneId } from '../domain/value-objects/Identifiers.js';
import { GoalMapper } from './GoalMapper.js';
import type {
  CreateGoalDTO,
  GoalDTO,
  GoalExplanationDTO,
  GoalSummaryDTO,
  GoalValidationDTO,
  StrategyHandoffDTO,
  TaskGraphDTO,
} from './GoalDTO.js';

export interface GoalResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Create input whose optional knobs normalize inside the service. */
export type CreateGoalInput = Omit<GoalInput, 'successCriteria'> & CreateGoalDTO;

export class GoalsApplicationService {
  private readonly understanding: GoalUnderstandingService;
  private readonly problemUnderstanding: ProblemUnderstandingService;
  private readonly classification: GoalClassificationService;
  private readonly hierarchy: GoalHierarchyService;
  private readonly lifecycle: GoalLifecycleService;
  private readonly events: GoalEventService;
  private readonly criteria: SuccessCriteriaService;
  private readonly decomposition: TaskDecompositionService;
  private readonly prioritization: TaskPrioritizationService;
  private readonly graph: TaskDependencyGraphService;
  private readonly validation: GoalValidationService;

  constructor(
    private readonly goalRepository: GoalRepository,
    private readonly taskRepository: TaskRepository,
  ) {
    this.understanding = new GoalUnderstandingService();
    this.problemUnderstanding = new ProblemUnderstandingService();
    this.classification = new GoalClassificationService();
    this.hierarchy = new GoalHierarchyService();
    this.lifecycle = new GoalLifecycleService();
    this.events = new GoalEventService();
    this.criteria = new SuccessCriteriaService();
    this.decomposition = new TaskDecompositionService();
    this.prioritization = new TaskPrioritizationService();
    this.graph = new TaskDependencyGraphService();
    this.validation = new GoalValidationService();
  }

  // ── Problem Understanding (SPRINT-023) ──────────────────────────────────

  /** Derive a typed ProblemDefinition from a raw problem statement. */
  understandProblem(problem: string): GoalResult<ProblemDefinition> {
    if (!problem || problem.trim().length === 0) {
      return { success: false, error: 'A problem statement is required.' };
    }
    if (problem.length > 4000) {
      return { success: false, error: 'Problem statement must be 4000 characters or fewer.' };
    }
    const definition = this.problemUnderstanding.understand(problem, {
      problemId: generateGoalId(),
    });
    return { success: true, data: definition };
  }

  // ── Goal: Create ─────────────────────────────────────────────────────────

  async createGoal(dto: CreateGoalInput): Promise<GoalResult<GoalDTO>> {
    const goalId = generateGoalId();
    const now = new Date().toISOString();

    // Resolve parent link before construction (hierarchy).
    let parent: Goal | undefined;
    if (dto.parentGoalId) {
      parent = await this.goalRepository.findById(dto.parentGoalId as never);
      if (!parent) {
        return { success: false, error: `Parent goal not found: ${dto.parentGoalId}` };
      }
    }

    const goal: Goal = {
      goalId,
      title: dto.title,
      description: dto.description,
      category: dto.category ?? 'custom',
      business: dto.business ?? [],
      priority: dto.priority ?? 'medium',
      urgency: clamp01(dto.urgency ?? 0.5),
      importance: clamp01(dto.importance ?? 0.5),
      complexity: 'moderate',
      estimatedEffort: dto.estimatedEffort ?? 8,
      status: 'proposed',
      confidence: 0.5,
      goalScore: 0,
      successCriteria: this.criteria.build(
        (dto.successCriteria ?? []).map((c) => ({
          definition: c.definition,
          validation: c.validation,
          completionCriteria: c.completionCriteria,
          expectedOutcome: c.expectedOutcome,
        })),
        dto.title,
        dto.description,
      ),
      milestones: [],
      dependencies: dto.dependencies ?? [],
      parentGoalId: parent?.goalId,
      childGoalIds: [],
      tags: dto.tags ?? [],
      metadata: {},
      events: [this.events.create(goalId, 'created', `Goal "${dto.title}" created.`)],
      createdAt: now,
      updatedAt: now,
    };

    // Immediate understanding + classification so a new goal is never bare.
    goal.analysis = this.understanding.analyze(goal, goalId);
    goal.category = goal.analysis.category;
    if (!dto.priority) goal.priority = goal.analysis.suggestedPriority;
    goal.classification = this.classification.classify(goal, goal.analysis, {
      effortHours: goal.estimatedEffort,
    });
    goal.confidence = Math.min(0.95, 0.5 + goal.classification.riskScore * 0.25);
    goal.goalScore = this.hierarchy.ownScore(goal);
    goal.events = this.events.append(
      goal.events,
      goalId,
      'analyzed',
      'Goal understood and classified.',
      {
        category: goal.category,
      },
    );

    if (parent) {
      const linked = this.hierarchy.link(parent, goal);
      await this.goalRepository.save(linked.parent);
      goal.parentGoalId = linked.child.parentGoalId;
      await this.goalRepository.save(linked.child);
      return { success: true, data: GoalMapper.goalToDTO(linked.child) };
    }

    await this.goalRepository.save(goal);
    return { success: true, data: GoalMapper.goalToDTO(goal) };
  }

  // ── Goal: Analyze ────────────────────────────────────────────────────────

  async analyzeGoal(goalId: string): Promise<GoalResult<GoalDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };

    goal.analysis = this.understanding.analyze(goal, goalId);
    goal.category = goal.analysis.category;
    goal.classification = this.classification.classify(goal, goal.analysis, {
      effortHours: goal.estimatedEffort,
    });
    goal.events = this.events.append(
      goal.events,
      goalId,
      'analyzed',
      'Goal re-analyzed and classified.',
      {},
    );
    await this.goalRepository.save(goal);
    return { success: true, data: GoalMapper.goalToDTO(goal) };
  }

  // ── Goal: Generate Tasks ─────────────────────────────────────────────────

  async generateTasks(goalId: string): Promise<GoalResult<TaskGraphDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };

    // Ensure classification exists before decomposition.
    if (!goal.classification || !goal.analysis) {
      const analysis = this.understanding.analyze(goal, goalId);
      goal.analysis = analysis;
      goal.category = analysis.category;
      goal.classification = this.classification.classify(goal, analysis, {
        effortHours: goal.estimatedEffort,
      });
    }

    // 1. Decompose.
    const { tasks } = this.decomposition.decompose(goal);

    // 2. Prioritize.
    const prioritized = this.prioritization.prioritize(tasks);

    // 3. Build milestones from template stages (one per root task group).
    const milestones = this.buildMilestones(prioritized);

    // 4. Dependency graph (DAG, critical path, parallel groups, slack).
    const graph = this.graph.build(goal.goalId, prioritized, milestones);

    // 5. Persist tasks + refresh goal classification with task-count hint.
    await this.taskRepository.saveMany(graph.tasks);
    goal.milestones = graph.milestones;
    goal.classification = this.classification.classify(goal, goal.analysis, {
      taskCountHint: graph.tasks.length,
      effortHours: goal.estimatedEffort,
    });
    goal.complexity = goal.classification.complexity;
    goal.events = this.events.append(
      goal.events,
      goalId,
      'decomposed',
      `Decomposed into ${String(graph.tasks.length)} tasks with critical path.`,
      {
        taskCount: graph.tasks.length,
      },
    );
    await this.goalRepository.save(goal);

    return { success: true, data: GoalMapper.taskGraphToDTO(graph) };
  }

  // ── Goal: Validate / Explain / Get / List / Search ───────────────────────

  async validateGoal(goalId: string): Promise<GoalResult<GoalValidationDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    const tasks = await this.taskRepository.findByGoal(goalId);
    const result = this.validation.validate(goal, tasks);
    goal.events = this.events.append(
      goal.events,
      goalId,
      'validated',
      result.passed ? 'Goal passed validation.' : `Validation failed: ${result.summary}`,
      { score: result.score },
    );
    await this.goalRepository.save(goal);
    return { success: true, data: GoalMapper.validationToDTO(result) };
  }

  async explainGoal(goalId: string): Promise<GoalResult<GoalExplanationDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    const tasks = await this.taskRepository.findByGoal(goalId);
    return { success: true, data: GoalMapper.explanationToDTO(goal, tasks) };
  }

  async getGoal(goalId: string): Promise<GoalResult<GoalDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    return { success: true, data: GoalMapper.goalToDTO(goal) };
  }

  async listGoals(): Promise<GoalResult<GoalDTO[]>> {
    const goals = await this.goalRepository.listAll();
    return { success: true, data: goals.map((g) => GoalMapper.goalToDTO(g)) };
  }

  async searchGoals(
    criteria: GoalSearchCriteria,
  ): Promise<GoalResult<{ items: GoalDTO[]; total: number }>> {
    const result = await this.goalRepository.search(criteria);
    return {
      success: true,
      data: { items: result.items.map((g) => GoalMapper.goalToDTO(g)), total: result.total },
    };
  }

  // ── Goal: Lifecycle ──────────────────────────────────────────────────────

  async transitionGoal(
    goalId: string,
    command: GoalLifecycleCommand,
  ): Promise<GoalResult<GoalDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    try {
      const next = this.lifecycle.transition(goal.status, command);
      const eventType = mapCommandToEvent(command.type);
      const message =
        command.type === 'block'
          ? `Goal blocked: ${command.reason}`
          : command.type === 'cancel'
            ? `Goal cancelled: ${command.reason}`
            : `Goal transitioned to ${next}.`;
      goal.status = next;
      goal.events = this.events.append(goal.events, goalId, eventType, message, { to: next });
      goal.updatedAt = new Date().toISOString();
      await this.goalRepository.save(goal);
      return { success: true, data: GoalMapper.goalToDTO(goal) };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Illegal goal transition.',
      };
    }
  }

  // ── Task Graph / Tasks ───────────────────────────────────────────────────

  async getTaskGraph(goalId: string): Promise<GoalResult<TaskGraphDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    const tasks = await this.taskRepository.findByGoal(goalId);
    if (tasks.length === 0) {
      return {
        success: true,
        data: GoalMapper.taskGraphToDTO({
          goalId,
          tasks: [],
          criticalPath: [],
          parallelGroups: [],
          milestones: goal.milestones,
          totalEstimatedTimeMs: 0,
          totalEstimatedCostUsd: 0,
          totalEstimatedTokens: 0,
          criticalPathLength: 0,
          validated: false,
        }),
      };
    }
    const graph = this.graph.build(goal.goalId, tasks, goal.milestones);
    return { success: true, data: GoalMapper.taskGraphToDTO(graph) };
  }

  async listTasks(goalId: string): Promise<GoalResult<TaskDTOList>> {
    const tasks = await this.taskRepository.findByGoal(goalId);
    return { success: true, data: tasks.map((t) => GoalMapper.taskToDTO(t)) };
  }

  // ── Strategy Handoff (EI-006 → EI-004) ───────────────────────────────────

  async buildStrategyHandoff(goalId: string): Promise<GoalResult<StrategyHandoffDTO>> {
    const goal = await this.goalRepository.findById(goalId as never);
    if (!goal) return { success: false, error: `Goal not found: ${goalId}` };
    const tasks = await this.taskRepository.findByGoal(goalId);
    if (tasks.length === 0) {
      return { success: false, error: 'Generate tasks before building a strategy handoff.' };
    }
    const handoff: StrategyHandoff = this.buildHandoff(goal, tasks);
    return { success: true, data: GoalMapper.handoffToDTO(handoff) };
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  async getSummary(): Promise<GoalResult<GoalSummaryDTO>> {
    const [goals, tasks] = await Promise.all([
      this.goalRepository.listAll(),
      this.taskRepository.listAll(),
    ]);
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const g of goals) {
      byCategory[g.category] = (byCategory[g.category] ?? 0) + 1;
      byStatus[g.status] = (byStatus[g.status] ?? 0) + 1;
      byPriority[g.priority] = (byPriority[g.priority] ?? 0) + 1;
    }
    const avgConfidence =
      goals.length > 0 ? goals.reduce((s, g) => s + g.confidence, 0) / goals.length : 0;
    const avgGoalScore =
      goals.length > 0 ? goals.reduce((s, g) => s + g.goalScore, 0) / goals.length : 0;
    return {
      success: true,
      data: GoalMapper.summaryToDTO({
        totalGoals: goals.length,
        activeGoals: goals.filter((g) => this.lifecycle.isActive(g.status)).length,
        completedGoals: goals.filter((g) => g.status === 'completed').length,
        blockedGoals: goals.filter((g) => g.status === 'blocked').length,
        byCategory,
        byStatus,
        byPriority,
        avgConfidence: Number(avgConfidence.toFixed(2)),
        avgGoalScore: Number(avgGoalScore.toFixed(2)),
        totalTasks: tasks.length,
      }),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private buildMilestones(tasks: Task[]): Goal['milestones'] {
    const roots = tasks.filter((t) => !t.parentTaskId);
    const groups: Task[][] = [];
    let current: Task[] = [];
    for (const task of roots.sort((a, b) => a.order - b.order)) {
      current.push(task);
      if (current.length === 3) {
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 0) groups.push(current);
    return groups.map((group, idx) => ({
      milestoneId: generateMilestoneId(),
      title: `Stage ${String(idx + 1)}: ${group.map((t) => t.title).join(', ')}`,
      description: `Milestone covering ${String(group.length)} task(s) of the goal plan.`,
      taskIds: group.map((t) => t.taskId),
      order: idx + 1,
      achieved: false,
    }));
  }

  private buildHandoff(goal: Goal, tasks: Task[]): StrategyHandoff {
    const totalTokens = tasks.reduce((s, t) => s + t.estimatedTokens, 0) || 1;
    const hasParallel = tasks.some((t) => t.parallelEligible);
    const mode = hasParallel ? 'hybrid' : 'sequential';
    return {
      goalId: goal.goalId,
      goal: goal.title,
      business: goal.business,
      priority: goal.priority,
      steps: tasks
        .filter((t) => !t.parentTaskId)
        .sort((a, b) => a.order - b.order)
        .map((t) => ({
          stepId: t.taskId,
          capability: t.capability,
          label: t.title,
          flowType: t.flowType,
          weight: Number((t.estimatedTokens / totalTokens).toFixed(2)) || 0.1,
        })),
      mode,
      estimatedTokens: totalTokens,
      estimatedCostUsd: Number(tasks.reduce((s, t) => s + t.estimatedCostUsd, 0).toFixed(2)),
    };
  }
}

type TaskDTOList = ReturnType<typeof GoalMapper.taskToDTO>[];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function mapCommandToEvent(command: string): Goal['events'][number]['type'] {
  switch (command) {
    case 'score':
      return 'scored';
    case 'accept':
      return 'accepted';
    case 'activate':
      return 'activated';
    case 'block':
      return 'blocked';
    case 'unblock':
      return 'resumed';
    case 'complete':
      return 'completed';
    case 'cancel':
      return 'cancelled';
    case 'archive':
      return 'archived';
    default:
      return 'scored';
  }
}
