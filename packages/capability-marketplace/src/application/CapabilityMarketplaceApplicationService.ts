// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityMarketplaceApplicationService
// EPIC-013 — the capability.* contract implementation.
//
// plan()      — outcome → FactoryCapabilityPlan (deterministic core +
//               optional AI enrichment seam, non-fatal).
// getPlan()   — owner-scoped read (IDOR refused for foreign owners).
// listPlans() — owner-scoped plan history (bounded).
// capabilities() — the capability marketplace view model.
//
// The service performs NO AI directly — the optional enrichment seam
// flows through the frozen AI runtime adapter the gateway provides.
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityMarketplaceView,
  CapabilityPlanRequest,
  CapabilityPlanSummary,
  CapabilityId,
  FactoryCapabilityPlan,
} from '../types/capability-types.js';
import { CAPABILITY_IDS, CAPABILITY_LABELS } from '../types/capability-types.js';
import type {
  CapabilityEnrichmentPort,
  CapabilitySourcePort,
} from '../contracts/CapabilitySourcePort.js';
import type { CapabilityPlanStore } from '../domain/CapabilityPlanStore.js';
import { CapabilityPlanner } from '../domain/CapabilityPlanner.js';

export interface CapabilityMarketplaceServiceOptions {
  source: CapabilitySourcePort;
  store: CapabilityPlanStore;
  /** Optional non-fatal AI enrichment (over the frozen runtime). */
  enrichment?: CapabilityEnrichmentPort;
  now?: () => Date;
}

export class CapabilityMarketplaceApplicationService {
  private readonly planner: CapabilityPlanner;
  private readonly store: CapabilityPlanStore;
  private readonly source: CapabilitySourcePort;
  private readonly enrichment?: CapabilityEnrichmentPort;
  private readonly now: () => Date;

  constructor(options: CapabilityMarketplaceServiceOptions) {
    this.store = options.store;
    this.source = options.source;
    this.enrichment = options.enrichment;
    this.now = options.now ?? ((): Date => new Date());
    this.planner = new CapabilityPlanner({
      source: options.source,
      now: this.now,
    });
  }

  /**
   * Create a plan from a requested outcome. Owner-scoped save.
   *
   * The deterministic plan is built first and is always authoritative. When
   * an enrichment port is available (configured AI provider), a bounded,
   * NON-FATAL enrichment call adds an advisory aiInsight overlay — summary +
   * AI-suggested steps/capabilities. Enrichment failure or a low-confidence
   * result never affects the deterministic plan.
   */
  async plan(ownerId: string, request: CapabilityPlanRequest): Promise<FactoryCapabilityPlan> {
    const plan = await this.planner.plan(request);
    if (this.enrichment) {
      try {
        const insight = await this.enrichment.enrich({ outcome: request.outcome });
        if (insight.confident) {
          plan.aiInsight = {
            summary: insight.summary,
            suggestedCapabilities: insight.suggestedCapabilities,
            suggestedSteps: insight.suggestedSteps,
            provider: insight.provider,
            model: insight.model,
            confident: true,
          };
        }
      } catch {
        // Non-fatal: the deterministic plan stands; no insight is attached.
      }
    }
    await this.store.save(ownerId, plan);
    return plan;
  }

  /** Owner-scoped read — foreign plan ids resolve to undefined (IDOR). */
  async getPlan(ownerId: string, planId: string): Promise<FactoryCapabilityPlan | undefined> {
    return this.store.get(ownerId, planId);
  }

  /** Owner-scoped plan history. */
  async listPlans(ownerId: string): Promise<CapabilityPlanSummary[]> {
    return this.store.list(ownerId);
  }

  /** The capability marketplace view model (which capabilities are ready). */
  async capabilities(_ownerId: string): Promise<CapabilityMarketplaceView> {
    const ready = new Set<CapabilityId>();
    const configurable = new Set<CapabilityId>();
    const bestCandidate = new Map<CapabilityId, string>();

    // Fresh evaluation: check each capability through the source port.
    for (const capability of CAPABILITY_IDS) {
      const providers = await this.sourceCandidates(capability);
      const best = providers[0];
      if (best?.classification === 'READY') {
        ready.add(capability);
        bestCandidate.set(capability, best.name);
      } else if (best?.classification === 'CONFIGURE') {
        configurable.add(capability);
        bestCandidate.set(capability, best.name);
      }
    }

    return {
      generatedAt: this.now().toISOString(),
      capabilities: CAPABILITY_IDS.map((id) => ({
        id,
        label: CAPABILITY_LABELS[id],
        ready: ready.has(id),
        configurable: configurable.has(id),
        bestCandidate: bestCandidate.get(id),
      })),
    };
  }

  private async sourceCandidates(
    capability: CapabilityId,
  ): Promise<Array<{ classification: string; name: string }>> {
    const [providers, locals] = await Promise.all([
      this.source.providerCandidates(capability),
      this.source.localModelCandidates(capability),
    ]);
    return [
      ...providers.map((p) => ({
        classification: p.configured ? 'READY' : 'CONFIGURE',
        name: p.name,
      })),
      ...locals.map((l) => ({
        classification: l.available ? 'READY' : 'CONFIGURE',
        name: l.name,
      })),
    ];
  }
}
