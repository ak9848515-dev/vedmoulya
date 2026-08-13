// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Domain Service: Capability Matrix
// Aggregates the per-capability view of every provider: quality, cost,
// latency, tokens, confidence, historical success. Powers capability
// discovery without any routing decisions (routing is a later sprint).
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { Provider } from '../entities/Provider.js';
import type { ProviderCapabilityMatrixEntry } from '../entities/Provider.js';

export interface CapabilityRanking {
  capability: CapabilityType;
  providerId: string;
  providerName: string;
  quality: number;
  expectedCostUsd: number;
  expectedLatencyMs: number;
  expectedInputTokens: number;
  expectedOutputTokens: number;
  confidence: number;
  historicalSuccess: number;
  qualityTier: ProviderCapabilityMatrixEntry['qualityTier'];
}

export interface CapabilityMatrixView {
  /** One capability row with every provider ranked by quality. */
  rows: Array<{
    capability: CapabilityType;
    rankings: CapabilityRanking[];
    /** Best provider for this capability (by quality, then confidence). */
    bestProviderId: string | null;
    /** Number of providers supporting the capability. */
    providerCount: number;
  }>;
}

export interface ProviderMatrixSummary {
  providerId: string;
  capabilityCount: number;
  averageQuality: number;
  averageConfidence: number;
  averageHistoricalSuccess: number;
  averageCostUsd: number;
  averageLatencyMs: number;
}

export class ProviderCapabilityMatrixService {
  /**
   * Build the capability matrix view for a set of providers: one row per
   * capability with providers ranked by quality (then confidence, then
   * lower cost). No selection is made — ranking is informational only.
   */
  buildMatrixView(providers: readonly Provider[]): CapabilityMatrixView {
    const byCapability = new Map<CapabilityType, CapabilityRanking[]>();
    for (const provider of providers) {
      for (const entry of provider.matrix) {
        const list = byCapability.get(entry.capability) ?? [];
        list.push({
          capability: entry.capability,
          providerId: provider.id,
          providerName: provider.name,
          quality: entry.quality,
          expectedCostUsd: entry.expectedCostUsd,
          expectedLatencyMs: entry.expectedLatencyMs,
          expectedInputTokens: entry.expectedInputTokens,
          expectedOutputTokens: entry.expectedOutputTokens,
          confidence: entry.confidence,
          historicalSuccess: entry.historicalSuccess,
          qualityTier: entry.qualityTier,
        });
        byCapability.set(entry.capability, list);
      }
    }

    const rows = [...byCapability.entries()]
      .map(([capability, rankings]) => {
        const sorted = [...rankings].sort(
          (a, b) =>
            b.quality - a.quality ||
            b.confidence - a.confidence ||
            a.expectedCostUsd - b.expectedCostUsd,
        );
        return {
          capability,
          rankings: sorted,
          bestProviderId: sorted[0]?.providerId ?? null,
          providerCount: sorted.length,
        };
      })
      .sort((a, b) => a.capability.localeCompare(b.capability));

    return { rows };
  }

  /** Summarize one provider's matrix (averages across capabilities). */
  summarize(provider: Provider): ProviderMatrixSummary {
    const entries = provider.matrix;
    const count = entries.length;
    if (count === 0) {
      return {
        providerId: provider.id,
        capabilityCount: 0,
        averageQuality: 0,
        averageConfidence: 0,
        averageHistoricalSuccess: 0,
        averageCostUsd: 0,
        averageLatencyMs: 0,
      };
    }
    return {
      providerId: provider.id,
      capabilityCount: count,
      averageQuality: entries.reduce((s, e) => s + e.quality, 0) / count,
      averageConfidence: entries.reduce((s, e) => s + e.confidence, 0) / count,
      averageHistoricalSuccess: entries.reduce((s, e) => s + e.historicalSuccess, 0) / count,
      averageCostUsd: entries.reduce((s, e) => s + e.expectedCostUsd, 0) / count,
      averageLatencyMs: entries.reduce((s, e) => s + e.expectedLatencyMs, 0) / count,
    };
  }

  /** Providers supporting a capability, ranked by quality (discovery only). */
  findProvidersForCapability(
    providers: readonly Provider[],
    capability: CapabilityType,
  ): CapabilityRanking[] {
    const view = this.buildMatrixView(providers);
    const row = view.rows.find((r) => r.capability === capability);
    return row?.rankings ?? [];
  }
}
