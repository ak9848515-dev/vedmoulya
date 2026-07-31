// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Recommendation Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceRecommendationDTO } from './MarketplaceDTO.js';
import type { MarketplaceAssetDTO } from './MarketplaceDTO.js';

export class MarketplaceRecommendationService {
  generateRecommendations(input: {
    availableUpdates: number;
    uninstalledPopular: MarketplaceAssetDTO[];
    providersWithErrors: number;
    pendingActivations: number;
    incompatibleAssets: number;
    newHighRatedAssets: MarketplaceAssetDTO[];
  }): MarketplaceRecommendationDTO[] {
    const recs: MarketplaceRecommendationDTO[] = [];
    let priority = 1;

    if (input.providersWithErrors > 0) {
      recs.push(
        this.create(
          priority++,
          'provider',
          'Fix Provider Errors',
          `${String(input.providersWithErrors)} provider${input.providersWithErrors > 1 ? 's' : ''} reporting errors. Check and resolve provider configurations.`,
          'Providers with errors can disrupt platform functionality.',
          '/marketplace/providers',
          0.95,
        ),
      );
    }
    if (input.pendingActivations > 0) {
      recs.push(
        this.create(
          priority++,
          'asset',
          'Activate Pending Assets',
          `${String(input.pendingActivations)} asset${input.pendingActivations > 1 ? 's' : ''} pending activation. Activate them to start using.`,
          'Inactive assets provide no value until activated.',
          '/marketplace/activations',
          0.9,
        ),
      );
    }
    if (input.availableUpdates > 0) {
      recs.push(
        this.create(
          priority++,
          'update',
          'Install Available Updates',
          `${String(input.availableUpdates)} update${input.availableUpdates > 1 ? 's' : ''} available for your installed assets.`,
          'Keeping assets updated ensures compatibility and security.',
          '/marketplace/updates',
          0.85,
        ),
      );
    }
    if (input.incompatibleAssets > 0) {
      recs.push(
        this.create(
          priority++,
          'asset',
          'Resolve Compatibility Issues',
          `${String(input.incompatibleAssets)} asset${input.incompatibleAssets > 1 ? 's' : ''} with compatibility issues. Review and update.`,
          'Incompatible assets may cause platform instability.',
          '/marketplace/compatibility',
          0.8,
        ),
      );
    }
    if (input.newHighRatedAssets.length > 0) {
      const topAsset = input.newHighRatedAssets[0];
      if (topAsset) {
        recs.push(
          this.create(
            priority++,
            'asset',
            `Try: ${topAsset.name}`,
            `Highly rated ${topAsset.type} available. Rating: ${String(topAsset.rating)}/5.`,
            `New high-quality ${topAsset.type} can enhance your platform experience.`,
            `/marketplace/asset/${topAsset.id}`,
            0.7,
          ),
        );
      }
    }
    if (input.uninstalledPopular.length > 0) {
      const topAsset = input.uninstalledPopular[0];
      if (topAsset) {
        recs.push(
          this.create(
            priority++,
            'asset',
            `Popular: ${topAsset.name}`,
            `${topAsset.name} has ${String(topAsset.downloadCount)} downloads. Consider installing.`,
            'Popular assets are trusted by the community.',
            `/marketplace/asset/${topAsset.id}`,
            0.6,
          ),
        );
      }
    }

    recs.push(
      this.create(
        priority++,
        'plugin',
        'Explore Marketplace',
        'Browse the catalog to discover new assets for your platform.',
        'Regularly exploring new assets keeps your platform powerful.',
        '/marketplace/catalog',
        0.5,
      ),
    );
    recs.push(
      this.create(
        priority++,
        'template',
        'Review Templates',
        'Check available templates to accelerate your workflows.',
        'Templates can save time and provide best-practice starting points.',
        '/marketplace/templates',
        0.4,
      ),
    );

    return recs;
  }

  prioritizeRecommendations(
    recs: MarketplaceRecommendationDTO[],
    maxCount: number = 10,
  ): MarketplaceRecommendationDTO[] {
    return recs
      .filter((r) => !r.isDismissed)
      .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
      .slice(0, maxCount);
  }

  dismissRecommendation(
    recs: MarketplaceRecommendationDTO[],
    id: string,
  ): MarketplaceRecommendationDTO[] {
    return recs.map((r) => (r.id === id ? { ...r, isDismissed: true } : r));
  }

  private create(
    priority: number,
    category: MarketplaceRecommendationDTO['category'],
    title: string,
    description: string,
    reason: string,
    actionRoute: string,
    confidence: number,
  ): MarketplaceRecommendationDTO {
    return {
      id: `mrec_${String(Date.now())}_${String(priority)}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      title,
      description,
      priority,
      confidence,
      source: 'marketplace',
      reason,
      actionLabel: 'View',
      actionRoute,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}
