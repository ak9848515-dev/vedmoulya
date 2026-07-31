// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: Relationship
// ARC-003/D03 — A connection between two entities in the knowledge graph
// ──────────────────────────────────────────────────────────────────

import { KnowledgeEdge } from './KnowledgeEdge.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { KnowledgeSource } from '../value-objects/KnowledgeSource.js';

export type RelationDirection = 'directed' | 'bidirectional';
export type RelationStrength = 'strong' | 'moderate' | 'weak';

/**
 * Relationship entity — a semantic connection between two knowledge
 * graph entities. Wraps KnowledgeEdge with higher-level relationship
 * semantics including directionality and strength.
 */
export class Relationship {
  private readonly _edge: KnowledgeEdge;
  private _direction: RelationDirection;
  private _strength: RelationStrength;
  private _description: string;

  constructor(
    edge: KnowledgeEdge,
    direction?: RelationDirection,
    strength?: RelationStrength,
    description?: string,
  ) {
    this._edge = edge;
    this._direction = direction ?? 'directed';
    this._strength = strength ?? 'moderate';
    this._description = description ?? edge.label;
  }

  get edge(): KnowledgeEdge {
    return this._edge;
  }
  get id(): KnowledgeEdgeId {
    return this._edge.id;
  }
  get graphId(): GraphId {
    return this._edge.graphId;
  }
  get sourceId(): KnowledgeNodeId {
    return this._edge.sourceId;
  }
  get targetId(): KnowledgeNodeId {
    return this._edge.targetId;
  }
  get type(): RelationshipType {
    return this._edge.type;
  }
  get label(): string {
    return this._edge.label;
  }
  get direction(): RelationDirection {
    return this._direction;
  }
  get strength(): RelationStrength {
    return this._strength;
  }
  get description(): string {
    return this._description;
  }
  get weight(): number {
    return this._edge.weight;
  }

  /** Make the relationship bidirectional */
  makeBidirectional(): void {
    this._direction = 'bidirectional';
  }

  /** Update relationship strength */
  updateStrength(strength: RelationStrength): void {
    this._strength = strength;
    this._edge.updateWeight(strength === 'strong' ? 0.9 : strength === 'moderate' ? 0.5 : 0.2);
  }

  /** Update description */
  updateDescription(description: string): void {
    this._description = description;
  }

  /** Check if this is a self-referencing relationship */
  isSelfReference(): boolean {
    return this._edge.sourceId === this._edge.targetId;
  }

  /** Get the inverse relationship type if applicable */
  getInverseType(): RelationshipType | null {
    const inverseMap: Record<string, string> = {
      DEPENDS_ON: 'SUPPORTS',
      BLOCKED_BY: 'BLOCKED_BY',
      PART_OF: 'CONTAINS',
      CREATED: 'CREATED_BY',
      MANAGES: 'REPORTS_TO',
      MENTORED_BY: 'MENTORED',
    };
    const inverse = inverseMap[this.type.type];
    return inverse
      ? RelationshipType.custom(inverse, 'association', inverse.toLowerCase().replace(/_/g, ' '))
      : null;
  }

  /** Create a new Relationship wrapping a KnowledgeEdge */
  static create(props: {
    edgeId: KnowledgeEdgeId;
    graphId: GraphId;
    sourceId: KnowledgeNodeId;
    targetId: KnowledgeNodeId;
    type: RelationshipType;
    label?: string;
    direction?: RelationDirection;
    strength?: RelationStrength;
    description?: string;
    weight?: number;
    source?: KnowledgeSource;
  }): Relationship {
    const edge = KnowledgeEdge.create({
      id: props.edgeId,
      graphId: props.graphId,
      sourceId: props.sourceId,
      targetId: props.targetId,
      type: props.type,
      label: props.label,
      weight: props.weight,
      source: props.source,
    });

    return new Relationship(edge, props.direction, props.strength, props.description);
  }
}
