// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Relationship Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Builds and maintains the Knowledge Graph edges. Deterministic
// relationship DETECTION (no LLM): edges are derived from explicit
// references in descriptions, shared tags/categories, and structural
// heuristics (parent/child, depends_on, related_to, implements,
// consumes, produces, supersedes, uses, owned_by). The service also
// enforces graph integrity — no self-loops, no duplicate edges — and
// derives the dependency list of an item from its outgoing edges.
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeDependency,
  KnowledgeItem,
  KnowledgeRelationship,
  KnowledgeRelationshipType,
} from '../../types/knowledge-types.js';
import { KNOWLEDGE_RELATIONSHIP_TYPES } from '../../types/knowledge-types.js';
import { generateDependencyId, generateRelationshipId } from '../value-objects/KnowledgeId.js';

export interface DetectRelationshipOptions {
  /** Auto-link items that share at least this many tags (default 2). */
  sharedTagThreshold?: number;
  /** Auto-link items of the same category (default false). */
  linkSameCategory?: boolean;
}

const DEFAULT_OPTIONS: Required<DetectRelationshipOptions> = {
  sharedTagThreshold: 2,
  linkSameCategory: false,
};

export class KnowledgeRelationshipService {
  private readonly options: Required<DetectRelationshipOptions>;

  constructor(options: DetectRelationshipOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Detect new relationships for one item against the rest of the registry.
   * Returns only NEW edges (no duplicates, no self-loops).
   */
  detectRelationships(
    item: KnowledgeItem,
    others: readonly KnowledgeItem[],
    actor: string,
  ): KnowledgeRelationship[] {
    const existing = new Set(item.relationships.map((r) => `${r.type}:${r.targetId}`));
    const found: KnowledgeRelationship[] = [];

    const add = (
      type: KnowledgeRelationshipType,
      target: KnowledgeItem,
      weight: number,
      note?: string,
    ): void => {
      const key = `${type}:${target.knowledgeId}`;
      if (target.knowledgeId === item.knowledgeId || existing.has(key)) return;
      existing.add(key);
      found.push({
        relationshipId: generateRelationshipId(),
        type,
        sourceId: item.knowledgeId,
        sourceTitle: item.title,
        targetId: target.knowledgeId,
        targetTitle: target.title,
        weight: round(weight),
        actor,
        note,
        createdAt: new Date().toISOString(),
      });
    };

    for (const other of others) {
      // Explicit "supersedes <title>" / "replaces <title>" in the description.
      if (
        this.referencesTitle(item.description, other.title, [
          'supersedes',
          'replaces',
          'replaced by',
          'superseded by',
        ])
      ) {
        add('supersedes', other, 0.9, 'Explicit supersession reference');
      }
      // Explicit "depends on <title>" / "requires <title>" reference.
      if (
        this.referencesTitle(item.description, other.title, [
          'depends on',
          'requires',
          'dependent on',
        ])
      ) {
        add('depends_on', other, 0.85, 'Explicit dependency reference');
      }
      // Explicit "implements <title>" / "implements the <title>" reference.
      if (
        this.referencesTitle(item.description, other.title, ['implements', 'implementation of'])
      ) {
        add('implements', other, 0.9, 'Explicit implementation reference');
      }
      // Shared tags → related_to.
      const sharedTags = item.tags.filter((tag) => other.tags.includes(tag));
      if (sharedTags.length >= this.options.sharedTagThreshold) {
        add(
          'related_to',
          other,
          0.4 + 0.15 * Math.min(sharedTags.length, 4),
          `Shared tags: ${sharedTags.join(', ')}`,
        );
      }
      // Same category + shared vocabulary → related_to.
      if (this.options.linkSameCategory && item.category === other.category) {
        add('related_to', other, 0.35, 'Same knowledge category');
      }
    }

    return found;
  }

  /** Integrity check: reject self-loops and exact duplicate edges. */
  checkIntegrity(
    relationship: KnowledgeRelationship,
    existing: readonly KnowledgeRelationship[],
  ): { allowed: boolean; message?: string } {
    if (relationship.sourceId === relationship.targetId) {
      return { allowed: false, message: 'a relationship cannot connect an item to itself' };
    }
    if (
      existing.some(
        (r) =>
          r.sourceId === relationship.sourceId &&
          r.targetId === relationship.targetId &&
          r.type === relationship.type,
      )
    ) {
      return { allowed: false, message: 'duplicate relationship edge' };
    }
    return { allowed: true };
  }

  /** Derive the dependency list of an item from its outgoing dependency edges. */
  deriveDependencies(item: KnowledgeItem): KnowledgeDependency[] {
    const dependencyEdges = item.relationships.filter(
      (r) => r.type === 'depends_on' || r.type === 'consumes' || r.type === 'uses',
    );
    return dependencyEdges.map((edge) => ({
      dependencyId: generateDependencyId(),
      targetId: edge.targetId,
      targetTitle: edge.targetTitle,
      type: edge.type as 'depends_on' | 'consumes' | 'uses',
      criticality:
        edge.type === 'depends_on'
          ? edge.weight >= 0.8
            ? 'high'
            : 'medium'
          : edge.weight >= 0.7
            ? 'medium'
            : 'low',
      note: edge.note,
    }));
  }

  /** All edge types an item participates in (both directions). */
  relationshipTypes(item: KnowledgeItem): KnowledgeRelationshipType[] {
    const types = new Set<KnowledgeRelationshipType>(item.relationships.map((r) => r.type));
    return KNOWLEDGE_RELATIONSHIP_TYPES.filter((type) => types.has(type));
  }

  private referencesTitle(description: string, title: string, verbs: string[]): boolean {
    const lower = description.toLowerCase();
    const target = title.toLowerCase();
    if (target.length < 3) return false;
    return verbs.some((verb) => {
      const direct = lower.includes(`${verb} ${target}`);
      const withArticle = lower.includes(`${verb} the ${target}`);
      const quoted = lower.includes(`${verb} "${target}"`);
      const stripped = lower.includes(`${verb} ${target.replace(/^the\s+/, '')}`);
      return direct || withArticle || quoted || stripped;
    });
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
