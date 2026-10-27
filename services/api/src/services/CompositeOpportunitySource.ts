// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · Composite Opportunity Source
//
// Aggregates multiple ExternalOpportunitySourcePort adapters (e.g. Freelancer,
// GitHub Bounties, etc.) into ONE unified ExternalOpportunitySourcePort stream
// for OpportunityMonitoring.
// ─────────────────────────────────────────────────────────────────────────────

import type { RawExternalOpportunity } from './OpportunitySourceAdapter.js';
import type {
  ExternalCandidatesResult,
  ExternalOpportunitySourcePort,
} from '../infrastructure/OpportunityMonitoringPorts.js';

export class CompositeOpportunitySource implements ExternalOpportunitySourcePort {
  readonly name: string;
  private readonly sources: readonly ExternalOpportunitySourcePort[];

  constructor(sources: readonly ExternalOpportunitySourcePort[], customName = 'composite') {
    this.sources = sources;
    this.name = customName;
  }

  get status(): { configured: boolean; reason: string } {
    const configuredCount = this.sources.filter((s) => s.status.configured).length;
    return {
      configured: configuredCount > 0,
      reason: `${String(configuredCount)}/${String(this.sources.length)} active opportunity sources configured`,
    };
  }

  async fetchCandidates(): Promise<ExternalCandidatesResult> {
    const allCandidates: RawExternalOpportunity[] = [];
    const failures: string[] = [];

    await Promise.all(
      this.sources.map(async (source) => {
        try {
          const res = await source.fetchCandidates();
          if (res.success) {
            allCandidates.push(...res.candidates);
          } else {
            failures.push(`${source.name}: ${res.code} - ${res.message}`);
          }
        } catch (err: unknown) {
          failures.push(`${source.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }),
    );

    if (
      allCandidates.length === 0 &&
      failures.length === this.sources.length &&
      this.sources.length > 0
    ) {
      return {
        success: false,
        code: 'SOURCE_UNAVAILABLE',
        message: `All sources failed: ${failures.join('; ')}`,
      };
    }

    return {
      success: true,
      candidates: allCandidates,
    };
  }
}
