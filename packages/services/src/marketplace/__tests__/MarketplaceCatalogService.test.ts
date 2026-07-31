// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Catalog Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceCatalogService } from '../MarketplaceCatalogService.js';
import type { MarketplaceAssetDTO, MarketplaceCategoryDTO } from '../MarketplaceDTO.js';

function makeAsset(
  overrides: Partial<MarketplaceAssetDTO> & {
    id: string;
    name: string;
    type: MarketplaceAssetDTO['type'];
  },
): MarketplaceAssetDTO {
  return {
    description: '',
    category: 'general',
    version: '1.0.0',
    author: 'test',
    publisher: 'test',
    tags: [],
    rating: 3,
    downloadCount: 0,
    isInstalled: false,
    isActive: false,
    isBuiltIn: false,
    size: 0,
    requirements: [],
    screenshots: [],
    changelog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeCategory(
  overrides: Partial<MarketplaceCategoryDTO> & { id: string; name: string },
): MarketplaceCategoryDTO {
  return {
    slug: overrides.name.toLowerCase().replace(/\s+/g, '-'),
    description: '',
    icon: 'icon',
    assetCount: 0,
    ...overrides,
  };
}

describe('MarketplaceCatalogService', () => {
  it('getAllAssets returns empty initially', () => {
    const svc = new MarketplaceCatalogService();
    expect(svc.getAllAssets()).toEqual([]);
  });

  it('registerAsset and getAsset roundtrips', () => {
    const svc = new MarketplaceCatalogService();
    const asset = makeAsset({ id: 'a1', name: 'Test Asset', type: 'ai_provider', rating: 4.5 });
    svc.registerAsset(asset);
    expect(svc.getAsset('a1')).toEqual(asset);
  });

  it('getAssetsByType filters correctly', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'AI', type: 'ai_provider' }));
    svc.registerAsset(makeAsset({ id: 'a2', name: 'Pack', type: 'knowledge_pack' }));
    const ais = svc.getAssetsByType('ai_provider');
    expect(ais.length).toBe(1);
    expect(ais[0].id).toBe('a1');
  });

  it('getAssetsByCategory filters correctly', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'A', type: 'ai_provider', category: 'ai' }));
    svc.registerAsset(makeAsset({ id: 'a2', name: 'B', type: 'prompt_pack', category: 'prompts' }));
    const cats = svc.getAssetsByCategory('ai');
    expect(cats.length).toBe(1);
  });

  it('searchAssets finds by name, description, and tags', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(
      makeAsset({
        id: 'a1',
        name: 'OpenAI Provider',
        type: 'ai_provider',
        description: 'GPT integration',
      }),
    );
    svc.registerAsset(
      makeAsset({ id: 'a2', name: 'GPT Pack', type: 'prompt_pack', tags: ['openai', 'gpt'] }),
    );
    const results = svc.searchAssets('openai');
    expect(results.length).toBe(2);
  });

  it('getFeaturedAssets returns top-rated', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Popular', type: 'ai_provider', rating: 4.8 }));
    svc.registerAsset(makeAsset({ id: 'a2', name: 'Average', type: 'ai_provider', rating: 3.0 }));
    svc.registerAsset(makeAsset({ id: 'a3', name: 'Featured', type: 'ai_provider', rating: 4.9 }));
    const featured = svc.getFeaturedAssets();
    expect(featured.length).toBe(2);
    expect(featured[0].id).toBe('a3');
    expect(featured[1].id).toBe('a1');
  });

  it('getPopularAssets returns by download count', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(
      makeAsset({ id: 'a1', name: 'Less', type: 'ai_provider', downloadCount: 10 }),
    );
    svc.registerAsset(
      makeAsset({ id: 'a2', name: 'More', type: 'ai_provider', downloadCount: 100 }),
    );
    const pop = svc.getPopularAssets();
    expect(pop[0].id).toBe('a2');
  });

  it('getRecentAssets returns by creation date', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(
      makeAsset({ id: 'a1', name: 'Old', type: 'ai_provider', createdAt: '2024-01-01T00:00:00Z' }),
    );
    svc.registerAsset(
      makeAsset({ id: 'a2', name: 'New', type: 'ai_provider', createdAt: '2024-06-01T00:00:00Z' }),
    );
    const recent = svc.getRecentAssets();
    expect(recent[0].id).toBe('a2');
  });

  it('filterAssets supports all filter dimensions', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(
      makeAsset({
        id: 'a1',
        name: 'Alpha',
        type: 'ai_provider',
        category: 'ai',
        tags: ['gpt'],
        downloadCount: 50,
        rating: 4,
        createdAt: '2024-01-01T00:00:00Z',
      }),
    );
    svc.registerAsset(
      makeAsset({
        id: 'a2',
        name: 'Beta',
        type: 'knowledge_pack',
        category: 'docs',
        tags: ['docs'],
        downloadCount: 100,
        rating: 3,
        createdAt: '2024-06-01T00:00:00Z',
      }),
    );

    const filtered = svc.filterAssets({ type: 'ai_provider' });
    expect(filtered.length).toBe(1);
  });

  it('filterAssets supports all sort options', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(
      makeAsset({
        id: 'a1',
        name: 'B',
        type: 'ai_provider',
        downloadCount: 10,
        rating: 4,
        createdAt: '2024-06-01T00:00:00Z',
      }),
    );
    svc.registerAsset(
      makeAsset({
        id: 'a2',
        name: 'A',
        type: 'ai_provider',
        downloadCount: 100,
        rating: 5,
        createdAt: '2024-01-01T00:00:00Z',
      }),
    );

    const byRating = svc.filterAssets({ sortBy: 'rating' });
    expect(byRating[0].id).toBe('a2');

    const byName = svc.filterAssets({ sortBy: 'name' });
    expect(byName[0].id).toBe('a2');

    const byPopular = svc.filterAssets({ sortBy: 'popular' });
    expect(byPopular[0].id).toBe('a2');

    const byRecent = svc.filterAssets({ sortBy: 'recent' });
    expect(byRecent[0].id).toBe('a1');
  });

  it('filterAssets handles no sortBy (default order)', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'A', type: 'ai_provider' }));
    const result = svc.filterAssets({});
    expect(result.length).toBe(1);
  });

  it('registerCategory and getCategories roundtrips', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerCategory(makeCategory({ id: 'cat1', name: 'AI Providers' }));
    const cats = svc.getCategories();
    expect(cats.length).toBe(1);
    expect(cats[0].name).toBe('AI Providers');
  });

  it('getCatalog returns complete catalog view', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerCategory(makeCategory({ id: 'cat1', name: 'AI' }));
    svc.registerAsset(
      makeAsset({ id: 'a1', name: 'Test', type: 'ai_provider', rating: 4.8, downloadCount: 100 }),
    );
    const cat = svc.getCatalog();
    expect(cat.totalAssets).toBe(1);
    expect(cat.categories.length).toBe(1);
    expect(cat.featured.length).toBe(1);
    expect(cat.popular.length).toBe(1);
    expect(cat.recent.length).toBe(1);
  });

  it('removeAsset deletes asset', () => {
    const svc = new MarketplaceCatalogService();
    svc.registerAsset(makeAsset({ id: 'a1', name: 'Test', type: 'ai_provider' }));
    svc.removeAsset('a1');
    expect(svc.getAsset('a1')).toBeUndefined();
  });
});
