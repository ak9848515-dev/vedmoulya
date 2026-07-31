// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: ExecutionReference
// ARC-003 — An execution action or task in the user's workflow
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type ExecutionStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

export interface ExecutionResult {
  status: ExecutionStatus;
  output?: string;
  completedAt?: Date;
  durationMinutes?: number;
}

/**
 * ExecutionReference entity — an action, task, or execution step
 * performed by or tracked for the User.
 */
export class ExecutionReference {
  private readonly _node: KnowledgeNode;
  private _executionResult: ExecutionResult;
  private readonly _assignedTo?: string;
  private _priority: number;

  constructor(
    node: KnowledgeNode,
    result?: Partial<ExecutionResult>,
    assignedTo?: string,
    priority?: number,
  ) {
    this._node = node;
    this._executionResult = {
      status: result?.status ?? 'pending',
      output: result?.output,
      completedAt: result?.completedAt,
      durationMinutes: result?.durationMinutes,
    };
    this._assignedTo = assignedTo;
    this._priority = priority ?? 0;
  }

  get node(): KnowledgeNode {
    return this._node;
  }
  get id(): KnowledgeNodeId {
    return this._node.id;
  }
  get graphId(): GraphId {
    return this._node.graphId;
  }
  get name(): string {
    return this._node.label;
  }
  get executionResult(): ExecutionResult {
    return this._executionResult;
  }
  get assignedTo(): string | undefined {
    return this._assignedTo;
  }
  get priority(): number {
    return this._priority;
  }

  /** Mark as in progress */
  start(): void {
    this._executionResult = { ...this._executionResult, status: 'in_progress' };
  }

  /** Mark as completed */
  complete(output?: string): void {
    this._executionResult = {
      status: 'completed',
      output,
      completedAt: new Date(),
      durationMinutes: this._executionResult.durationMinutes,
    };
  }

  /** Mark as blocked */
  block(reason: string): void {
    this._executionResult = { ...this._executionResult, status: 'blocked', output: reason };
  }

  /** Set priority */
  setPriority(priority: number): void {
    this._priority = priority;
  }

  /** Create a new ExecutionReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    result?: Partial<ExecutionResult>;
    assignedTo?: string;
    priority?: number;
  }): ExecutionReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.reference(),
      label: props.label,
      description: props.description,
    });
    return new ExecutionReference(node, props.result, props.assignedTo, props.priority);
  }
}
