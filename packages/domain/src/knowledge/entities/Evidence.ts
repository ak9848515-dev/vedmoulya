// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: Evidence
// ARC-003 — Proof that supports a claim, skill, or achievement
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export interface EvidenceClaim {
  type:
    | 'skill_demonstration'
    | 'project_outcome'
    | 'certification'
    | 'endorsement'
    | 'work_sample'
    | 'testimonial'
    | 'assessment'
    | 'publication';
  description: string;
  /** URL or reference to the evidence artifact */
  url?: string;
  /** Date the evidence was collected */
  collectedAt: Date;
  /** Who or what verified this evidence */
  verifiedBy?: string;
}

/**
 * Evidence entity — proof that supports a claim, skill, or achievement.
 * Every piece of evidence is traceable to its source.
 */
export class Evidence {
  private readonly _node: KnowledgeNode;
  private _claims: EvidenceClaim[];

  constructor(node: KnowledgeNode, claims?: EvidenceClaim[]) {
    this._node = node;
    this._claims = claims ?? [];
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
  get claims(): readonly EvidenceClaim[] {
    return Object.freeze([...this._claims]);
  }

  /** Add an evidence claim */
  addClaim(claim: EvidenceClaim): void {
    this._claims.push(claim);
  }

  /** Remove a claim by index */
  removeClaim(index: number): void {
    if (index >= 0 && index < this._claims.length) {
      this._claims = this._claims.filter((_, i) => i !== index);
    }
  }

  /** Check if evidence has been verified */
  isVerified(): boolean {
    return this._claims.some((c) => c.verifiedBy !== undefined);
  }

  /** Get all claims that have URLs (linkable evidence) */
  getLinkableClaims(): EvidenceClaim[] {
    return this._claims.filter((c) => c.url !== undefined);
  }

  /** Create a new Evidence entity */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    claims?: EvidenceClaim[];
  }): Evidence {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.evidence(),
      label: props.label,
      description: props.description,
    });
    return new Evidence(node, props.claims);
  }
}
