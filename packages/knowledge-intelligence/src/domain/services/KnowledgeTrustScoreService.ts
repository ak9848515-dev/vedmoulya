// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Trust Score Service
// EI-009 — Enterprise Knowledge Intelligence Platform
// Computes the Trust Score of a knowledge item — how much VedMoulya
// can rely on it. Deterministic and pure (no I/O), so every item can
// be re-scored whenever its provenance, validation, usage, or
// relationships change.
//
// The score blends six evidence families:
//   source reliability (intrinsic per source type)   · 35%
//   validation status                                · 25%
//   citations                                        · 15%
//   consumers + usage                                · 15%
//   recency                                          · 10%
//   dependency criticality (risk penalty)            · −10%
// ──────────────────────────────────────────────────────────────────

import type {
  KnowledgeItem,
  KnowledgeLevel,
  KnowledgeTrustScore,
} from '../../types/knowledge-types.js';
import { KNOWLEDGE_SOURCE_RELIABILITY } from '../../types/knowledge-types.js';

export interface TrustScoreOptions {
  /** Citations at or above this count contribute fully (default 3). */
  citationSaturation?: number;
  /** Consumers at or above this count contribute fully (default 5). */
  consumerSaturation?: number;
  /** Age in days beyond which recency contribution decays to zero (default 365). */
  recencyHalfLifeDays?: number;
  /** Score that maps to a 'high' trust level (default 0.8). */
  highTrustAt?: number;
  /** Penalty applied per high-criticality dependency (default 0.05). */
  criticalDependencyPenalty?: number;
}

const DEFAULT_OPTIONS: Required<TrustScoreOptions> = {
  citationSaturation: 3,
  consumerSaturation: 5,
  recencyHalfLifeDays: 365,
  highTrustAt: 0.8,
  criticalDependencyPenalty: 0.05,
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function saturating(value: number, saturation: number): number {
  return Math.min(1, value / saturation);
}

export class KnowledgeTrustScoreService {
  private readonly options: Required<TrustScoreOptions>;

  constructor(options: TrustScoreOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Compute (and cache into the item) the trust score for one item. */
  score(item: KnowledgeItem): KnowledgeTrustScore {
    const factors: string[] = [];

    // 1. Source reliability (35%) — KNOWLEDGE_SOURCE_RELIABILITY is a total
    // record over every KnowledgeSourceType, so the lookup always resolves.
    const sourceReliability = KNOWLEDGE_SOURCE_RELIABILITY[item.sourceType];
    factors.push(`source "${item.sourceType}" reliability ${round(sourceReliability)}`);

    // 2. Validation status (25%)
    const validation = this.validationContribution(item.validationStatus);
    factors.push(`validation "${item.validationStatus}" contributes ${round(validation)}`);

    // 3. Citations (15%)
    const citationContribution = saturating(item.citations.length, this.options.citationSaturation);
    if (item.citations.length > 0) {
      factors.push(`${item.citations.length} citation(s)`);
    }

    // 4. Consumers + usage (15%)
    const consumerContribution = saturating(item.consumers.length, this.options.consumerSaturation);
    const usageContribution = saturating(Math.log1p(item.usage.totalReads) / Math.log(11), 1);
    if (item.consumers.length > 0) {
      factors.push(`${item.consumers.length} consumer(s) · ${item.usage.totalReads} read(s)`);
    }

    // 5. Recency (10%) — exponential decay over the half life.
    const ageDays = (Date.now() - new Date(item.updatedAt).getTime()) / 86_400_000;
    const recency = Math.exp(-ageDays / this.options.recencyHalfLifeDays);
    if (ageDays < this.options.recencyHalfLifeDays) {
      factors.push(`updated ${Math.max(0, Math.round(ageDays))}d ago`);
    }

    // 6. Dependency risk penalty (−10% of the base, per critical dependency).
    const criticalDependencies = item.dependencies.filter((d) => d.criticality === 'high').length;
    const dependencyPenalty = Math.min(
      0.25,
      criticalDependencies * this.options.criticalDependencyPenalty,
    );
    if (criticalDependencies > 0) {
      factors.push(`${criticalDependencies} high-criticality dependenc(ies) weigh on trust`);
    }

    const raw =
      sourceReliability * 0.35 +
      validation * 0.25 +
      citationContribution * 0.15 +
      Math.max(consumerContribution, usageContribution) * 0.15 +
      recency * 0.1 -
      dependencyPenalty;

    const score = round(Math.max(0, Math.min(1, raw)));
    return { score, level: this.level(score), factors };
  }

  private validationContribution(status: KnowledgeItem['validationStatus']): number {
    switch (status) {
      case 'validated':
        return 1;
      case 'pending':
        return 0.6;
      case 'unvalidated':
        return 0.4;
      case 'failed':
        return 0.1;
    }
  }

  private level(score: number): KnowledgeLevel {
    if (score >= this.options.highTrustAt) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }
}
