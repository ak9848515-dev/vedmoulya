// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Graph tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
} from '../../../catalog/fabric-catalog.js';
import { InMemoryGraphRepository } from '../../../infrastructure/InMemoryGraphRepository.js';
import { PersonalGraphService } from '../PersonalGraphService.js';
import { BusinessGraphService } from '../BusinessGraphService.js';
import { FabricHealthService } from '../FabricHealthService.js';
import {
  buildProvenance,
  buildSelectionRationale,
  provenanceStatement,
} from '../ProvenanceService.js';

async function seededRepository(): Promise<InMemoryGraphRepository> {
  const repo = new InMemoryGraphRepository();
  for (const entity of createCatalogFabricEntities()) {
    await repo.saveEntity(entity);
  }
  for (const relationship of createCatalogFabricRelationships()) {
    await repo.saveRelationship(relationship);
  }
  return repo;
}

describe('PersonalGraphService', () => {
  it('loads the personal graph for a user with stats', async () => {
    const repo = await seededRepository();
    const service = new PersonalGraphService(repo);
    const graph = await service.getPersonalGraph('user_001');
    expect(graph.userId).toBe('user_001');
    expect(graph.entities.length).toBeGreaterThan(10);
    expect(graph.stats.entityCount).toBe(graph.entities.length);
    expect(graph.stats.countByType.goal).toBe(2);
    expect(graph.stats.avgConfidence).toBeGreaterThan(0.8);
  });

  it('returns an empty graph for an unknown user', async () => {
    const repo = await seededRepository();
    const service = new PersonalGraphService(repo);
    const graph = await service.getPersonalGraph('nobody');
    expect(graph.entities).toHaveLength(0);
    expect(graph.stats.avgConfidence).toBe(0);
  });

  it('finds two-hop related entities for an anchor', async () => {
    const repo = await seededRepository();
    const service = new PersonalGraphService(repo);
    const { entities, relationships } = await service.getRelated(
      'user_001',
      'personal:goal:goal_blog_seed',
    );
    expect(entities.length).toBeGreaterThan(1);
    expect(relationships.length).toBeGreaterThan(0);
    // Every relationship touches the anchor or its neighbors.
    for (const rel of relationships) {
      expect(entities.some((e) => e.entityId === rel.fromId)).toBe(true);
    }
  });
});

describe('BusinessGraphService', () => {
  it('loads the business graph for an organization', async () => {
    const repo = await seededRepository();
    const service = new BusinessGraphService(repo);
    const graph = await service.getBusinessGraph('org_vedmoulya');
    expect(graph.organizationId).toBe('org_vedmoulya');
    expect(graph.entities.some((e) => e.type === 'organization')).toBe(true);
    expect(graph.stats.countByType.team).toBe(1);
  });

  it('extracts the capability chain (team owns project uses app implements capability)', async () => {
    const repo = await seededRepository();
    const service = new BusinessGraphService(repo);
    const chain = await service.getCapabilityChain('org_vedmoulya');
    expect(chain.length).toBeGreaterThan(0);
    expect(chain.some((rel) => rel.type === 'implements')).toBe(true);
  });

  it('maps people to the projects they are responsible for', async () => {
    const repo = await seededRepository();
    const service = new BusinessGraphService(repo);
    const ownership = await service.getOwnershipMap('org_vedmoulya');
    const asha = ownership.find((entry) => entry.person.label.includes('Asha'));
    expect(asha).toBeDefined();
    expect(asha?.projects.length).toBeGreaterThan(0);
  });
});

describe('FabricHealthService', () => {
  it('reports health from the seeded graph', async () => {
    const repo = await seededRepository();
    const service = new FabricHealthService(repo);
    const health = await service.getHealth();
    expect(health.entityCount).toBe(createCatalogFabricEntities().length);
    expect(health.relationshipCount).toBe(createCatalogFabricRelationships().length);
    expect(health.personalCount).toBeGreaterThan(0);
    expect(health.businessCount).toBeGreaterThan(0);
    expect(health.permissionCoverage).toBeGreaterThan(0.9);
    expect(health.checkedAt).toBeTruthy();
  });

  it('snapshots compact health for dashboards', async () => {
    const repo = await seededRepository();
    const service = new FabricHealthService(repo);
    const snapshot = await service.getSnapshot();
    expect(snapshot.entityCount).toBeGreaterThan(0);
    expect(typeof snapshot.permissionCoverage).toBe('number');
  });
});

describe('ProvenanceService', () => {
  it('builds provenance from a request', () => {
    const provenance = buildProvenance({
      source: 'memory',
      sourceId: 'm1',
      producedBy: 'memory-engine',
      reason: 'recent success',
      confidence: 0.9,
      now: '2026-08-07T00:00:00.000Z',
    });
    expect(provenance.source).toBe('memory');
    expect(provenance.createdAt).toBe('2026-08-07T00:00:00.000Z');
    expect(provenance.producedBy).toBe('memory-engine');
  });

  it('states provenance for an entity', async () => {
    const repo = await seededRepository();
    const entity = (await repo.getEntity('personal:goal:goal_blog_seed'))!;
    const statement = provenanceStatement(entity);
    expect(statement).toContain('goal');
    expect(statement).toContain('goal_blog_seed');
  });

  it('builds a selection rationale combining provenance and permission', async () => {
    const repo = await seededRepository();
    const entity = (await repo.getEntity('personal:knowledge:fabric_pattern'))!;
    const rationale = buildSelectionRationale(
      entity,
      { entityId: entity.entityId, allowed: true, reasons: ['you are the owner'] },
      ['directly related to the current goal'],
    );
    expect(rationale.statement).toContain('Selected because:');
    expect(rationale.facts.some((fact) => fact.includes('Access granted'))).toBe(true);
  });
});
