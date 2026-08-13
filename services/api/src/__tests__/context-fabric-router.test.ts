// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Context Fabric Router tests
// Context & Personal Intelligence Fabric procedures (APP-001)
// End-to-end handler tests against a real seeded in-memory graph — the
// same "no mocks in production paths" convention as the OS router suite.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createContextFabricRouter } from '../routers/ContextFabricRouter.js';
import {
  ContextFabricApplicationService,
  InMemoryGraphRepository,
  createCatalogFabricEntities,
  createCatalogFabricRelationships,
  SEED_FABRIC_ORG_ID,
} from '@vedmoulya/context-fabric';
import type { FabricEngines } from '@vedmoulya/context-fabric';
import type { TRPCContext } from '../router.js';

const testCtx: TRPCContext = { userId: 'user_001', email: 'test@vedmoulya.com', role: 'member' };

const emptyEngines: FabricEngines = {
  context: { searchContext: async () => ({ success: true, data: { items: [], total: 0 } }) },
  memory: { retrieve: async () => ({ success: true, data: [] }) },
  knowledge: { search: async () => ({ success: true, data: [] }) },
  goals: { searchGoals: async () => ({ success: true, data: { items: [], total: 0 } }) },
  capabilities: {
    getMarketplace: async () =>
      ({
        success: true,
        data: {
          capabilities: [{ id: 'content_generation', name: 'Content Generation' }],
          total: 1,
        },
      }) as never,
  },
};

async function makeRouter(): Promise<ReturnType<typeof createContextFabricRouter>> {
  const repo = new InMemoryGraphRepository();
  for (const entity of createCatalogFabricEntities()) {
    await repo.saveEntity(entity);
  }
  for (const relationship of createCatalogFabricRelationships()) {
    await repo.saveRelationship(relationship);
  }
  const service = new ContextFabricApplicationService(repo, emptyEngines);
  return createContextFabricRouter(service);
}

describe('ContextFabricRouter (APP-001)', () => {
  it('getPersonalGraph returns the seeded personal graph', async () => {
    const router = await makeRouter();
    const result = await router.getPersonalGraph({ userId: 'user_001' }, testCtx);
    expect(result.success).toBe(true);
    const graph = result.data as {
      entities: unknown[];
      stats: { countByType: Record<string, number> };
    };
    expect(graph.entities.length).toBeGreaterThan(10);
    expect(graph.stats.countByType.goal).toBe(2);
  });

  it('getBusinessGraph returns the seeded business graph', async () => {
    const router = await makeRouter();
    const result = await router.getBusinessGraph(
      { userId: 'user_001', organizationId: SEED_FABRIC_ORG_ID },
      testCtx,
    );
    expect(result.success).toBe(true);
    const graph = result.data as { entities: unknown[] };
    expect(graph.entities.some((e) => (e as { type: string }).type === 'organization')).toBe(true);
  });

  it('search returns permission-gated ranked entities with reasons', async () => {
    const router = await makeRouter();
    const result = await router.search(
      { userId: 'user_001', query: 'enterprise blog platform' },
      testCtx,
    );
    expect(result.success).toBe(true);
    const data = result.data as { entities: unknown[]; ranking: Array<{ reasons: string[] }> };
    expect(data.entities.length).toBeGreaterThan(0);
    expect(data.ranking[0].reasons.length).toBeGreaterThan(0);
  });

  it('getEntity returns the entity with permission evaluation', async () => {
    const router = await makeRouter();
    const result = await router.getEntity(
      { userId: 'user_001', entityId: 'personal:goal:goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { permission: { allowed: boolean } }).permission.allowed).toBe(true);
  });

  it('getEntity fails cleanly for an unknown id', async () => {
    const router = await makeRouter();
    const result = await router.getEntity({ userId: 'user_001', entityId: 'missing' }, testCtx);
    expect(result.success).toBe(false);
    expect((result.error as { message: string }).message).toContain('not found');
  });

  it('getRelationships returns edges around an entity', async () => {
    const router = await makeRouter();
    const result = await router.getRelationships(
      { userId: 'user_001', entityId: 'personal:goal:goal_blog_seed', maxDepth: 1 },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { relationships: unknown[] }).relationships.length).toBeGreaterThan(0);
  });

  it('buildContextPackage assembles a minimum-useful package', async () => {
    const router = await makeRouter();
    const result = await router.buildContextPackage(
      { userId: 'user_001', goalId: 'goal_blog_seed', query: 'publish enterprise insights' },
      testCtx,
    );
    expect(result.success).toBe(true);
    const pkg = result.data as {
      items: unknown[];
      estimatedTokens: number;
      contextVersion: string;
    };
    expect(pkg.items.length).toBeGreaterThan(0);
    expect(pkg.estimatedTokens).toBeGreaterThan(0);
    expect(pkg.contextVersion).toContain('fabric-');
  });

  it('explainContextSelection returns human-readable reasons', async () => {
    const router = await makeRouter();
    const result = await router.explainContextSelection(
      { userId: 'user_001', entityId: 'personal:goal:goal_blog_seed', goalId: 'goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect((result.data as Array<{ selected: boolean }>)[0].selected).toBe(true);
  });

  it('getProvenance answers where/when/who/why', async () => {
    const router = await makeRouter();
    const result = await router.getProvenance(
      { userId: 'user_001', entityId: 'personal:goal:goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    const facts = (result.data as { facts: string[] }).facts;
    expect(facts.some((f) => f.startsWith('source:'))).toBe(true);
    expect(facts.some((f) => f.startsWith('created:'))).toBe(true);
  });

  it('getPermissions evaluates the access model', async () => {
    const router = await makeRouter();
    const result = await router.getPermissions(
      { userId: 'user_001', entityId: 'personal:goal:goal_blog_seed' },
      testCtx,
    );
    expect(result.success).toBe(true);
    expect((result.data as { permission: { allowed: boolean } }).permission.allowed).toBe(true);
  });

  it('getSources lists sources with entity counts', async () => {
    const router = await makeRouter();
    const result = await router.getSources({ userId: 'user_001' }, testCtx);
    expect(result.success).toBe(true);
    expect((result.data as unknown[]).length).toBeGreaterThan(3);
  });

  it('getHealth reports fabric diagnostics', async () => {
    const router = await makeRouter();
    const result = await router.getHealth({ userId: 'user_001' }, testCtx);
    expect(result.success).toBe(true);
    const health = result.data as { entityCount: number; permissionCoverage: number };
    expect(health.entityCount).toBe(createCatalogFabricEntities().length);
    expect(health.permissionCoverage).toBeGreaterThan(0.9);
  });
});
