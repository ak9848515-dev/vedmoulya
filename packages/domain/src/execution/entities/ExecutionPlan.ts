/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain: ExecutionPlan (Aggregate Root)
// Core entity in the Execution Intelligence Engine
// ARC-004 — Execution Intelligence Engine Bounded Context
// BLD-008 contracts consumed for Decision integration
// ──────────────────────────────────────────────────────────────────

import { ExecutionStatus, type ExecutionStatusValue } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionTimeline } from '../value-objects/ExecutionTimeline.js';
import { ExecutionContext } from '../value-objects/ExecutionContext.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionMission } from './ExecutionMission.js';
import { ExecutionTask } from './ExecutionTask.js';
import type { ExecutionEvent } from '../events/ExecutionEvent.js';
import { createExecutionEvent } from '../events/ExecutionEvent.js';

export type PlanningLevel = 'strategic' | 'tactical' | 'operational' | 'daily';

export interface GoalReference {
  goalId: string;
  label: string;
  description: string;
}

export interface DecisionReference {
  decisionId: string;
  title: string;
  selectedOption: string;
}

/**
 * ExecutionPlan — the aggregate root of the Execution Intelligence Engine.
 *
 * Every execution must be:
 * - Explainable (recorded reasoning, assumptions, context)
 * - Traceable (versioned, timestamped, linked to decisions)
 * - Observable (events emitted for every state change)
 *
 * Decision Engine decides. Execution Engine executes.
 * Knowledge Graph owns semantic truth. Memory owns history.
 */
export class ExecutionPlan {
  private readonly _id: string;
  private readonly _title: string;
  private readonly _description: string;
  private readonly _planningLevel: PlanningLevel;
  private _status: ExecutionStatus;
  private _priority: ExecutionPriority;
  private _progress: ExecutionProgress;
  private _result?: ExecutionResult;
  private _timeline: ExecutionTimeline;
  private _missions: ExecutionMission[];
  private _tasks: ExecutionTask[];
  private _dependencies: ExecutionDependency[];
  private _context: ExecutionContext;
  private _tags: string[];

  // Goal & Decision references (consume only from Decision Engine)
  private _goalReferences: GoalReference[];
  private _decisionReferences: DecisionReference[];

  // Knowledge Graph & Memory references (never duplicate)
  private _knowledgeNodeIds: string[];
  private _memoryIds: string[];

  // Metadata
  private _metadata: Record<string, unknown>;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private _completedAt?: Date;

  // Events
  private readonly _events: ExecutionEvent[] = [];

