// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: KnowledgeGraph Aggregate
// ARC-003 — Aggregate root for the Knowledge Graph bounded context
// Manages a collection of nodes and edges as a unified graph
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId as GraphIdType } from '../value-objects/GraphId.js';
import { KnowledgeNode } from '../entities/KnowledgeNode.js';
import { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import { RelationshipType } from '../value-objects/RelationshipType.js';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';
import type { KnowledgeEvent } from '../events/KnowledgeEvent.js';
import { createGraphEvent } from '../events/KnowledgeEvent.js';

export interface GraphNodeEntry {
  node: KnowledgeNode;
  addedAt: Date;
}

export interface GraphEdgeEntry {
  edge: KnowledgeEdge;
  addedAt: Date;
}

/**
 * KnowledgeGraph — aggregate root for the Knowledge Graph bounded context.
 * Manages the complete graph: nodes, edges, and their relationships.
 * Ensures graph consistency: no duplicate nodes, no duplicate edges,
 * no circular references at the aggregate boundary.
 */
export class KnowledgeGraph {
  private readonly _graphId: GraphIdType;
  private readonly _label: string;
  private readonly _description: string;
  private readonly _nodes: Map<string, GraphNodeEntry>;
  private readonly _edges: Map<string, GraphEdgeEntry>;
  private _status: KnowledgeStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _events: KnowledgeEvent[] = [];
  private _metadata: Record<string, unknown>;

  constructor(props: {
    graphId: GraphIdType;
    label: string;
    description?: string;
    status?: KnowledgeStatus;
    metadata?: Record<string, unknown>;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this._graphId = props.graphId;
    this._label = props.label;
    this._description = props.description ?? '';
    this._nodes = new Map();
    this._edges = new Map();
    this._status = props.status ?? KnowledgeStatus.active();
    this._metadata = props.metadata ?? {};
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get graphId(): GraphIdType {
    return this._graphId;
  }
  get label(): string {
    return this._label;
  }
  get description(): string {
    return this._description;
  }
  get status(): KnowledgeStatus {
    return this._status;
  }
  get metadata(): Record<string, unknown> {
    return { ...this._metadata };
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  get nodeCount(): number {
    return this._nodes.size;
  }
  get edgeCount(): number {
    return this._edges.size;
  }

  /** Get all nodes in the graph */
  getNodes(): KnowledgeNode[] {
    return Array.from(this._nodes.values()).map((e) => e.node);
  }

  /** Get all edges in the graph */
  getEdges(): KnowledgeEdge[] {
    return Array.from(this._edges.values()).map((e) => e.edge);
  }

  /** Get a node by ID */
  getNode(nodeId: KnowledgeNodeId): KnowledgeNode | undefined {
    return this._nodes.get(nodeId)?.node;
  }

  /** Get an edge by ID */
  getEdge(edgeId: KnowledgeEdgeId): KnowledgeEdge | undefined {
    return this._edges.get(edgeId)?.edge;
  }

  /** Drain and return all pending domain events */
  pullEvents(): KnowledgeEvent[] {
    const events = [...this._events];
    this._events.length = 0;

    // Also collect events from nodes and edges
    for (const [, entry] of this._nodes) {
      events.push(...entry.node.pullEvents());
    }
    for (const [, entry] of this._edges) {
      events.push(...entry.edge.pullEvents());
    }

    return events;
  }

  // ── Node Operations ─────────────────────────────────────────────────────

  /** Add a node to the graph */
  addNode(node: KnowledgeNode): void {
    if (this._nodes.has(node.id)) {
      throw new Error(`Node already exists in graph: ${node.id}`);
    }
    this._nodes.set(node.id, { node, addedAt: new Date() });
    this._updatedAt = new Date();
    this._events.push(
      createGraphEvent('knowledge.node.created', this._graphId, {
        nodeId: node.id,
        category: node.category.value,
        label: node.label,
      }),
    );
  }

  /** Remove a node and all its edges from the graph */
  removeNode(nodeId: KnowledgeNodeId): void {
    if (!this._nodes.has(nodeId)) {
      throw new Error(`Node not found in graph: ${nodeId}`);
    }
    this._nodes.delete(nodeId);

    // Remove all edges connected to this node
    for (const [edgeId, entry] of this._edges) {
      if (entry.edge.sourceId === nodeId || entry.edge.targetId === nodeId) {
        this._edges.delete(edgeId);
      }
    }
    this._updatedAt = new Date();
    this._events.push(createGraphEvent('knowledge.node.deleted', this._graphId, { nodeId }));
  }

  /** Check if a node exists in the graph */
  hasNode(nodeId: KnowledgeNodeId): boolean {
    return this._nodes.has(nodeId);
  }

  // ── Edge Operations ─────────────────────────────────────────────────────

  /** Add an edge between two nodes */
  addEdge(edge: KnowledgeEdge): void {
    if (this._edges.has(edge.id)) {
      throw new Error(`Edge already exists in graph: ${edge.id}`);
    }
    if (!this._nodes.has(edge.sourceId)) {
      throw new Error(`Source node not found: ${edge.sourceId}`);
    }
    if (!this._nodes.has(edge.targetId)) {
      throw new Error(`Target node not found: ${edge.targetId}`);
    }

    this._edges.set(edge.id, { edge, addedAt: new Date() });
    this._updatedAt = new Date();
    this._events.push(
      createGraphEvent('knowledge.edge.created', this._graphId, {
        edgeId: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        type: edge.type.type,
      }),
    );
  }

  /** Remove an edge from the graph */
  removeEdge(edgeId: KnowledgeEdgeId): void {
    if (!this._edges.has(edgeId)) {
      throw new Error(`Edge not found in graph: ${edgeId}`);
    }
    this._edges.delete(edgeId);
    this._updatedAt = new Date();
    this._events.push(createGraphEvent('knowledge.edge.deleted', this._graphId, { edgeId }));
  }

  /** Check if an edge exists */
  hasEdge(edgeId: KnowledgeEdgeId): boolean {
    return this._edges.has(edgeId);
  }

  /** Check if an edge exists between two nodes with a specific type */
  hasRelationship(
    sourceId: KnowledgeNodeId,
    targetId: KnowledgeNodeId,
    type?: RelationshipType,
  ): boolean {
    for (const [, entry] of this._edges) {
      if (entry.edge.sourceId === sourceId && entry.edge.targetId === targetId) {
        if (!type || entry.edge.type.equals(type)) {
          return true;
        }
      }
    }
    return false;
  }

  /** Get all edges connected to a node */
  getEdgesForNode(nodeId: KnowledgeNodeId): KnowledgeEdge[] {
    const result: KnowledgeEdge[] = [];
    for (const [, entry] of this._edges) {
      if (entry.edge.sourceId === nodeId || entry.edge.targetId === nodeId) {
        result.push(entry.edge);
      }
    }
    return result;
  }

  /** Get outgoing edges from a node */
  getOutgoingEdges(nodeId: KnowledgeNodeId): KnowledgeEdge[] {
    const result: KnowledgeEdge[] = [];
    for (const [, entry] of this._edges) {
      if (entry.edge.sourceId === nodeId) {
        result.push(entry.edge);
      }
    }
    return result;
  }

  /** Get incoming edges to a node */
  getIncomingEdges(nodeId: KnowledgeNodeId): KnowledgeEdge[] {
    const result: KnowledgeEdge[] = [];
    for (const [, entry] of this._edges) {
      if (entry.edge.targetId === nodeId) {
        result.push(entry.edge);
      }
    }
    return result;
  }

  /** Get neighbor nodes of a given node */
  getNeighbors(nodeId: KnowledgeNodeId): KnowledgeNode[] {
    const neighborIds = new Set<KnowledgeNodeId>();
    for (const [, entry] of this._edges) {
      if (entry.edge.sourceId === nodeId) {
        neighborIds.add(entry.edge.targetId);
      }
      if (entry.edge.targetId === nodeId) {
        neighborIds.add(entry.edge.sourceId);
      }
    }
    return Array.from(neighborIds)
      .map((id) => this._nodes.get(id)?.node)
      .filter((n): n is KnowledgeNode => n !== undefined);
  }

  // ── Graph Operations ────────────────────────────────────────────────────

  /** Update graph metadata */
  updateMetadata(metadata: Record<string, unknown>): void {
    this._metadata = { ...this._metadata, ...metadata };
    this._updatedAt = new Date();
  }

  /** Archive the entire graph */
  archive(): void {
    this._status = KnowledgeStatus.archived('Graph archived');
    this._updatedAt = new Date();
    this._events.push(createGraphEvent('knowledge.graph.archived', this._graphId, {}));
  }

  /** Create a snapshot of the current graph state */
  snapshot(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[]; timestamp: Date } {
    this._events.push(
      createGraphEvent('knowledge.graph.snapshot', this._graphId, {
        nodeCount: this._nodes.size,
        edgeCount: this._edges.size,
      }),
    );
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      timestamp: new Date(),
    };
  }

  /** Clear all nodes and edges */
  clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this._updatedAt = new Date();
    this._events.push(
      createGraphEvent('knowledge.graph.updated', this._graphId, { action: 'clear' }),
    );
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new empty KnowledgeGraph */
  static create(props: { label: string; description?: string }): KnowledgeGraph {
    const graphId =
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}` as GraphIdType;
    const graph = new KnowledgeGraph({
      graphId,
      label: props.label,
      description: props.description,
    });

    graph._events.push(
      createGraphEvent('knowledge.graph.created', graphId, {
        label: props.label,
      }),
    );

    return graph;
  }
}
