// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: GoalReference
// ARC-003 — A reference to a goal within the knowledge graph
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned' | 'on_hold';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export interface GoalTarget {
  metric: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  deadline?: Date;
}

/**
 * GoalReference entity — a goal that the User has set,
 * linked to projects, skills, and other knowledge graph nodes.
 */
export class GoalReference {
  private readonly _node: KnowledgeNode;
  private _goalStatus: GoalStatus;
  private _priority: GoalPriority;
  private readonly _targets: GoalTarget[];
  private readonly _deadline?: Date;

  constructor(
    node: KnowledgeNode,
    goalStatus?: GoalStatus,
    priority?: GoalPriority,
    targets?: GoalTarget[],
    deadline?: Date,
  ) {
    this._node = node;
    this._goalStatus = goalStatus ?? 'not_started';
    this._priority = priority ?? 'medium';
    this._targets = targets ?? [];
    this._deadline = deadline;
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
  get goalStatus(): GoalStatus {
    return this._goalStatus;
  }
  get priority(): GoalPriority {
    return this._priority;
  }
  get targets(): readonly GoalTarget[] {
    return Object.freeze([...this._targets]);
  }
  get deadline(): Date | undefined {
    return this._deadline;
  }

  /** Update goal status */
  updateStatus(status: GoalStatus): void {
    this._goalStatus = status;
  }

  /** Update priority */
  updatePriority(priority: GoalPriority): void {
    this._priority = priority;
  }

  /** Add a target metric */
  addTarget(target: GoalTarget): void {
    this._targets.push(target);
  }

  /** Update progress on a target */
  updateTargetProgress(metric: string, currentValue: number): void {
    const target = this._targets.find((t) => t.metric === metric);
    if (target) {
      target.currentValue = currentValue;
    }
  }

  /** Calculate overall progress (0-1) based on targets */
  getProgress(): number {
    if (this._targets.length === 0) return 0;
    const totalProgress = this._targets.reduce((sum, t) => {
      return sum + (t.targetValue > 0 ? t.currentValue / t.targetValue : 0);
    }, 0);
    return Math.min(1, totalProgress / this._targets.length);
  }

  /** Check if the goal is on track based on deadline */
  isOnTrack(): boolean {
    if (!this._deadline) return true;
    return this.getProgress() >= 0.5 || new Date() < this._deadline;
  }

  /** Create a new GoalReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    goalStatus?: GoalStatus;
    priority?: GoalPriority;
    targets?: GoalTarget[];
    deadline?: Date;
  }): GoalReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.goal(),
      label: props.label,
      description: props.description,
    });
    return new GoalReference(node, props.goalStatus, props.priority, props.targets, props.deadline);
  }
}
