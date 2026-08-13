// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryOrchestrator
// EPIC-012C — bounded daily evolution, never an infinite crawler
//
// A discovery run is bounded by explicit budgets (maxItemsPerSource /
// maxItemsPerRun / maxSourcesPerRun / storage cap / refresh interval)
// and respects source/API rate limits (minRefreshIntervalMs cache).
// A failing source NEVER fails the run — it is reported and the rest
// of the run proceeds. Duplicates are skipped. Security-rejected
// items are counted, not stored.
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryBudget,
  DiscoveryItem,
  DiscoveryRunReport,
  DiscoverySourceRunReport,
  RawDiscoveryItem,
} from '../types/discovery-types.js';
import type { AIDiscoverySource } from '../contracts/AIDiscoverySource.js';
import type { DiscoveryStore } from './DiscoveryStore.js';
import { DiscoveryNormalizer } from './DiscoveryNormalizer.js';
import { DiscoveryDeduplicator } from './DiscoveryDeduplicator.js';
import { SecurityScanner } from './SecurityScanner.js';

export interface DiscoveryOrchestratorOptions {
  now?: () => Date;
  vedMoulyaCapabilities?: string[];
}

export class DiscoveryOrchestrator {
  private readonly now: () => Date;
  private readonly normalizer: DiscoveryNormalizer;
  private readonly deduplicator: DiscoveryDeduplicator;
  private readonly security: SecurityScanner;

  constructor(options: DiscoveryOrchestratorOptions = {}) {
    this.now = options.now ?? ((): Date => new Date());
    this.normalizer = new DiscoveryNormalizer(options.vedMoulyaCapabilities);
    this.deduplicator = new DiscoveryDeduplicator();
    this.security = new SecurityScanner();
  }

  /**
   * Run discovery against the given sources. Respects the budget; fails
   * softly per source. Returns a full report with honest counts.
   */
  async run(
    sources: AIDiscoverySource[],
    store: DiscoveryStore,
    budget: DiscoveryBudget,
  ): Promise<DiscoveryRunReport> {
    const ranAt = this.now().toISOString();
    const reports: DiscoverySourceRunReport[] = [];
    let totalAdded = 0;
    const existing = await store.listItems();

    const sourcesToRun = sources.slice(0, budget.maxSourcesPerRun);

    for (const source of sourcesToRun) {
      const report = await this.runSource(source, store, existing, budget);
      reports.push(report);
      totalAdded += report.added;
      if (totalAdded >= budget.maxItemsPerRun) {
        break; // global run budget reached — stop adding
      }
    }

    return { ranAt, sources: reports, totalAdded, budget };
  }

  private async runSource(
    source: AIDiscoverySource,
    store: DiscoveryStore,
    existing: DiscoveryItem[],
    budget: DiscoveryBudget,
  ): Promise<DiscoverySourceRunReport> {
    const started = performance.now();
    const base: DiscoverySourceRunReport = {
      source: source.id,
      attempted: true,
      failed: false,
      rawReceived: 0,
      added: 0,
      duplicatesSkipped: 0,
      securityRejected: 0,
      durationMs: 0,
    };

    let rawItems: RawDiscoveryItem[];
    try {
      const result = await source.discover({
        budget,
        now: this.now,
      });
      // The contract requires items; the type is a non-optional array.
      rawItems = result.items.slice(0, budget.maxItemsPerSource);
    } catch (err) {
      base.failed = true;
      base.error = err instanceof Error ? err.message : 'Unknown source failure';
      base.durationMs = performance.now() - started;
      return base;
    }

    base.rawReceived = rawItems.length;

    const normalized = rawItems.map((raw) =>
      this.normalizer.normalize(raw, { source: source.id, now: this.now }),
    );

    const added: DiscoveryItem[] = [];
    for (const item of normalized) {
      if (
        item.securityFlags.includes('prompt_injection') ||
        item.securityFlags.includes('malicious_link')
      ) {
        base.securityRejected += 1;
        continue; // never store untrusted content
      }
      const dup = this.deduplicator.dedupe(item, [...existing, ...added]);
      if (dup.isDuplicate) {
        base.duplicatesSkipped += 1;
        continue;
      }
      added.push(item);
      if (added.length >= budget.maxItemsPerRun) break;
    }

    if (added.length > 0) {
      base.added = await store.addItems(added);
    }
    base.durationMs = performance.now() - started;
    return base;
  }
}
