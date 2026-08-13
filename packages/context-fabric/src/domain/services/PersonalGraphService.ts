// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Personal Graph
// APP-001 — Post-V1 Application Platform Layer
// The first-class personal relationship model: User ── goals,
// projects, tasks, skills, knowledge, memories, documents,
// applications, preferences, work history, learning history and AI
// interaction history. Built on the shared GraphRepository seam — a
// future graph backend can replace storage without touching this
// domain service.
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextRelationship,
  GraphStats,
  PersonalGraph,
} from '../../types/fabric-types.js';
import type { GraphRepository } from '../repository/GraphRepository.js';

export class PersonalGraphService {
  constructor(private readonly repository: GraphRepository) {}

  /** Load the complete personal graph for one user. */
  async getPersonalGraph(userId: string): Promise<PersonalGraph> {
    const entities = await this.repository.listEntities({ graph: 'personal', ownerId: userId });
    const relationships = await this.repository.listRelationships();
    const stats = this.computeStats(entities, relationships);
    return { userId, entities, relationships, stats };
  }

  /** Entities + relationships relevant to one anchor (goal/project/task). */
  async getRelated(
    userId: string,
    anchorId: string,
  ): Promise<{ entities: ContextEntity[]; relationships: ContextRelationship[] }> {
    const graph = await this.getPersonalGraph(userId);
    const anchorIds = new Set<string>([anchorId]);
    const visited = new Set<string>([anchorId]);
    const frontier = [anchorId];
    // Two-hop traversal (deterministic, bounded — no uncontrolled
    // graph traversal; APP-001 performance rule).
    let hops = 0;
    while (frontier.length > 0 && hops < 2) {
      const current = frontier.shift() as string;
      for (const rel of graph.relationships) {
        const next =
          rel.fromId === current ? rel.toId : rel.toId === current ? rel.fromId : undefined;
        if (next && !visited.has(next)) {
          visited.add(next);
          frontier.push(next);
          anchorIds.add(next);
        }
      }
      hops += 1;
    }
    const entities = graph.entities.filter((entity) => anchorIds.has(entity.entityId));
    const entityIds = new Set(entities.map((entity) => entity.entityId));
    return {
      entities,
      // Only relationships whose endpoints are both part of the returned
      // personal-graph entity set (cross-graph business edges stay out of
      // the personal view unless their endpoints are personal entities).
      relationships: graph.relationships.filter(
        (rel) => entityIds.has(rel.fromId) && entityIds.has(rel.toId),
      ),
    };
  }

  computeStats(entities: ContextEntity[], relationships: ContextRelationship[]): GraphStats {
    const countByType: Record<string, number> = {};
    for (const entity of entities) {
      countByType[entity.type] = (countByType[entity.type] ?? 0) + 1;
    }
    const avgConfidence =
      entities.length === 0
        ? 0
        : entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    return {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      countByType,
      avgConfidence,
    };
  }
}
