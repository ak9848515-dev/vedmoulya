// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain: ExecutionMission
// Major work stream or project within an execution plan
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionTask } from './ExecutionTask.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';

export class ExecutionMission {
  private readonly _id: string;
  private readonly _label: string;
  private readonly _description: string;
  private _status: ExecutionStatus;
  private _priority: ExecutionPriority;
  private _progress: ExecutionProgress;
  private _result?: ExecutionResult;
  private _tasks: ExecutionTask[];
  private readonly _dependencies: ExecutionDependency[];
  private readonly _tags: string[];
  private readonly _planId: string;
  private readonly _targetDate?: Date;

  constructor(params: {
    id: string;
    label: string;
    description: string;
    status?: ExecutionStatus;
    priority?: ExecutionPriority;
    progress?: ExecutionProgress;
    tasks?: ExecutionTask[];
    dependencies?: ExecutionDependency[];
    tags?: string[];
    planId: string;
    targetDate?: Date;
  }) {
    this._id = params.id;
    this._label = params.label;
    this._description = params.description;
    this._status = params.status ?? ExecutionStatus.pending();
    this._priority = params.priority ?? ExecutionPriority.medium();
    this._progress = params.progress ?? ExecutionProgress.empty();
    this._tasks = params.tasks ?? [];
    this._dependencies = params.dependencies ?? [];
    this._tags = params.tags ?? [];
    this._planId = params.planId;
    this._targetDate = params.targetDate;
  }

  get id(): string {
    return this._id;
  }
  get label(): string {
    return this._label;
  }
  get description(): string {
    return this._description;
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
  get tasks(): readonly ExecutionTask[] {
    return Object.freeze([...this._tasks]);
  }
  get dependencies(): readonly ExecutionDependency[] {
    return Object.freeze([...this._dependencies]);
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get planId(): string {
    return this._planId;
  }
  get targetDate(): Date | undefined {
    return this._targetDate;
  }

  get totalTasks(): number {
    return this._tasks.length;
  }
  get completedTasks(): number {
    return this._tasks.filter((t) => t.status.isCompleted).length;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start(): void {
    this._status = ExecutionStatus.inProgress();
  }

  complete(result: ExecutionResult): void {
    this._result = result;
    this._progress = ExecutionProgress.complete();
    this._status = ExecutionStatus.completed();
  }

  pause(reason?: string): void {
    this._status = ExecutionStatus.paused(reason);
  }

  resume(): void {
    if (this._status.isPaused) this._status = ExecutionStatus.inProgress();
  }

  updatePriority(priority: ExecutionPriority): void {
    this._priority = priority;
  }

  // ── Task Management ────────────────────────────────────────────────────

  addTask(task: ExecutionTask): void {
    this._tasks = [...this._tasks, task];
    this._updateProgress();
  }

  completeTask(taskId: string, result: ExecutionResult): void {
    const idx = this._tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) throw new Error(`Task not found: ${taskId}`);
    const task = this._tasks[idx];
    if (task) {
      task.complete(result);
    }
    this._tasks = [...this._tasks];
    this._updateProgress();
  }

  private _updateProgress(): void {
    const completed = this._tasks.filter((t) => t.status.isCompleted).length;
    const total = this._tasks.length;
    this._progress = new ExecutionProgress(completed, Math.max(1, total));
  }

  recalculateProgress(): void {
    this._updateProgress();
  }

  toString(): string {
    return `${this._label} [${this._status.toString()}] (${this._progress.toString()})`;
  }
}
