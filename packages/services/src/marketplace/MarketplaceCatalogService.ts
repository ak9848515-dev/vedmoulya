// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Catalog Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type {
  MarketplaceAssetDTO,
  MarketplaceCategoryDTO,
  MarketplaceCatalogDTO,
  CatalogFilterDTO,
} from './MarketplaceDTO.js';

export class MarketplaceCatalogService {
  private readonly assets = new Map<string, MarketplaceAssetDTO>();
  private readonly categories = new Map<string, MarketplaceCategoryDTO>();

  registerAsset(asset: MarketplaceAssetDTO): void {
    this.assets.set(asset.id, asset);
  }
  registerCategory(category: MarketplaceCategoryDTO): void {
    this.categories.set(category.id, category);
  }

  getAsset(assetId: string): MarketplaceAssetDTO | undefined {
    return this.assets.get(assetId);
  }

  getAllAssets(): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values());
  }

  getAssetsByType(type: string): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values()).filter((a) => a.type === type);
  }

  getAssetsByCategory(category: string): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values()).filter((a) => a.category === category);
  }

  searchAssets(query: string): MarketplaceAssetDTO[] {
    const lower = query.toLowerCase();
    return Array.from(this.assets.values()).filter(
      (a) =>
        a.name.toLowerCase().includes(lower) ||
        a.description.toLowerCase().includes(lower) ||
        a.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  getFeaturedAssets(): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values())
      .filter((a) => a.rating >= 4.5)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 6);
  }

  getPopularAssets(): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values())
      .sort((a, b) => b.downloadCount - a.downloadCount)
      .slice(0, 10);
  }

  getRecentAssets(): MarketplaceAssetDTO[] {
    return Array.from(this.assets.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  filterAssets(filter: CatalogFilterDTO): MarketplaceAssetDTO[] {
    let results = Array.from(this.assets.values());
    if (filter.type) results = results.filter((a) => a.type === filter.type);
    if (filter.category) results = results.filter((a) => a.category === filter.category);
    if (filter.search) {
      const searchTerm = filter.search;
      results = results.filter((a) => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filter.tags && filter.tags.length > 0) {
      const tags = filter.tags;
      results = results.filter((a) => tags.some((t) => a.tags.includes(t)));
    }
    switch (filter.sortBy) {
      case 'popular':
        results.sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case 'recent':
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    return results.slice((page - 1) * pageSize, page * pageSize);
  }

  getCategories(): MarketplaceCategoryDTO[] {
    return Array.from(this.categories.values());
  }

  getCatalog(): MarketplaceCatalogDTO {
    return {
      totalAssets: this.assets.size,
      categories: this.getCategories(),
      featured: this.getFeaturedAssets(),
      popular: this.getPopularAssets(),
      recent: this.getRecentAssets(),
    };
  }

  removeAsset(assetId: string): void {
    this.assets.delete(assetId);
  }
  removeCategory(categoryId: string): void {
    this.categories.delete(categoryId);
  }
}
