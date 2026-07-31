// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: CareerReference
// ARC-003 — A career event in the user's professional journey
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type CareerEventType =
  | 'job'
  | 'promotion'
  | 'role_change'
  | 'interview'
  | 'networking_event'
  | 'conference'
  | 'certification'
  | 'freelance_gig'
  | 'volunteering'
  | 'internship';

/**
 * CareerReference entity — a career event in the User's professional journey.
 * Links to skills used, projects completed, and outcomes achieved.
 */
export class CareerReference {
  private readonly _node: KnowledgeNode;
  private readonly _eventType: CareerEventType;
  private readonly _organization: string;
  private readonly _startDate: Date;
  private _endDate?: Date;
  private _isCurrent: boolean;

  constructor(
    node: KnowledgeNode,
    eventType: CareerEventType,
    organization: string,
    startDate: Date,
    endDate?: Date,
    isCurrent?: boolean,
  ) {
    this._node = node;
    this._eventType = eventType;
    this._organization = organization;
    this._startDate = startDate;
    this._endDate = endDate;
    this._isCurrent = isCurrent ?? false;
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
  get eventType(): CareerEventType {
    return this._eventType;
  }
  get organization(): string {
    return this._organization;
  }
  get startDate(): Date {
    return this._startDate;
  }
  get endDate(): Date | undefined {
    return this._endDate;
  }
  get isCurrent(): boolean {
    return this._isCurrent;
  }

  /** End this career event */
  end(endDate: Date): void {
    this._endDate = endDate;
    this._isCurrent = false;
  }

  /** Mark as current position */
  markAsCurrent(): void {
    this._isCurrent = true;
    this._endDate = undefined;
  }

  /** Get duration in months */
  getDurationMonths(): number {
    const end = this._endDate ?? new Date();
    return Math.round((end.getTime() - this._startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  /** Create a new CareerReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    eventType: CareerEventType;
    organization: string;
    startDate: Date;
    endDate?: Date;
    isCurrent?: boolean;
  }): CareerReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.career(),
      label: props.label,
      description: props.description,
    });
    return new CareerReference(
      node,
      props.eventType,
      props.organization,
      props.startDate,
      props.endDate,
      props.isCurrent,
    );
  }
}
