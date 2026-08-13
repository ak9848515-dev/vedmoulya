// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Recommendation Service
// EI-007 — Enterprise Learning Intelligence Platform
// Generates the seven EI-007 recommendations from aggregated learning
// models:
//   Best Provider · Best Context · Best Strategy · Best Capability
//   Best Budget · Best Prompt · Best Execution Pattern
// Recommendations are DERIVED from observed events only. They are born
// `pending` and never become actionable without explicit human approval
// (see LearningSafetyService). Engine ports are consulted to enrich
// entity labels from the live registries — never to bypass learning data.
// ──────────────────────────────────────────────────────────────────

import type { LearningEngines } from '../../contracts/learning-engines.js';
import type {
  LearningCategory,
  LearningModel,
  LearningRecommendation,
  RecommendationType,
} from '../../types/learning-types.js';
import { createRecommendationId } from '../value-objects/RecommendationId.js';
import type { LearningSafetyThresholds } from '../rules/LearningRules.js';

export interface RecommendationOptions {
  /** Cost reference for normalizing cost into the composite score. */
  maxReferenceCostUsd?: number;
  /** Latency reference for normalizing latency into the composite score. */
  maxReferenceLatencyMs?: number;
  /** Max retries reference for normalizing retries into the score. */
  maxReferenceRetries?: number;
}