  constructor(params: {
    id: string;
    title: string;
    description: string;
    planningLevel?: PlanningLevel;
    status?: ExecutionStatus;
    priority?: ExecutionPriority;
    progress?: ExecutionProgress;
    timeline?: ExecutionTimeline;
    missions?: ExecutionMission[];
    tasks?: ExecutionTask[];
    dependencies?: ExecutionDependency[];
    context?: ExecutionContext;
    tags?: string[];
    goalReferences?: GoalReference[];
    decisionReferences?: DecisionReference[];
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
    completedAt?: Date;
  }) {
    this._id = params.id;
    this._title = params.title;
    this._description = params.description;
    this._planningLevel = params.planningLevel ?? 'operational';
    this._status = params.status ?? ExecutionStatus.pending();
    this._priority = params.priority ?? ExecutionPriority.medium();
    this._progress = params.progress ?? ExecutionProgress.empty();
    this._timeline = params.timeline ?? ExecutionTimeline.empty();
    this._missions = params.missions ?? [];
    this._tasks = params.tasks ?? [];
    this._dependencies = params.dependencies ?? [];
    this._context = params.context ?? ExecutionContext.empty();
    this._tags = params.tags ?? [];
    this._goalReferences = params.goalReferences ?? [];
    this._decisionReferences = params.decisionReferences ?? [];
    this._knowledgeNodeIds = params.knowledgeNodeIds ?? [];
    this._memoryIds = params.memoryIds ?? [];
    this._metadata = params.metadata ?? {};
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
    this._completedAt = params.completedAt;
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }
  get title(): string {
    return this._title;
  }
  get description(): string {
    return this._description;
  }
  get planningLevel(): PlanningLevel {
    return this._planningLevel;
  }
  get status(): ExecutionStatus {
    return this._status;
  }
  get priority(): ExecutionPriority {
    return this._priority;
  }
  get progress(): ExecutionProgress {
    return this._progress;
  }
  get result(): ExecutionResult | undefined {
    return this._result;
  }
  get timeline(): ExecutionTimeline {
    return this._timeline;
  }
  get missions(): readonly ExecutionMission[] {
    return Object.freeze([...this._missions]);
  }
  get tasks(): readonly ExecutionTask[] {
    return Object.freeze([...this._tasks]);
  }
  get dependencies(): readonly ExecutionDependency[] {
    return Object.freeze([...this._dependencies]);
  }
  get context(): ExecutionContext {
    return this._context;
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get goalReferences(): readonly GoalReference[] {
    return Object.freeze([...this._goalReferences]);
  }
  get decisionReferences(): readonly DecisionReference[] {
    return Object.freeze([...this._decisionReferences]);
  }
  get knowledgeNodeIds(): readonly string[] {
    return Object.freeze([...this._knowledgeNodeIds]);
  }
  get memoryIds(): readonly string[] {
    return Object.freeze([...this._memoryIds]);
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get completedAt(): Date | undefined {
    return this._completedAt;
  }

  get totalMissions(): number {
    return this._missions.length;
  }
  get completedMissions(): number {
    return this._missions.filter((m) => m.status.isCompleted).length;
  }
  get totalTasks(): number {
    return this._tasks.length;
  }
  get completedTasks(): number {
    return this._tasks.filter((t) => t.status.isCompleted).length;
  }

  /** Drain and return all pending domain events */
  pullEvents(): ExecutionEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── Lifecycle Transitions ──────────────────────────────────────────────

  private transitionTo(status: ExecutionStatusValue, reason?: string): void {
    if (!this._status.canTransitionTo(status)) {
      throw new Error(`Cannot transition plan from ${this._status.toString()} to ${status}`);
    }
    this._status = ExecutionStatus.fromStatus(status, reason);
    this._updatedAt = new Date();
    this._timeline = this._timeline.addEntry(
      'status.changed',
      `Status changed to ${status}`,
      this._id,
      'plan',
    );
    this._events.push(
      createExecutionEvent('plan.status_changed', this._id, {
        from: this._status.toString(),
        to: status,
        reason,
      }),
    );
  }

  /** Activate the plan - moves from pending to ready */
  activate(): void {
    this.transitionTo('ready');
    this._events.push(createExecutionEvent('plan.activated', this._id, { title: this._title }));
  }

  /** Start execution */
  start(): void {
    this.transitionTo('in_progress');
    this._events.push(createExecutionEvent('plan.started', this._id, {}));
  }

  /** Pause execution */
  pause(reason?: string): void {
    this.transitionTo('paused', reason);
    this._events.push(createExecutionEvent('plan.paused', this._id, { reason }));
  }

  /** Resume execution */
  resume(): void {
    if (this._status.isPaused) {
      this.transitionTo('in_progress');
      this._events.push(createExecutionEvent('plan.resumed', this._id, {}));
    }
  }

  /** Complete the plan with results */
  complete(result: ExecutionResult): void {
    this._result = result;
    this._progress = ExecutionProgress.complete();
    this._completedAt = new Date();
    this._updatedAt = new Date();
    this._status = ExecutionStatus.completed();
    this._timeline = this._timeline.addEntry(
      'plan.completed',
      `Plan completed: ${result.description}`,
      this._id,
      'plan',
    );
    this._events.push(
      createExecutionEvent('plan.completed', this._id, {
        result: result.value,
        description: result.description,
      }),
    );
  }

  /** Cancel the plan */
  cancel(reason: string): void {
    this.transitionTo('cancelled', reason);
    this._events.push(createExecutionEvent('plan.cancelled', this._id, { reason }));
  }

  /** Mark plan as failed */
  fail(reason: string): void {
    this._result = ExecutionResult.failed(reason);
    this._updatedAt = new Date();
    this._status = ExecutionStatus.failed(reason);
    this._timeline = this._timeline.addEntry(
      'plan.failed',
      `Plan failed: ${reason}`,
      this._id,
      'plan',
    );
    this._events.push(createExecutionEvent('plan.failed', this._id, { reason }));
  }

  // ── Mission Management ─────────────────────────────────────────────────

  addMission(mission: ExecutionMission): void {
    this._missions = [...this._missions, mission];
    this._updatedAt = new Date();
    this._recalculateProgress();
    this._events.push(
      createExecutionEvent('plan.mission_added', this._id, {
        missionId: mission.id,
        label: mission.label,
      }),
    );
  }

  completeMission(missionId: string, result: ExecutionResult): void {
    const idx = this._missions.findIndex((m) => m.id === missionId);
    if (idx === -1) throw new Error(`Mission not found: ${missionId}`);
    const mission = this._missions[idx];
    if (mission) mission.complete(result);
    this._missions = [...this._missions];
    this._recalculateProgress();
  }

  // ── Task Management ────────────────────────────────────────────────────

  addTask(task: ExecutionTask): void {
    this._tasks = [...this._tasks, task];
    this._updatedAt = new Date();
    this._recalculateProgress();
    this._events.push(
      createExecutionEvent('plan.task_added', this._id, {
        taskId: task.id,
        label: task.label,
      }),
    );
  }

  completeTask(taskId: string, result: ExecutionResult): void {
    const idx = this._tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error(`Task not found: ${taskId}`);
    const task = this._tasks[idx];
    if (task) task.complete(result);
    this._tasks = [...this._tasks];
    this._recalculateProgress();
    this._events.push(
      createExecutionEvent('plan.task_completed', this._id, {
        taskId,
        result: result.value,
      }),
    );
  }

  // ── Dependency Management ──────────────────────────────────────────────

  addDependency(dependency: ExecutionDependency): void {
    this._dependencies = [...this._dependencies, dependency];
    this._updatedAt = new Date();
  }

  /** Resolve all dependencies and identify blocking ones */
  resolveDependencies(): Array<{ taskId: string; blockedBy: string[] }> {
    return this._tasks
      .filter((t) => t.hasHardDependencies)
      .map((t) => ({
        taskId: t.id,
        // A dependency is stored on the blocked task (e.g. finishToStart('t2', 't1')
        // on t1), so the blocker is the dependency's sourceId, not its targetId.
        blockedBy: t.dependencies.filter((d) => d.isHard).map((d) => d.sourceId),
      }));
  }

  // ── Priority ───────────────────────────────────────────────────────────

  updatePriority(priority: ExecutionPriority): void {
    this._priority = priority;
    this._updatedAt = new Date();
  }

  /** Rebalance priorities across all missions and tasks */
  rebalancePriorities(): void {
    const order: Array<'critical' | 'high' | 'medium' | 'low' | 'optional'> = [
      'critical',
      'high',
      'medium',
      'low',
      'optional',
    ];
    for (const mission of this._missions) {
      const priorityScore = order.indexOf(mission.priority.level);
      for (const task of this._tasks.filter((t) => t.missionId === mission.id)) {
        const taskPriority =
          priorityScore <= 2 ? ExecutionPriority.high() : ExecutionPriority.medium();
        task.updatePriority(taskPriority);
      }
    }
  }

  // ── Context ────────────────────────────────────────────────────────────

  updateContext(context: ExecutionContext): void {
    this._context = context;
    this._updatedAt = new Date();
  }

  // ── Progress ───────────────────────────────────────────────────────────

  private _recalculateProgress(): void {
    const total = this._tasks.length + this._missions.length;
    const completed =
      this._tasks.filter((t) => t.status.isCompleted).length +
      this._missions.filter((m) => m.status.isCompleted).length;
    this._progress = new ExecutionProgress(completed, Math.max(1, total));
  }

  recalculateProgress(): void {
    this._recalculateProgress();
    this._updatedAt = new Date();
  }

  /** Track progress - record current state */
  trackProgress(): {
    overall: ExecutionProgress;
    missions: Array<{ id: string; progress: ExecutionProgress }>;
  } {
    return {
      overall: this._progress,
      missions: this._missions.map((m) => ({
        id: m.id,
        progress: m.progress,
      })),
    };
  }

  /** Analyze bottlenecks in the plan */
  analyzeBottlenecks(): Array<{ entityId: string; entityType: string; issue: string }> {
    const bottlenecks: Array<{ entityId: string; entityType: string; issue: string }> = [];

    for (const task of this._tasks) {
      if (task.status.isBlocked) {
        bottlenecks.push({
          entityId: task.id,
          entityType: 'task',
          issue: 'Task is blocked',
        });
      }
      if (task.hasHardDependencies) {
        bottlenecks.push({
          entityId: task.id,
          entityType: 'task',
          issue: `Waiting for dependencies: ${task.dependencies
            .filter((d) => d.isHard)
            .map((d) => d.targetId)
            .join(', ')}`,
        });
      }
      if (task.status.isPaused) {
        bottlenecks.push({
          entityId: task.id,
          entityType: 'task',
          issue: 'Task is paused',
        });
      }
    }

    return bottlenecks;
  }

  // ── Goal & Decision Reference ──────────────────────────────────────────

  /** Link to a goal (consume only - never modify goals) */
  linkGoal(goal: GoalReference): void {
    if (!this._goalReferences.some((g) => g.goalId === goal.goalId)) {
      this._goalReferences = [...this._goalReferences, goal];
      this._updatedAt = new Date();
    }
  }

  /** Link to a Decision Engine decision (consume only) */
  linkDecision(decision: DecisionReference): void {
    if (!this._decisionReferences.some((d) => d.decisionId === decision.decisionId)) {
      this._decisionReferences = [...this._decisionReferences, decision];
      this._updatedAt = new Date();
      this._events.push(
        createExecutionEvent('plan.decision_linked', this._id, {
          decisionId: decision.decisionId,
        }),
      );
    }
  }

  /** Link to a Knowledge Graph node (reference only, never duplicate) */
  linkKnowledgeNode(nodeId: string): void {
    if (!this._knowledgeNodeIds.includes(nodeId)) {
      this._knowledgeNodeIds = [...this._knowledgeNodeIds, nodeId];
      this._updatedAt = new Date();
    }
  }

  /** Link to a Memory entry (reference only, never duplicate) */
  linkMemory(memoryId: string): void {
    if (!this._memoryIds.includes(memoryId)) {
      this._memoryIds = [...this._memoryIds, memoryId];
      this._updatedAt = new Date();
    }
  }

  // ── Tags & Metadata ─────────────────────────────────────────────────────

  addTag(tag: string): void {
    if (!this._tags.includes(tag)) {
      this._tags = [...this._tags, tag];
      this._updatedAt = new Date();
    }
  }

  updateMetadata(data: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...data };
    this._updatedAt = new Date();
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new ExecutionPlan */
  static create(params: {
    id: string;
    title: string;
    description: string;
    planningLevel?: PlanningLevel;
    priority?: ExecutionPriority;
    goalReferences?: GoalReference[];
    decisionReferences?: DecisionReference[];
    knowledgeNodeIds?: string[];
    memoryIds?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): ExecutionPlan {
    const plan = new ExecutionPlan({
      id: params.id,
      title: params.title,
      description: params.description,
      planningLevel: params.planningLevel,
      priority: params.priority,
      goalReferences: params.goalReferences,
      decisionReferences: params.decisionReferences,
      knowledgeNodeIds: params.knowledgeNodeIds,
      memoryIds: params.memoryIds,
      tags: params.tags,
      metadata: params.metadata,
    });

    plan._events.push(
      createExecutionEvent('plan.created', params.id, {
        title: params.title,
        planningLevel: params.planningLevel ?? 'operational',
      }),
    );

    return plan;
  }

  toString(): string {
    return `${this._title} [${this._planningLevel}] (${this._progress.toString()})`;
  }
}
