// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EI registry boot seeding
//
// Development/test registries are seeded from their platform catalogs; a fresh
// production/staging Postgres registry only ran DDL (ensureTable) and stayed
// EMPTY, so every registry-backed screen (AI Providers → Add AI, capability
// marketplace, …) saw zero rows. These tests pin the empty-registry boot seed
// that closes that gap, without overwriting an operator-managed registry.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  CATALOG_SIZE,
  InMemoryProviderRepository,
  createCatalogProviders,
} from '@vedmoulya/providers';
import { createCatalogCapabilities } from '@vedmoulya/capabilities';
import { createCatalogContext } from '@vedmoulya/context';
import { createCatalogStrategies } from '@vedmoulya/execution-strategy';
import { createCatalogGoals } from '@vedmoulya/goals';
import {
  seedProviderRegistryIfEmpty,
  seedRegistryIfEmpty,
} from '../infrastructure/ProductionRepositories.js';

describe('seedProviderRegistryIfEmpty', () => {
  it('seeds the authoritative platform catalog into an empty registry', async () => {
    const repo = new InMemoryProviderRepository();

    const written = await seedProviderRegistryIfEmpty(repo);

    expect(written).toBe(CATALOG_SIZE);
    expect(await repo.count()).toBe(CATALOG_SIZE);
    // The built-in families the Add AI screen lists are present.
    const families = (await repo.listAll()).map((provider) => provider.family);
    expect(families).toContain('google');
    expect(families).toContain('openai');
    expect(families).toContain('anthropic');
  });

  it('never overwrites a registry that already has providers', async () => {
    const [first] = createCatalogProviders();
    const repo = new InMemoryProviderRepository([first]);

    const written = await seedProviderRegistryIfEmpty(repo);

    expect(written).toBe(0);
    expect(await repo.count()).toBe(1);
  });
});

describe('seedRegistryIfEmpty (EI catalogs)', () => {
  const catalogs = [
    { name: 'capabilities', items: createCatalogCapabilities() },
    { name: 'context', items: createCatalogContext() },
    { name: 'strategies', items: createCatalogStrategies() },
    { name: 'goals', items: createCatalogGoals() },
  ];

  it.each(catalogs)('seeds the $name catalog and is idempotent', async ({ items }) => {
    expect(items.length).toBeGreaterThan(0);

    const saved: unknown[] = [];
    const written = await seedRegistryIfEmpty(
      async () => saved.length,
      items,
      async (list) => {
        saved.push(...list);
      },
    );

    expect(written).toBe(items.length);
    expect(saved).toHaveLength(items.length);

    // Second boot pass: a non-empty registry is left untouched.
    const second = await seedRegistryIfEmpty(
      async () => saved.length,
      items,
      async () => {
        throw new Error('must not write into a non-empty registry');
      },
    );
    expect(second).toBe(0);
  });
});