const DEFAULT_OPTIONS: Required<RecommendationOptions> = {
  maxReferenceCostUsd: 5,
  maxReferenceLatencyMs: 30_000,
  maxReferenceRetries: 5,
};

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export class LearningRecommendationService {
  private readonly options: Required<RecommendationOptions>;

  constructor(options: RecommendationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Composite value score for an entity model (higher is better). Budget
   * category is scored differently — cost is the learned budget, not a
   * penalty.
   */
  score(model: LearningModel): number {
    if (model.category === 'budget') {
      return round(0.5 * model.successRate + 0.3 * model.avgQuality + 0.2 * model.confidence);
    }
    const costFactor = 1 - Math.min(1, model.avgCostUsd / this.options.maxReferenceCostUsd);
    const latencyFactor = 1 - Math.min(1, model.avgLatencyMs / this.options.maxReferenceLatencyMs);
    const retryFactor = 1 - Math.min(1, model.avgRetries / this.options.maxReferenceRetries);
    return round(
      0.35 * model.successRate +
        0.25 * model.avgQuality +
        0.15 * costFactor +
        0.1 * latencyFactor +
        0.1 * model.confidence +
        0.05 * retryFactor,
    );
  }

  /** Pick the best eligible model for a category (optionally an entity type),
   *  or null when below threshold. */
  private bestModel(
    models: LearningModel[],
    category: LearningCategory,
    entityType: string | undefined,
    thresholds: LearningSafetyThresholds,
  ): LearningModel | null {
    const eligible = models
      .filter(
        (m) =>
          m.category === category &&
          (entityType === undefined || m.entityType === entityType) &&
          m.sampleCount >= thresholds.minSamplesForRecommendation,
      )
      .sort((a, b) => this.score(b) - this.score(a));
    return eligible[0] ?? null;
  }

  /**
   * Generate the seven recommendations. `engines` is used only for label
   * enrichment (graceful when unavailable).
   */
  async generateRecommendations(
    models: LearningModel[],
    engines: LearningEngines,
    thresholds: LearningSafetyThresholds,
  ): Promise<LearningRecommendation[]> {
    const now = new Date().toISOString();
    const recommendations: LearningRecommendation[] = [];

    const providerNames = await this.collectProviderLabels(engines);
    const capabilityNames = await this.collectCapabilityLabels(engines);

    const specs: Array<{
      type: RecommendationType;
      category: LearningCategory;
      title: string;
      entityType: string;
    }> = [
      {
        type: 'best_provider',
        category: 'provider',
        title: 'Best Provider',
        entityType: 'provider',
      },
      { type: 'best_context', category: 'context', title: 'Best Context', entityType: 'context' },
      {
        type: 'best_strategy',
        category: 'execution',
        title: 'Best Strategy',
        entityType: 'strategy',
      },
      {
        type: 'best_capability',
        category: 'capability',
        title: 'Best Capability',
        entityType: 'capability',
      },
      { type: 'best_budget', category: 'budget', title: 'Best Budget', entityType: 'budget' },
      { type: 'best_prompt', category: 'prompt', title: 'Best Prompt', entityType: 'prompt' },
      {
        type: 'best_execution_pattern',
        category: 'execution',
        title: 'Best Execution Pattern',
        entityType: 'execution_pattern',
      },
    ];

    for (const spec of specs) {
      const model = this.bestModel(models, spec.category, spec.entityType, thresholds);
      if (!model) continue;
      recommendations.push(
        this.buildRecommendation(model, spec, providerNames, capabilityNames, now),
      );
    }

    return recommendations.sort((a, b) => b.value - a.value);
  }

  private buildRecommendation(
    model: LearningModel,
    spec: {
      type: RecommendationType;
      category: LearningCategory;
      title: string;
      entityType: string;
    },
    providerNames: Map<string, string>,
    capabilityNames: Map<string, string>,
    now: string,
  ): LearningRecommendation {
    const label =
      this.resolveLabel(model, providerNames, capabilityNames) ||
      model.entityLabel ||
      model.entityId;
    const value = this.score(model);
    const rationale = this.buildRationale(model);
    return {
      recommendationId: createRecommendationId(spec.type, model.entityId),
      type: spec.type,
      category: spec.category,
      title: spec.title,
      description: this.buildDescription(spec.type, label, model),
      targetEntity: { entityType: spec.entityType, entityId: model.entityId, entityLabel: label },
      value,
      confidence: model.confidence,
      sampleCount: model.sampleCount,
      status: 'pending',
      version: 1,
      rationale,
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildDescription(type: RecommendationType, label: string, model: LearningModel): string {
    switch (type) {
      case 'best_budget':
        return `Recommended budget allocation: ~$${model.avgCostUsd.toFixed(4)} per run (observed average with margin).`;
      case 'best_execution_pattern':
        return `Execution pattern "${label}" shows the highest observed success rate (${(model.successRate * 100).toFixed(0)}%).`;
      default:
        return `Recommend "${label}" for ${type.replace('best_', '').replace(/_/g, ' ')} with ${(model.successRate * 100).toFixed(0)}% observed success.`;
    }
  }

  private buildRationale(model: LearningModel): string[] {
    const reasons: string[] = [
      `${model.sampleCount} observed run(s), ${model.successCount} successful (${(model.successRate * 100).toFixed(0)}%).`,
      `Average quality ${(model.avgQuality * 100).toFixed(0)}%, accuracy ${(model.avgAccuracy * 100).toFixed(0)}%.`,
      `Average cost $${model.avgCostUsd.toFixed(4)} per run, p50 latency ${Math.round(model.avgLatencyMs)} ms.`,
    ];
    if (model.trend > 0.1) {
      reasons.push(
        `Trend improving: +${(model.trend * 100).toFixed(0)}pt recent vs earlier success.`,
      );
    }
    if (model.trend < -0.1) {
      reasons.push(
        `Trend declining: ${(model.trend * 100).toFixed(0)}pt recent vs earlier success.`,
      );
    }
    return reasons;
  }

  private resolveLabel(
    model: LearningModel,
    providerNames: Map<string, string>,
    capabilityNames: Map<string, string>,
  ): string | undefined {
    if (model.category === 'provider') return providerNames.get(model.entityId);
    if (model.category === 'capability') return capabilityNames.get(model.entityId);
    return undefined;
  }

  private async collectProviderLabels(engines: LearningEngines): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    try {
      const marketplace = await engines.providers.getMarketplace();
      for (const provider of marketplace.data?.providers ?? []) {
        result.set(provider.id, provider.name);
      }
    } catch {
      // Registry unavailable — fall back to observed labels only.
    }
    return result;
  }

  private async collectCapabilityLabels(engines: LearningEngines): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    try {
      const marketplace = await engines.capabilities.getMarketplace();
      for (const capability of marketplace.data?.capabilities ?? []) {
        result.set(capability.id, capability.name);
      }
    } catch {
      // Registry unavailable — fall back to observed labels only.
    }
    return result;
  }
}
