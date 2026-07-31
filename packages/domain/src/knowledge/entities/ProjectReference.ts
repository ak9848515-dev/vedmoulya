// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: ProjectReference
// ARC-003 — A project within the user's knowledge graph
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type ProjectPhase =
  'ideation' | 'planning' | 'execution' | 'review' | 'completed' | 'cancelled';

/**
 * ProjectReference entity — a project the User has worked on or is working on.
 * Projects link to goals, skills used, outcomes, and evidence.
 */
export class ProjectReference {
  private readonly _node: KnowledgeNode;
  private _phase: ProjectPhase;
  private readonly _startDate?: Date;
  private _endDate?: Date;
  private readonly _teamSize?: number;
  private _role?: string;

  constructor(
    node: KnowledgeNode,
    phase?: ProjectPhase,
    startDate?: Date,
    endDate?: Date,
    teamSize?: number,
    role?: string,
  ) {
    this._node = node;
    this._phase = phase ?? 'ideation';
    this._startDate = startDate;
    this._endDate = endDate;
    this._teamSize = teamSize;
    this._role = role;
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
  get phase(): ProjectPhase {
    return this._phase;
  }
  get startDate(): Date | undefined {
    return this._startDate;
  }
  get endDate(): Date | undefined {
    return this._endDate;
  }
  get teamSize(): number | undefined {
    return this._teamSize;
  }
  get role(): string | undefined {
    return this._role;
  }

  /** Update project phase */
  updatePhase(phase: ProjectPhase): void {
    this._phase = phase;
    if (phase === 'completed') {
      this._endDate = new Date();
    }
  }

  /** Set role */
  setRole(role: string): void {
    this._role = role;
  }

  /** Check if project is currently active */
  isActive(): boolean {
    return this._phase === 'execution' || this._phase === 'review';
  }

  /** Check if project is completed */
  isCompleted(): boolean {
    return this._phase === 'completed';
  }

  /** Get duration in days */
  getDurationDays(): number | undefined {
    if (!this._startDate) return undefined;
    const end = this._endDate ?? new Date();
    return Math.round((end.getTime() - this._startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** Create a new ProjectReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    phase?: ProjectPhase;
    startDate?: Date;
    endDate?: Date;
    teamSize?: number;
    role?: string;
  }): ProjectReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.project(),
      label: props.label,
      description: props.description,
    });
    return new ProjectReference(
      node,
      props.phase,
      props.startDate,
      props.endDate,
      props.teamSize,
      props.role,
    );
  }
}
