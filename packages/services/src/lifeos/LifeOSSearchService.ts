// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Global Search Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSSearchResultDTO, LifeOSSearchCategory, LifeOSModule } from './LifeOSDTO.js';

export class LifeOSSearchService {
  private readonly searchableItems: LifeOSSearchResultDTO[] = [];

  indexItem(item: LifeOSSearchResultDTO): void {
    const existing = this.searchableItems.findIndex((i) => i.id === item.id);
    if (existing >= 0) this.searchableItems[existing] = item;
    else this.searchableItems.push(item);
  }

  indexItems(items: LifeOSSearchResultDTO[]): void {
    for (const item of items) this.indexItem(item);
  }

  removeItem(id: string): void {
    const idx = this.searchableItems.findIndex((i) => i.id === id);
    if (idx >= 0) this.searchableItems.splice(idx, 1);
  }

  search(
    query: string,
    options?: {
      categories?: LifeOSSearchCategory[];
      sources?: LifeOSModule[];
      maxResults?: number;
      minConfidence?: number;
    },
  ): LifeOSSearchResultDTO[] {
    const lower = query.toLowerCase();
    let results = this.searchableItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.tags.some((t) => t.toLowerCase().includes(lower)),
    );

    if (options?.categories && options.categories.length > 0) {
      results = results.filter((r) => options.categories?.includes(r.category) ?? false);
    }
    if (options?.sources && options.sources.length > 0) {
      results = results.filter((r) => options.sources?.includes(r.source) ?? false);
    }
    if (options?.minConfidence !== undefined) {
      results = results.filter((r) => r.confidence >= (options.minConfidence ?? 0));
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, options?.maxResults ?? 20);
  }

  getBySource(source: LifeOSModule): LifeOSSearchResultDTO[] {
    return this.searchableItems.filter((i) => i.source === source);
  }

  getByCategory(category: LifeOSSearchCategory): LifeOSSearchResultDTO[] {
    return this.searchableItems.filter((i) => i.category === category);
  }

  getIndexedCount(): number {
    return this.searchableItems.length;
  }

  clear(): void {
    this.searchableItems.length = 0;
  }
}
