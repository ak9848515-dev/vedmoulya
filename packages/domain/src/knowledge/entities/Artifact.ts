// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Domain: Artifact
// ARC-003 — A tangible output or deliverable created by the User
// ──────────────────────────────────────────────────────────────────

import { KnowledgeNode } from './KnowledgeNode.js';
import { KnowledgeCategory } from '../value-objects/KnowledgeCategory.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { GraphId } from '../value-objects/GraphId.js';

export type ArtifactType =
  | 'document'
  | 'code_repository'
  | 'design'
  | 'writing'
  | 'presentation'
  | 'video'
  | 'audio'
  | 'image'
  | 'diagram'
  | 'spreadsheet'
  | 'report'
  | 'prototype'
  | 'website'
  | 'api'
  | 'other';

export interface ArtifactLink {
  type: ArtifactType;
  url: string;
  title: string;
  description?: string;
  /** File size in bytes if applicable */
  sizeBytes?: number;
  /** MIME type if applicable */
  mimeType?: string;
}

/**
 * Artifact entity — a tangible output or deliverable created by the User.
 * Artifacts demonstrate skills and support evidence claims.
 */
export class Artifact {
  private readonly _node: KnowledgeNode;
  private _artifactLinks: ArtifactLink[];
  private _primaryType: ArtifactType;

  constructor(node: KnowledgeNode, primaryType: ArtifactType, artifactLinks?: ArtifactLink[]) {
    this._node = node;
    this._primaryType = primaryType;
    this._artifactLinks = artifactLinks ?? [];
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
  get primaryType(): ArtifactType {
    return this._primaryType;
  }
  get links(): readonly ArtifactLink[] {
    return Object.freeze([...this._artifactLinks]);
  }

  /** Add a link to this artifact */
  addLink(link: ArtifactLink): void {
    this._artifactLinks.push(link);
  }

  /** Remove a link by index */
  removeLink(index: number): void {
    if (index >= 0 && index < this._artifactLinks.length) {
      this._artifactLinks = this._artifactLinks.filter((_, i) => i !== index);
    }
  }

  /** Change primary type */
  changePrimaryType(type: ArtifactType): void {
    this._primaryType = type;
  }

  /** Get all URLs associated with this artifact */
  getAllUrls(): string[] {
    return this._artifactLinks.map((l) => l.url);
  }

  /** Create a new Artifact entity */
  static create(props: {
    nodeId: KnowledgeNodeId;
    graphId: GraphId;
    label: string;
    description?: string;
    primaryType: ArtifactType;
    links?: ArtifactLink[];
  }): Artifact {
    const node = KnowledgeNode.create({
      id: props.nodeId,
      graphId: props.graphId,
      category: KnowledgeCategory.artifact(),
      label: props.label,
      description: props.description,
    });
    return new Artifact(node, props.primaryType, props.links);
  }
}
