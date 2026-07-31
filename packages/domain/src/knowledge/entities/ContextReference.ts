// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: ContextReference
// ARC-003 — Contextual information that supports understanding of other nodes
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type ContextScope =
  'personal' | 'professional' | 'technical' | 'social' | 'environmental' | 'temporal';

export interface ContextualFactor {
  scope: ContextScope;
  key: string;
  value: string;
  description?: string;
}

/**
 * ContextReference entity — contextual information that supports
 * understanding of other nodes in the knowledge graph.
 * Used for Minimum Context Principle — provides just-in-time context.
 */
export class ContextReference {
  private readonly _node: KnowledgeNode;
  private readonly _scope: ContextScope;
  private _factors: ContextualFactor[];

  constructor(node: KnowledgeNode, scope?: ContextScope, factors?: ContextualFactor[]) {
    this._node = node;
    this._scope = scope ?? 'personal';
    this._factors = factors ?? [];
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
  get scope(): ContextScope {
    return this._scope;
  }
  get factors(): readonly ContextualFactor[] {
    return Object.freeze([...this._factors]);
  }

  /** Add a contextual factor */
  addFactor(factor: ContextualFactor): void {
    this._factors.push(factor);
  }

  /** Remove a factor by key */
  removeFactor(key: string): void {
    this._factors = this._factors.filter((f) => f.key !== key);
  }

  /** Get factors by scope */
  getFactorsByScope(scope: ContextScope): ContextualFactor[] {
    return this._factors.filter((f) => f.scope === scope);
  }

  /** Serialize to key-value pairs for AI context assembly */
  toContextMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const factor of this._factors) {
      map[factor.key] = factor.value;
    }
    return map;
  }

  /** Create a new ContextReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    scope?: ContextScope;
    factors?: ContextualFactor[];
  }): ContextReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.reference(),
      label: props.label,
      description: props.description,
    });
    return new ContextReference(node, props.scope, props.factors);
  }
}
