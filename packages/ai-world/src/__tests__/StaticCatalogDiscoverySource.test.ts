// ──────────────────────────────────────────────────────────────────
// VedMoulya — StaticCatalogDiscoverySource tests
// EPIC-012C — deterministic, evidence-honest default source
//
// The default discovery source ships a small curated catalog of
// well-known ecosystem facts. Nothing is invented; unknown fields
// stay UNKNOWN. The catalog is stable across runs (deterministic
// fixtures — the product and the tests share the same data).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { StaticCatalogDiscoverySource } from '../infrastructure/StaticCatalogDiscoverySource.js';
import { DISCOVERY_CATEGORIES, FREE_RESOURCE_CLASSES } from '../types/discovery-types.js';

const source = new StaticCatalogDiscoverySource();

describe('StaticCatalogDiscoverySource — curated catalog', () => {
  it('is deterministic across runs', async () => {
    const a = await source.discover();
    const b = await source.discover();
    expect(a.items).toEqual(b.items);
    expect(a.items.length).toBeGreaterThanOrEqual(5);
  });

  it('covers every discovery category (provider/model/github/application/news)', async () => {
    const { items } = await source.discover();
    for (const category of DISCOVERY_CATEGORIES) {
      expect(items.some((i) => i.category === category)).toBe(true);
    }
  });

  it('every entry is evidence-honest (explicit confidence, never fabricated)', async () => {
    const { items } = await source.discover();
    for (const item of items) {
      expect(FREE_RESOURCE_CLASSES).toContain(item.claimedFreeClass);
      expect(Array.isArray(item.evidence)).toBe(true);
      // Unknowns are declared UNKNOWN, never invented.
      for (const evidence of item.evidence ?? []) {
        expect(['VERIFIED', 'PROVIDER_DECLARED', 'MEASURED', 'INFERRED', 'UNKNOWN']).toContain(
          evidence.confidence,
        );
      }
    }
  });

  it('the configurable provider entry suggests a registry family for one-click setup', async () => {
    const { items } = await source.discover();
    const openrouter = items.find((i) => i.modelFacts?.suggestedFamily === 'openrouter');
    expect(openrouter).toBeDefined();
    expect(openrouter?.category).toBe('provider');
  });

  it('exposes the stable source identity used for item provenance', () => {
    expect(source.id).toBe('vedmoulya-catalog');
    expect(source.name).toBe('VedMoulya Curated Catalog');
  });
});
