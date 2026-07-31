// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: MemoryReference
// ARC-003 — A memory or recollection stored in the knowledge graph
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type MemoryType = 'factual' | 'experiential' | 'procedural' | 'conceptual' | 'emotional';
export type MemorySignificance = 'critical' | 'important' | 'normal' | 'trivial';

export interface MemoryContext {
  /** When the event being remembered occurred */
  eventDate?: Date;
  /** Where the event occurred */
  location?: string;
  /** People involved */
  people?: string[];
  /** Emotional tags */
  emotions?: string[];
}

/**
 * MemoryReference entity — a memory or recollection stored
 * in the knowledge graph for long-term retention and recall.
 */
export class MemoryReference {
  private readonly _node: KnowledgeNode;
  private readonly _memoryType: MemoryType;
  private _significance: MemorySignificance;
  private _memoryContext: MemoryContext;

  constructor(
    node: KnowledgeNode,
    memoryType?: MemoryType,
    significance?: MemorySignificance,
    memoryContext?: MemoryContext,
  ) {
    this._node = node;
    this._memoryType = memoryType ?? 'factual';
    this._significance = significance ?? 'normal';
    this._memoryContext = memoryContext ?? {};
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
  get memoryType(): MemoryType {
    return this._memoryType;
  }
  get significance(): MemorySignificance {
    return this._significance;
  }
  get memoryContext(): MemoryContext {
    return { ...this._memoryContext };
  }

  /** Update memory context */
  updateContext(context: Partial<MemoryContext>): void {
    this._memoryContext = { ...this._memoryContext, ...context };
  }

  /** Promote memory significance */
  promoteSignificance(significance: MemorySignificance): void {
    this._significance = significance;
  }

  /** Check if memory is significant enough to retain */
  isSignificant(): boolean {
    return this._significance === 'critical' || this._significance === 'important';
  }

  /** Create a new MemoryReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    memoryType?: MemoryType;
    significance?: MemorySignificance;
    context?: MemoryContext;
  }): MemoryReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.memory(),
      label: props.label,
      description: props.description,
    });
    return new MemoryReference(node, props.memoryType, props.significance, props.context);
  }
}
