// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: PortfolioReference
// ARC-003 — A portfolio collection or showcase item
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type PortfolioVisibility = 'public' | 'private' | 'connections' | 'embed';
export type PortfolioItemType =
  'project' | 'certification' | 'writing' | 'speaking' | 'open_source' | 'design' | 'case_study';

/**
 * PortfolioReference entity — a portfolio collection or showcase item
 * that demonstrates the User's capabilities to the world.
 */
export class PortfolioReference {
  private readonly _node: KnowledgeNode;
  private _visibility: PortfolioVisibility;
  private readonly _itemType: PortfolioItemType;
  private _featured: boolean;
  private _url?: string;

  constructor(
    node: KnowledgeNode,
    itemType: PortfolioItemType,
    visibility?: PortfolioVisibility,
    featured?: boolean,
    url?: string,
  ) {
    this._node = node;
    this._itemType = itemType;
    this._visibility = visibility ?? 'private';
    this._featured = featured ?? false;
    this._url = url;
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
  get visibility(): PortfolioVisibility {
    return this._visibility;
  }
  get itemType(): PortfolioItemType {
    return this._itemType;
  }
  get isFeatured(): boolean {
    return this._featured;
  }
  get url(): string | undefined {
    return this._url;
  }

  /** Set visibility */
  setVisibility(visibility: PortfolioVisibility): void {
    this._visibility = visibility;
  }

  /** Toggle featured status */
  toggleFeatured(): void {
    this._featured = !this._featured;
  }

  /** Set portfolio URL */
  setUrl(url: string): void {
    this._url = url;
  }

  /** Check if portfolio item is publicly visible */
  isPublic(): boolean {
    return this._visibility === 'public';
  }

  /** Create a new PortfolioReference */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    itemType: PortfolioItemType;
    visibility?: PortfolioVisibility;
    featured?: boolean;
    url?: string;
  }): PortfolioReference {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.portfolio(),
      label: props.label,
      description: props.description,
    });
    return new PortfolioReference(
      node,
      props.itemType,
      props.visibility,
      props.featured,
      props.url,
    );
  }
}
