// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Report Service
// EI-007 — Enterprise Learning Intelligence Platform
// Builds per-category learning reports: totals, success rate, cost /
// latency / quality averages, top entities, at-risk entities, and a
// plain-language summary. Purely derived from events + models.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access below indexes closed-union records (learning
   categories) — never attacker-controlled input. */

import type {
  LearningCategory,
  LearningEvent,
  LearningModel,
  LearningReport,
} from '../../types/learning-types.js';
import { LEARNING_CATEGORY_LABELS } from '../../types/learning-types.js';

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

export class LearningReportService {
  /** Build one report for a category from its events and models. */
  generateReport(
    category: LearningCategory,
    events: LearningEvent[],
    models: LearningModel[],
  ): LearningReport {
    const categoryEvents = events.filter((e) => e.category === category);
    const categoryModels = models.filter((m) => m.category === category);
    const successes = categoryEvents.filter((e) => e.outcome === 'success').length;
    const total = categoryEvents.length;
    const successRate = total === 0 ? 0 : round(successes / total);
    const avgCostUsd =
      total === 0 ? 0 : round(categoryEvents.reduce((sum, e) => sum + e.costUsd, 0) / total);
    const avgLatencyMs =
      total === 0 ? 0 : Math.round(categoryEvents.reduce((sum, e) => sum + e.latencyMs, 0) / total);
    const avgQuality =
      total === 0 ? 0 : round(categoryEvents.reduce((sum, e) => sum + e.quality, 0) / total);

    const timestamps = categoryEvents.map((e) => new Date(e.occurredAt).getTime());
    const start =
      timestamps.length > 0
        ? new Date(Math.min(...timestamps)).toISOString()
        : new Date().toISOString();
    const end =
      timestamps.length > 0
        ? new Date(Math.max(...timestamps)).toISOString()
        : new Date().toISOString();

    const topEntities = [...categoryModels]
      .sort((a, b) => b.successRate - a.successRate || b.sampleCount - a.sampleCount)
      .slice(0, 5)
      .map((m) => ({
        entityId: m.entityId,
        entityLabel: m.entityLabel,
        successRate: m.successRate,
        sampleCount: m.sampleCount,
      }));

    const atRiskEntities = [...categoryModels]
      .filter((m) => m.successRate < 0.6 && m.sampleCount >= 2)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5)
      .map((m) => ({
        entityId: m.entityId,
        entityLabel: m.entityLabel,
        successRate: m.successRate,
        sampleCount: m.sampleCount,
      }));

    return {
      reportId: `report_${category}_${Date.now().toString(36)}`,
      category,
      title: `${LEARNING_CATEGORY_LABELS[category]} Report`,
      generatedAt: new Date().toISOString(),
      period: { start, end },
      totalEvents: total,
      successRate,
      avgCostUsd,
      avgLatencyMs,
      avgQuality,
      topEntities,
      atRiskEntities,
      summary: this.summary(
        category,
        total,
        successRate,
        avgCostUsd,
        avgQuality,
        categoryModels.length,
      ),
    };
  }

  /** Reports for every category with at least one event. */
  generateAll(events: LearningEvent[], models: LearningModel[]): LearningReport[] {
    const categories = new Set<LearningCategory>(events.map((e) => e.category));
    const reports: LearningReport[] = [];
    for (const category of categories) {
      reports.push(this.generateReport(category, events, models));
    }
    return reports.sort((a, b) => b.totalEvents - a.totalEvents);
  }

  private summary(
    category: LearningCategory,
    total: number,
    successRate: number,
    avgCostUsd: number,
    avgQuality: number,
    modelCount: number,
  ): string {
    if (total === 0)
      return `No learning events observed for ${LEARNING_CATEGORY_LABELS[category]}.`;
    const health = successRate >= 0.8 ? 'healthy' : successRate >= 0.6 ? 'acceptable' : 'at risk';
    return `${LEARNING_CATEGORY_LABELS[category]} is ${health}: ${total} run(s), ${formatPct(successRate)} success, avg quality ${formatPct(avgQuality)}, avg cost $${avgCostUsd.toFixed(4)}, across ${modelCount} tracked entit${modelCount === 1 ? 'y' : 'ies'}.`;
  }
}
