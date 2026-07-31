// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain: ExecutionTask
// Individual action in the Execution Engine - contains steps
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionPriority } from '../value-objects/ExecutionPriority.js';
import { ExecutionSchedule } from '../value-objects/ExecutionSchedule.js';
import { ExecutionProgress } from '../value-objects/ExecutionProgress.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import { ExecutionDependency } from '../value-objects/ExecutionDependency.js';
import { ExecutionStep } from './ExecutionStep.js';
import type { ExecutionContext } from '../value-objects/ExecutionContext.js';

export class ExecutionTask {
  private readonly _id: string;
  private readonly _label: string;
  private readonly _description: string;
  private _status: ExecutionStatus;
  private _priority: ExecutionPriority;
  private readonly _estimatedDuration: number;
  private _schedule?: ExecutionSchedule;
  private _progress: ExecutionProgress;
  private _result?: ExecutionResult;
  private _steps: ExecutionStep[];
  private _dependencies: ExecutionDependency[];
  private _context?: ExecutionContext;
  private readonly _tags: string[];
  private readonly _missionId?: string;
  private readonly _planId?: string;

  constructor(params: {
    id: string;
    label: string;
    description: string;
    status?: ExecutionStatus;
    priority?: ExecutionPriority;
    estimatedDuration?: number;
    schedule?: ExecutionSchedule;
    progress?: ExecutionProgress;
    steps?: ExecutionStep[];
    dependencies?: ExecutionDependency[];
    context?: ExecutionContext;
    tags?: string[];
    missionId?: string;
    planId?: string;
  }) {
    this._id = params.id;
    this._label = params.label;
    this._description = params.description;
    this._status = params.status ?? ExecutionStatus.pending();
    this._priority = params.priority ?? ExecutionPriority.medium();
    this._estimatedDuration = params.estimatedDuration ?? 30;
    this._schedule = params.schedule;
    this._progress = params.progress ?? ExecutionProgress.empty();
    this._steps = params.steps ?? [];
    this._dependencies = params.dependencies ?? [];
    this._context = params.context;
    this._tags = params.tags ?? [];
    this._missionId = params.missionId;
    this._planId = params.planId;
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
  get schedule(): ExecutionSchedule | undefined {
    return this._schedule;
  }
  get estimatedDuration(): number {
    return this._estimatedDuration;
  }
  get progress(): ExecutionProgress {
    return this._progress;
  }
  get result(): ExecutionResult | undefined {
    return this._result;
  }
  get steps(): readonly ExecutionStep[] {
    return Object.freeze([...this._steps]);
  }
  get dependencies(): readonly ExecutionDependency[] {
    return Object.freeze([...this._dependencies]);
  }
  get context(): ExecutionContext | undefined {
    return this._context;
  }
  get tags(): readonly string[] {
    return Object.freeze([...this._tags]);
  }
  get missionId(): string | undefined {
    return this._missionId;
  }
  get planId(): string | undefined {
    return this._planId;
  }

  /**
   * Check if this task has pending hard dependencies.
   * Note: Actual dependency resolution requires checking if the target
   * entities are completed. This is handled by ExecutionPlan.resolveDependencies().
   * At the task level, we report any hard dependencies as potentially blocking.
   */
  get hasHardDependencies(): boolean {
    return this._dependencies.some((d) => d.isHard);
  }

  get canStart(): boolean {
    return this._status.isReady || (this._status.isPending && !this.hasHardDependencies);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start(): void {
    if (this.canStart) {
      this._status = ExecutionStatus.inProgress();
    }
  }

  complete(result: ExecutionResult): void {
    this._result = result;
    this._progress = ExecutionProgress.complete();
    this._status = ExecutionStatus.completed();
  }

  fail(reason: string): void {
    this._result = ExecutionResult.failed(reason);
    this._status = ExecutionStatus.failed(reason);
  }

  pause(reason?: string): void {
    this._status = ExecutionStatus.paused(reason);
  }

  resume(): void {
    if (this._status.isPaused) {
      this._status = ExecutionStatus.inProgress();
    }
  }

  markReady(): void {
    if (this._status.isPending) {
      this._status = ExecutionStatus.ready();
    }
  }

  updatePriority(priority: ExecutionPriority): void {
    this._priority = priority;
  }

  setSchedule(schedule: ExecutionSchedule): void {
    this._schedule = schedule;
  }

  // ── Step Management ────────────────────────────────────────────────────

  addStep(step: ExecutionStep): void {
    this._steps = [...this._steps, step];
  }

  completeStep(stepId: string, result: ExecutionResult): void {
    const idx = this._steps.findIndex((s) => s.id === stepId);
    if (idx === -1) throw new Error(`Step not found: ${stepId}`);
    const step = this._steps[idx];
    if (step) step.complete(result);
    this._steps = [...this._steps];
    const completedCount = this._steps.filter((s) => s.status.isCompleted).length;
    this._progress = new ExecutionProgress(completedCount, this._steps.length);
  }

  // ── Dependency Management ──────────────────────────────────────────────

  addDependency(dependency: ExecutionDependency): void {
    this._dependencies = [...this._dependencies, dependency];
  }

  // ── Context ────────────────────────────────────────────────────────────

  updateContext(context: ExecutionContext): void {
    this._context = context;
  }

  toString(): string {
    return `${this._label} [${this._status.toString()}] (${this._progress.toString()})`;
  }
}
