// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Insight Service
// EI-007 — Enterprise Learning Intelligence Platform
// Derives human-readable insights from aggregated learning models:
// underperforming entities, degrading trends, cost drift, quality gaps,
// and low-signal categories. Insights are advisory only — they never
// change behavior without human review.
// ──────────────────────────────────────────────────────────────────

import type {
  InsightSeverity,
  LearningInsight,
  LearningModel,
} from '../../types/learning-types.js';

export interface InsightOptions {
  /** Success rate below this triggers an underperformance warning. */
  successWarningThreshold?: number;
  /** Trend below this triggers a critical degradation insight. */
  criticalTrendThreshold?: number;
  /** Average quality below this triggers a quality warning. */
  qualityWarningThreshold?: number;
  /** Average cost above this triggers a cost warning (USD). */
  costWarningUsd?: number;
  /** Minimum samples before an entity is worth an insight. */
  minSamples?: number;
  /** Hard cap on the number of insights returned. */
  maxInsights?: number;
}

const DEFAULT_OPTIONS: Required<InsightOptions> = {
  successWarningThreshold: 0.5,
  criticalTrendThreshold: -0.25,
  qualityWarningThreshold: 0.7,
  costWarningUsd: 1,
  minSamples: 3,
  maxInsights: 30,
};

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export class LearningInsightService {
  private readonly options: Required<InsightOptions>;

  constructor(options: InsightOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  generateInsights(models: LearningModel[]): LearningInsight[] {
    const insights: LearningInsight[] = [];

    for (const model of models) {
      if (model.sampleCount < this.options.minSamples) continue;

      if (model.trend <= this.options.criticalTrendThreshold) {
        insights.push({
          insightId: `insight_degrade_${model.entityId}`,
          category: model.category,
          severity: 'critical',
          title: `Degrading performance: ${model.entityLabel}`,
          description: `${model.entityLabel} success dropped ${formatPct(-model.trend)} vs earlier runs — investigate before further use.`,
          evidence: [
            `Success rate ${formatPct(model.successRate)} across ${model.sampleCount} run(s).`,
            `Trend ${formatPct(model.trend)} (recent vs earlier).`,
          ],
          createdAt: new Date().toISOString(),
        });
      }

      if (model.successRate < this.options.successWarningThreshold) {
        insights.push({
          insightId: `insight_underperform_${model.entityId}`,
          category: model.category,
          severity: 'warning',
          title: `Underperforming: ${model.entityLabel}`,
          description: `${model.entityLabel} succeeds only ${formatPct(model.successRate)} of the time.`,
          evidence: [
            `${model.successCount}/${model.sampleCount} successful runs.`,
            `Average quality ${formatPct(model.avgQuality)}.`,
          ],
          createdAt: new Date().toISOString(),
        });
      }

      if (model.avgQuality < this.options.qualityWarningThreshold && model.category !== 'failure') {
        insights.push({
          insightId: `insight_quality_${model.entityId}`,
          category: model.category,
          severity: 'warning',
          title: `Quality below target: ${model.entityLabel}`,
          description: `${model.entityLabel} average quality ${formatPct(model.avgQuality)} is below the ${formatPct(this.options.qualityWarningThreshold)} target.`,
          evidence: [`Average quality ${formatPct(model.avgQuality)}.`],
          createdAt: new Date().toISOString(),
        });
      }

      if (
        model.avgCostUsd > this.options.costWarningUsd &&
        (model.category === 'provider' || model.category === 'budget')
      ) {
        insights.push({
          insightId: `insight_cost_${model.entityId}`,
          category: model.category,
          severity: 'warning',
          title: `Cost drift: ${model.entityLabel}`,
          description: `${model.entityLabel} averages $${model.avgCostUsd.toFixed(4)} per run — above the $${this.options.costWarningUsd.toFixed(2)} threshold.`,
          evidence: [`Average cost $${model.avgCostUsd.toFixed(4)}.`],
          createdAt: new Date().toISOString(),
        });
      }

      if (model.failureCount >= 3) {
        insights.push({
          insightId: `insight_failure_${model.entityId}`,
          category: model.category,
          severity: model.failureCount >= 6 ? 'critical' : 'warning',
          title: `Repeated failures: ${model.entityLabel}`,
          description: `${model.entityLabel} failed ${model.failureCount} time(s) — consider a fallback path or configuration review.`,
          evidence: [`${model.failureCount} failures, ${model.avgRetries.toFixed(1)} avg retries.`],
          createdAt: new Date().toISOString(),
        });
      }
    }

    return insights.slice(0, this.options.maxInsights);
  }

  /** A single dominant insight summary for a category (used in reports/UI). */
  dominantInsight(
    insights: LearningInsight[],
    category: LearningModel['category'],
  ): LearningInsight | undefined {
    const severities: InsightSeverity[] = ['critical', 'warning', 'info'];
    const candidates = insights.filter((i) => i.category === category);
    for (const severity of severities) {
      const found = candidates.find((i) => i.severity === severity);
      if (found) return found;
    }
    return candidates[0];
  }
}
