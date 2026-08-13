// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Assembly
// APP-001 — Post-V1 Application Platform Layer
// Given Goal + Task + User + Permissions + Query, produce the Minimum
// Useful Context — NOT everything relevant. The assembler optimizes
// for relevance + completeness + permission safety + freshness +
// token efficiency, reusing EI-003-style compression concepts via a
// deterministic token budget (no LLM required to assemble).
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextFabricPackage,
  ContextPackageItem,
  ContextRankingResult,
  ContextRelationship,
  ContextRetrievalQuery,
  PermissionEvaluation,
} from '../../types/fabric-types.js';
import { estimateTokens } from '../rules/FabricRules.js';

export interface AssemblyOptions {
  /** Token budget cap for the packaged context. */
  tokenBudget?: number;
  /** Capabilities to advertise as relevant. */
  relevantCapabilities?: string[];
  /** Context version string (defaults to a dated build id). */
  contextVersion?: string;
}

export interface AssembledItem {
  entity: ContextEntity;
  ranking: ContextRankingResult;
  permission: PermissionEvaluation;
  contentPreview: string;
  estimatedTokens: number;
}

/** Preview an entity's content deterministically (first N chars). */
export function previewEntity(entity: ContextEntity, maxChars = 220): string {
  const body = entity.description ?? '';
  return body.length <= maxChars ? body : `${body.slice(0, maxChars)}…`;
}

export class ContextAssemblyService {
  /**
   * Build a minimum-useful context package from eligible, ranked
   * candidates. Permission-safety is the hard gate: only entities with
   * `allowed === true` may enter the package. The package is then
   * filled greedily by rank within the token budget.
   */
  assemble(
    query: ContextRetrievalQuery,
    candidates: Array<{
      entity: ContextEntity;
      ranking: ContextRankingResult;
      permission: PermissionEvaluation;
    }>,
    relationships: ContextRelationship[],
    options: AssemblyOptions = {},
  ): ContextFabricPackage {
    const tokenBudget = options.tokenBudget ?? 12_000;
    const version = options.contextVersion ?? `fabric-${new Date().toISOString().slice(0, 10)}`;

    const items: ContextPackageItem[] = [];
    const summaryReasons: string[] = [];
    let tokens = 0;

    const sorted = [...candidates].sort((a, b) => b.ranking.score - a.ranking.score);
    for (const candidate of sorted) {
      if (!candidate.permission.allowed) {
        // Hard gate: never package unauthorized context.
        continue;
      }
      const preview = previewEntity(candidate.entity);
      const itemTokens = estimateTokens(preview);
      if (tokens + itemTokens > tokenBudget) {
        summaryReasons.push(`stopped at ${tokens} tokens to respect the budget`);
        continue;
      }
      items.push({
        entityId: candidate.entity.entityId,
        entityLabel: candidate.entity.label,
        type: candidate.entity.type,
        contentPreview: preview,
        estimatedTokens: itemTokens,
        provenance: candidate.entity.provenance,
        permission: candidate.permission,
        explanation: {
          entityId: candidate.entity.entityId,
          entityLabel: candidate.entity.label,
          selected: true,
          score: candidate.ranking.score,
          reasons: candidate.ranking.reasons,
        },
      });
      tokens += itemTokens;
      summaryReasons.push(...candidate.ranking.reasons.slice(0, 1));
    }

    return {
      packageId: `package_${query.userId}_${Date.now()}`,
      userId: query.userId,
      organizationId: query.organizationId,
      goalId: query.goalId,
      taskId: query.taskId,
      query: query.query,
      items,
      relationships,
      relevantCapabilities: options.relevantCapabilities ?? [],
      estimatedTokens: tokens,
      contextVersion: version,
      assembledAt: new Date().toISOString(),
      summary: items.map((item) => item.explanation),
    };
  }

  /** Compact description of the assembled package (for dashboards). */
  describe(package_: ContextFabricPackage): string {
    const firstReason = package_.summary[0]?.reasons[0] ?? '';
    return `${package_.items.length} items · ${package_.estimatedTokens} tokens · v${package_.contextVersion} · ${package_.summary.length ? firstReason.trim() : 'empty'}`;
  }
}

// Re-export types the application layer needs (keeps the seam small).
export type {
  ContextPackageItem as FabricPackageItem,
  ContextPermission as FabricPermission,
} from '../../types/fabric-types.js';
export type { ContextProvenance as FabricProvenance } from '../../types/fabric-types.js';
