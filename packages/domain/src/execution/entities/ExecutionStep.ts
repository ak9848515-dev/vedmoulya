// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Domain: ExecutionStep
// Smallest atomic unit of work in the Execution Engine
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { ExecutionStatus } from '../value-objects/ExecutionStatus.js';
import { ExecutionResult } from '../value-objects/ExecutionResult.js';
import type { ExecutionContext } from '../value-objects/ExecutionContext.js';

export class ExecutionStep {
  private readonly _id: string;
  private readonly _label: string;
  private readonly _description: string;
  private _status: ExecutionStatus;
  private readonly _estimatedDuration: number; // minutes
  private _result?: ExecutionResult;
  private readonly _context?: ExecutionContext;
  private readonly _order: number;

  constructor(params: {
    id: string;
    label: string;
    description: string;
    status?: ExecutionStatus;
    estimatedDuration?: number;
    order?: number;
  }) {
    this._id = params.id;
    this._label = params.label;
    this._description = params.description;
    this._status = params.status ?? ExecutionStatus.pending();
    this._estimatedDuration = params.estimatedDuration ?? 15;
    this._order = params.order ?? 0;
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
  get estimatedDuration(): number {
    return this._estimatedDuration;
  }
  get result(): ExecutionResult | undefined {
    return this._result;
  }
  get context(): ExecutionContext | undefined {
    return this._context;
  }
  get order(): number {
    return this._order;
  }

  start(): void {
    this._status = ExecutionStatus.inProgress();
  }

  complete(result: ExecutionResult): void {
    this._result = result;
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
    this._status = ExecutionStatus.inProgress();
  }

  markReady(): void {
    if (this._status.isPending) {
      this._status = ExecutionStatus.ready();
    }
  }

  get isCompletable(): boolean {
    return this._status.isInProgress || this._status.isReady;
  }

  toString(): string {
    return `[${String(this._order)}] ${this._label} - ${this._status.toString()}`;
  }
}
