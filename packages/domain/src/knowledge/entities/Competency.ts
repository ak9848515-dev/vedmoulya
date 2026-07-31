// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: Competency
// A demonstrable ability composed of multiple skills and knowledge
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export interface CompetencyLevel {
  name: string;
  score: number; // 0.0 to 1.0
  order: number;
}

/**
 * Competency entity — a demonstrable ability composed of multiple skills
 * and knowledge areas that together enable a capability.
 */
export class Competency {
  private readonly _node: KnowledgeNode;
  private _level: CompetencyLevel;
  private _skillIds: KnowledgeNodeId[];

  constructor(node: KnowledgeNode, level?: CompetencyLevel, skillIds?: KnowledgeNodeId[]) {
    this._node = node;
    this._level = level ?? { name: 'developing', score: 0.0, order: 0 };
    this._skillIds = skillIds ?? [];
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
  get level(): CompetencyLevel {
    return this._level;
  }
  get skillIds(): readonly KnowledgeNodeId[] {
    return Object.freeze([...this._skillIds]);
  }

  /** Update competency level */
  updateLevel(level: CompetencyLevel): void {
    this._level = level;
  }

  /** Add a skill that contributes to this competency */
  addSkill(skillId: KnowledgeNodeId): void {
    if (!this._skillIds.includes(skillId)) {
      this._skillIds.push(skillId);
    }
  }

  /** Remove a skill from this competency */
  removeSkill(skillId: KnowledgeNodeId): void {
    this._skillIds = this._skillIds.filter((id) => id !== skillId);
  }

  /** Check if competency is at proficient level or above */
  isProficient(): boolean {
    return this._level.score >= 0.6;
  }

  /** Create a new Competency */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    name: string;
    description?: string;
    level?: CompetencyLevel;
    skillIds?: KnowledgeNodeId[];
  }): Competency {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.competency(),
      label: props.name,
      description: props.description,
    });
    return new Competency(node, props.level, props.skillIds);
  }
}
