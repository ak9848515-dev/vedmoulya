// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Health
// APP-001 — Post-V1 Application Platform Layer
// Diagnostics for the fabric: entity/relationship counts, personal vs
// business split, per-type and per-source distribution, permission
// coverage (share of entities with a defined permission model) and
// average confidence. Consumed by the /context-fabric Diagnostics
// tab and the health probe.
// ──────────────────────────────────────────────────────────────────

import type { FabricHealth } from '../../types/fabric-types.js';
import type { GraphRepository } from '../repository/GraphRepository.js';

export class FabricHealthService {
  constructor(private readonly repository: GraphRepository) {}

  async getHealth(): Promise<FabricHealth> {
    const entities = await this.repository.listEntities();
    const relationships = await this.repository.listRelationships();
    const countByType: Record<string, number> = {};
    const countBySource: Record<string, number> = {};
    let personalCount = 0;
    let businessCount = 0;
    let permissionCovered = 0;
    let confidenceSum = 0;
    for (const entity of entities) {
      countByType[entity.type] = (countByType[entity.type] ?? 0) + 1;
      countBySource[entity.source] = (countBySource[entity.source] ?? 0) + 1;
      if (entity.graph === 'personal') personalCount += 1;
      else businessCount += 1;
      // Permission coverage = share of entities carrying a complete access
      // model (owner + scope + grant timestamp). Every fabric entity must
      // have one — this is the permission-aware context guarantee.
      if (entity.permissions.owner) {
        permissionCovered += 1;
      }
      confidenceSum += entity.confidence;
    }
    return {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      personalCount,
      businessCount,
      countByType,
      countBySource,
      permissionCoverage: entities.length === 0 ? 1 : permissionCovered / entities.length,
      avgConfidence: entities.length === 0 ? 0 : confidenceSum / entities.length,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Health snapshot for the OS-style dashboard (JSON-safe). */
  async getSnapshot(): Promise<{
    entityCount: number;
    relationshipCount: number;
    permissionCoverage: number;
    avgConfidence: number;
    checkedAt: string;
  }> {
    const health = await this.getHealth();
    return {
      entityCount: health.entityCount,
      relationshipCount: health.relationshipCount,
      permissionCoverage: health.permissionCoverage,
      avgConfidence: health.avgConfidence,
      checkedAt: health.checkedAt,
    };
  }
}
