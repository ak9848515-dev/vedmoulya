// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Relationship Service
// EI-010 — Enterprise Memory Intelligence Platform
// Detects and validates the Memory Graph edges. `detectRelationships`
// links a memory to its predecessor (same related entity, earlier
// created — `follows`), to memories with overlapping titles
// (`similar_to`), and to contradictory types (`contradicts`). Also
// enforces graph integrity (no self-loops, no duplicate edges).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   the only indexed accesses are typed key lookups over the closed union of
   MemoryItem entity keys (relatedGoal, relatedTask, …) — no runtime
   attacker-controlled keys. */

import type {
  MemoryItem,
  MemoryRelationship,
  MemoryRelationshipType,
} from '../../types/memory-types.js';
import { MEMORY_RELATIONSHIP_TYPES } from '../../types/memory-types.js';
import { validateRelationship } from '../rules/MemoryRules.js';
import { generateMemoryRelationshipId } from '../value-objects/MemoryId.js';

export interface DetectRelationshipOptions {
  /** Maximum edges to emit (default 8). */
  maxEdges?: number;
  /** Minimum title-overlap for `similar_to` edges (default 0.5). */
  minOverlap?: number;
}

export class MemoryRelationshipService {
  /** Integrity check: valid shape, no self-loop, no duplicate edge. */
  checkIntegrity(
    relationship: MemoryRelationship,
    existing: MemoryRelationship[],
  ): { allowed: boolean; message?: string } {
    const shape = validateRelationship(relationship);
    if (!shape.passed) return { allowed: false, message: shape.message };
    const duplicate = existing.some(
      (r) =>
        r.sourceId === relationship.sourceId &&
        r.targetId === relationship.targetId &&
        r.type === relationship.type,
    );
    if (duplicate) return { allowed: false, message: 'Duplicate relationship already exists' };
    return { allowed: true };
  }

  private tokenOverlap(a: string, b: string): number {
    const ta = new Set(
      a
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 1),
    );
    const tb = new Set(
      b
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 1),
    );
    if (ta.size === 0 || tb.size === 0) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter += 1;
    return inter / (ta.size + tb.size - inter);
  }

  private sharesEntity(a: MemoryItem, b: MemoryItem): boolean {
    const keys: Array<keyof MemoryItem> = [
      'relatedGoal',
      'relatedTask',
      'relatedCapability',
      'relatedProvider',
      'relatedProject',
      'relatedUser',
      'relatedContext',
      'relatedDecision',
      'relatedExecution',
    ];
    for (const key of keys) {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string' && va === vb && va.length > 0) return true;
    }
    return false;
  }

  /**
   * Auto-detect edges from `item` against the rest of the registry.
   * Deterministic, bounded, no LLM. Emits:
   *   follows      → earlier memory of the same related entity chain
   *   similar_to   → overlapping titles
   *   contradicts  → failure vs success memory of the same entity
   */
  detectRelationships(
    item: MemoryItem,
    registry: MemoryItem[],
    actor: string,
    options: DetectRelationshipOptions = {},
  ): MemoryRelationship[] {
    const maxEdges = options.maxEdges ?? 8;
    const minOverlap = options.minOverlap ?? 0.5;
    const edges: MemoryRelationship[] = [];
    const now = new Date().toISOString();

    const push = (
      type: MemoryRelationshipType,
      target: MemoryItem,
      weight: number,
      note?: string,
    ): void => {
      if (edges.length >= maxEdges) return;
      const edge: MemoryRelationship = {
        relationshipId: generateMemoryRelationshipId(),
        type,
        sourceId: item.memoryId,
        sourceTitle: item.title,
        targetId: target.memoryId,
        targetTitle: target.title,
        weight: Math.max(0, Math.min(1, weight)),
        actor,
        note,
        createdAt: now,
      };
      if (this.checkIntegrity(edge, edges).allowed) edges.push(edge);
    };

    for (const other of registry) {
      if (other.memoryId === item.memoryId) continue;
      if (this.sharesEntity(item, other)) {
        const overlap = this.tokenOverlap(item.title, other.title);
        if (overlap >= minOverlap) {
          const weight = 0.6 + overlap * 0.3;
          push('similar_to', other, weight, 'shared related entity + title overlap');
        }
        if (new Date(other.createdAt).getTime() < new Date(item.createdAt).getTime()) {
          push('follows', other, 0.7, 'earlier memory of the same related entity');
        }
      }
      const contradicting =
        (item.type === 'failure' && other.type === 'success') ||
        (item.type === 'success' && other.type === 'failure');
      if (contradicting && this.sharesEntity(item, other)) {
        push('contradicts', other, 0.8, 'opposing outcome for the same related entity');
      }
    }
    return edges;
  }
}

/** Re-export for consumers that need the edge types. */
export { MEMORY_RELATIONSHIP_TYPES };
