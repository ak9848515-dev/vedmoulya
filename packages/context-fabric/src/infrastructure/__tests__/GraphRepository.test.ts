// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Repository tests
// APP-001 — Post-V1 Application Platform Layer
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
} from '../../catalog/fabric-catalog.js';
import { InMemoryGraphRepository } from '../InMemoryGraphRepository.js';
import { PostgresGraphRepository } from '../PostgresGraphRepository.js';

const entityId = 'personal:goal:goal_blog_seed';

async function seeded(): Promise<InMemoryGraphRepository> {
  const repo = new InMemoryGraphRepository();
  for (const entity of createCatalogFabricEntities()) {
    await repo.saveEntity(entity);
  }
  for (const relationship of createCatalogFabricRelationships()) {
    await repo.saveRelationship(relationship);
  }
  return repo;
}

describe('InMemoryGraphRepository', () => {
  it('saves and retrieves entities', async () => {
    const repo = await seeded();
    const entity = await repo.getEntity(entityId);
    expect(entity?.label).toContain('blog');
    expect(await repo.countEntities()).toBe(createCatalogFabricEntities().length);
  });

  it('lists entities with filters', async () => {
    const repo = await seeded();
    const personal = await repo.listEntities({ graph: 'personal', ownerId: 'user_001' });
    const business = await repo.listEntities({
      graph: 'business',
      organizationId: 'org_vedmoulya',
    });
    expect(personal.length).toBeGreaterThan(business.length);
    expect(business.every((e) => e.organizationId === 'org_vedmoulya')).toBe(true);
  });

  it('finds neighbors', async () => {
    const repo = await seeded();
    const neighbors = await repo.neighbors(entityId);
    expect(neighbors.length).toBeGreaterThan(1);
  });

  it('computes a shortest path', async () => {
    const repo = await seeded();
    const path = await repo.shortestPath('personal:user:me', 'personal:goal:goal_blog_seed');
    expect(path.length).toBeGreaterThan(0);
    // Path connects the endpoints.
    expect(path[0].fromId).toBe('personal:user:me');
    expect(path[path.length - 1].toId).toBe('personal:goal:goal_blog_seed');
  });

  it('returns an empty path when no route exists', async () => {
    const repo = await seeded();
    const path = await repo.shortestPath('personal:user:me', 'does:not:exist');
    expect(path).toHaveLength(0);
  });

  it('deletes an entity and its edges', async () => {
    const repo = await seeded();
    await repo.deleteEntity(entityId);
    expect(await repo.getEntity(entityId)).toBeUndefined();
    expect((await repo.neighbors(entityId)).length).toBe(0);
  });

  it('saves relationships idempotently by id', async () => {
    const repo = new InMemoryGraphRepository();
    const [entity, relationship] = [
      createCatalogFabricEntities()[0],
      createCatalogFabricRelationships()[0],
    ];
    await repo.saveRelationship(relationship);
    await repo.saveRelationship({ ...relationship, weight: 0.1 });
    expect(await repo.countRelationships()).toBe(1);
    expect(entity.entityId).toBeTruthy();
  });
});

describe('PostgresGraphRepository', () => {
  it('declares the JSONB document pattern and ensureTable DDL', () => {
    const source = PostgresGraphRepository.toString();
    expect(source).toContain('CREATE TABLE IF NOT EXISTS context_fabric_registry');
    expect(source).toContain('JSONB');
    expect(source).toContain('collection');
  });

  it('accepts a postgres client and implements the contract', async () => {
    // Structural conformance: the class must satisfy GraphRepository.
    const repo = new PostgresGraphRepository({} as never);
    expect(typeof repo.saveEntity).toBe('function');
    expect(typeof repo.shortestPath).toBe('function');
    expect(typeof repo.ensureTable).toBe('function');
  });
});
