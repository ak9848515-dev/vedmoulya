// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Domain Service: Composition
// Resolves nested capability composition trees
// (e.g. Research + Writing + Review = Content Generation)
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type { Capability } from '../entities/Capability.js';
import type { CapabilityId } from '../value-objects/CapabilityId.js';

export interface CompositionTreeNode {
  id: CapabilityId;
  name: string;
  slot?: string;
  /** Nested children (a capability may contain capabilities). */
  children: CompositionTreeNode[];
  /** True when the node itself is a composition. */
  isComposition: boolean;
  /** Flattened leaf count underneath this node. */
  leafCount: number;
}

export interface CompositionValidation {
  valid: boolean;
  /** Child ids that do not exist in the registry. */
  missing: CapabilityId[];
  /** Self-references (a capability containing itself). */
  selfReferences: CapabilityId[];
  /** Composition cycles (parent → ... → parent). */
  cycles: CapabilityId[][];
}

export class CapabilityCompositionService {
  /**
   * Validate a capability's composition children against the full registry:
   * children must exist, no self-reference, no composition cycles.
   */
  validate(capability: Capability, allCapabilities: readonly Capability[]): CompositionValidation {
    const byId = new Map<CapabilityId, Capability>();
    for (const cap of allCapabilities) {
      byId.set(cap.id, cap);
    }

    const missing: CapabilityId[] = [];
    const selfReferences: CapabilityId[] = [];
    for (const child of capability.composition) {
      if (child.id === capability.id) selfReferences.push(child.id);
      if (!byId.has(child.id)) missing.push(child.id);
    }

    // Detect composition cycles: parent → child → ... → parent.
    const cycles: CapabilityId[][] = [];
    const visited = new Set<CapabilityId>();
    const stack = new Set<CapabilityId>();
    const path: CapabilityId[] = [];

    const dfs = (id: CapabilityId): void => {
      if (stack.has(id)) {
        const start = path.indexOf(id);
        if (start !== -1) cycles.push([...path.slice(start), id]);
        return;
      }
      if (visited.has(id)) return;
      visited.add(id);
      stack.add(id);
      path.push(id);
      const cap = byId.get(id);
      if (cap) {
        for (const child of cap.composition) {
          if (byId.has(child.id)) dfs(child.id);
        }
      }
      stack.delete(id);
      path.pop();
    };
    dfs(capability.id);

    return {
      valid: missing.length === 0 && selfReferences.length === 0 && cycles.length === 0,
      missing,
      selfReferences,
      cycles,
    };
  }

  /**
   * Build the full composition tree rooted at `id`.
   * Children missing from the registry are emitted as leaf nodes with
   * `isComposition: false` (resilient to partial data).
   */
  buildTree(
    capabilities: readonly Capability[],
    id: CapabilityId,
    slot?: string,
    depth = 0,
  ): CompositionTreeNode {
    const byId = new Map<CapabilityId, Capability>();
    for (const cap of capabilities) {
      byId.set(cap.id, cap);
    }

    const cap = byId.get(id);
    if (!cap || depth > 20) {
      return {
        id,
        name: cap?.name ?? id,
        slot,
        children: [],
        isComposition: false,
        leafCount: 1,
      };
    }

    const children = cap.composition.map((child) =>
      this.buildTree(capabilities, child.id, child.slot, depth + 1),
    );
    const leafCount = children.length === 0 ? 1 : children.reduce((s, c) => s + c.leafCount, 0);
    return {
      id: cap.id,
      name: cap.name,
      slot,
      children,
      isComposition: children.length > 0,
      leafCount,
    };
  }

  /** Flatten a composition tree into ordered leaf capability ids. */
  flattenTree(tree: CompositionTreeNode): CapabilityId[] {
    if (tree.children.length === 0) return [tree.id];
    const result: CapabilityId[] = [];
    for (const child of tree.children) {
      result.push(...this.flattenTree(child));
    }
    return result;
  }
}
