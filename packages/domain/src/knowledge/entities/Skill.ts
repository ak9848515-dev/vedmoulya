// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: Skill
// A capability the User possesses or is developing
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export interface SkillProficiency {
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  score: number; // 0.0 to 1.0
}

/**
 * Skill entity — a capability the User possesses or is developing.
 * Extends KnowledgeNode with proficiency tracking.
 */
export class Skill {
  private readonly _node: KnowledgeNode;
  private _proficiency: SkillProficiency;
  private readonly _yearsOfExperience: number;
  private _lastPracticedAt?: Date;

  constructor(
    node: KnowledgeNode,
    proficiency?: SkillProficiency,
    yearsOfExperience?: number,
    lastPracticedAt?: Date,
  ) {
    this._node = node;
    this._proficiency = proficiency ?? { level: 'beginner', score: 0.0 };
    this._yearsOfExperience = yearsOfExperience ?? 0;
    this._lastPracticedAt = lastPracticedAt;
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
  get proficiency(): SkillProficiency {
    return this._proficiency;
  }
  get yearsOfExperience(): number {
    return this._yearsOfExperience;
  }
  get lastPracticedAt(): Date | undefined {
    return this._lastPracticedAt;
  }

  /** Update proficiency level */
  updateProficiency(proficiency: SkillProficiency): void {
    this._proficiency = proficiency;
    this._lastPracticedAt = new Date();
  }

  /** Record practice session */
  recordPractice(): void {
    this._lastPracticedAt = new Date();
  }

  /** Check if skill is expert level or above */
  isExpert(): boolean {
    return this._proficiency.level === 'expert' || this._proficiency.level === 'master';
  }

  /** Create a new Skill */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    name: string;
    description?: string;
    proficiency?: SkillProficiency;
    yearsOfExperience?: number;
  }): Skill {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.skill(),
      label: props.name,
      description: props.description,
    });
    return new Skill(node, props.proficiency, props.yearsOfExperience);
  }
}
