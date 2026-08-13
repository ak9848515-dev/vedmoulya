// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Business Graph
// APP-001 — Post-V1 Application Platform Layer
// The organization/business-level context graph: Organization ──
// people, teams, clients, projects, processes, applications,
// documents, policies, knowledge and business capabilities, with
// relationships like person → member_of → team → owns → project →
// uses → application → implements → capability. Shares the same
// GraphRepository seam as the personal graph.
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessGraph,
  ContextEntity,
  ContextRelationship,
  GraphStats,
} from '../../types/fabric-types.js';
import type { GraphRepository } from '../repository/GraphRepository.js';

export class BusinessGraphService {
  constructor(private readonly repository: GraphRepository) {}

  /** Load the complete business graph for one organization. */
  async getBusinessGraph(organizationId: string): Promise<BusinessGraph> {
    const entities = await this.repository.listEntities({
      graph: 'business',
      organizationId,
    });
    const relationships = await this.repository.listRelationships();
    const stats = this.computeStats(entities, relationships);
    return { organizationId, entities, relationships, stats };
  }

  /** The capability chain: team → owns → project → uses → application → implements → capability. */
  async getCapabilityChain(organizationId: string): Promise<ContextRelationship[]> {
    const graph = await this.getBusinessGraph(organizationId);
    const chainTypes = new Set(['member_of', 'owns', 'uses', 'implements', 'part_of']);
    return graph.relationships.filter((rel) => chainTypes.has(rel.type));
  }

  /** People and the projects they are responsible for (enterprise view). */
  async getOwnershipMap(
    organizationId: string,
  ): Promise<Array<{ person: ContextEntity; projects: ContextEntity[] }>> {
    const graph = await this.getBusinessGraph(organizationId);
    const people = graph.entities.filter((entity) => entity.type === 'person');
    const projects = graph.entities.filter((entity) => entity.type === 'project');
    const map = new Map<string, string[]>(); // personId → projectIds
    for (const rel of graph.relationships) {
      if (rel.type === 'responsible_for' || rel.type === 'manages') {
        const list = map.get(rel.fromId) ?? [];
        list.push(rel.toId);
        map.set(rel.fromId, list);
      }
    }
    return people.map((person) => ({
      person,
      projects: projects.filter((project) =>
        (map.get(person.entityId) ?? []).includes(project.entityId),
      ),
    }));
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
