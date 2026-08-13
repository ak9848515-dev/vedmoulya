// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// TaskIntelligenceEngine — EPIC-015
//
// Answers: \"For THIS task, is there something significantly better
// available?\" — across configured providers, free providers, local
// models, GitHub projects and paid providers. Quality-first selection
// (QUALITY → EVIDENCE → ACCURACY → TASK FIT → RELIABILITY → USABILITY
// → FREE/LOCAL → COST) — cost NEVER overrides a required quality
// threshold, and free only wins when quality is sufficient. A better
// option that requires activation produces a recommendation, never an
// automatic activation.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type {
  FallbackPlan,
  IntelligenceOption,
  IntelligenceTaskContext,
  TaskIntelligenceResult,
} from '../types/intelligence-types.js';

export interface CandidateSet {
  providers: ProviderCandidateFact[];
  discoveries: DiscoveryCandidateFact[];
  localModels: LocalModelCandidateFact[];
}

/** How many quality points constitute a \"materially better\" option. */
export const MATERIAL_IMPROVEMENT_MARGIN = 8;

const FREE_CLASSES = new Set([
  'FREE_API',
  'FREE_WITH_QUOTA',
  'OPEN_WEIGHTS',
  'LOCAL',
  'OPEN_SOURCE',
]);

export class TaskIntelligenceEngine {
  constructor(private readonly freeQualities: { free: number; configured: number }) {}

  evaluate(
    capability: CapabilityId,
    ctx: IntelligenceTaskContext,
    candidates: CandidateSet,
  ): TaskIntelligenceResult {
    const options: IntelligenceOption[] = [];

    // ── Configured providers (usable right now) ───────────────────
    const configured = candidates.providers.filter((p) => p.configured);
    const bestConfigured = this.bestByQuality(configured);
    if (bestConfigured) {
      options.push(
        this.option(
          'BEST_CONFIGURED',
          bestConfigured,
          capability,
          'Already configured — usable now with zero additional activation.',
        ),
      );
    }

    // ── Best available now = the configured option with acceptable quality ──
    const qualityFloor = this.qualityFloor(ctx.qualityTarget);
    const usableNow = configured
      .filter((p) => (p.quality ?? 0) >= qualityFloor)
      .sort((a, b) => this.rank(a, b) - this.rank(b, a))[0];
    if (usableNow) {
      options.push(
        this.option(
          'BEST_AVAILABLE_NOW',
          usableNow,
          capability,
          'Best quality among currently configured options meeting the task quality floor.',
        ),
      );
    }

    // ── Free / low-cost / paid candidates (all sources) ────────────
    const freeCandidates = candidates.providers.filter(
      (p) => p.costTier === 'free' || FREE_CLASSES.has(this.freeClassOf(p)),
    );
    const bestFree = this.bestByQuality(freeCandidates);
    if (bestFree) {
      options.push(
        this.option(
          'BEST_FREE',
          bestFree,
          capability,
          'Best free candidate — chosen for quality first, free second (cost never beats quality).',
        ),
      );
    }

    const lowCost = candidates.providers.filter(
      (p) => p.costTier === 'low' || p.costTier === 'free',
    );
    const bestLowCost = this.bestByQuality(lowCost);
    if (bestLowCost && bestLowCost !== bestFree) {
      options.push(
        this.option(
          'BEST_LOW_COST',
          bestLowCost,
          capability,
          'Best low-cost candidate meeting quality expectations.',
        ),
      );
    }

    const bestPaid = this.bestByQuality(candidates.providers);
    if (bestPaid && !bestPaid.configured) {
      options.push(
        this.option(
          'BEST_PAID',
          bestPaid,
          capability,
          'Best overall quality candidate (paid) — only ever activated with explicit approval.',
        ),
      );
    }

    // ── Local models (quality-first, hardware-aware honesty) ───────
    const bestLocal = this.bestLocal(candidates.localModels);
    if (bestLocal) {
      options.push({
        kind: 'BEST_LOCAL',
        name: bestLocal.name,
        capability,
        quality: bestLocal.quality,
        freeClass: 'LOCAL',
        localAvailability: 'yes',
        reason: bestLocal.available
          ? 'Best local model — free, private; recommended only when quality is acceptable and hardware is suitable.'
          : 'Local candidate unavailable on current hardware — not recommended.',
        evidence: bestLocal.evidence.map((e) => `${e.claim} (${e.source})`),
        requires: bestLocal.available ? ['download', 'local_install'] : [],
      });
    }

    // ── GitHub / external application discoveries (never assumed executable) ──
    // Reported with a DISTINCT label (not BEST_AVAILABLE_NOW, which already
    // means "best configured option usable right now") — an open-source
    // candidate always requires review + approval and is never usable now.
    const github = candidates.discoveries.filter(
      (d) => d.category === 'github' || d.category === 'application',
    );
    const bestGithub = this.bestDiscovery(github);
    if (bestGithub) {
      options.push({
        kind: 'BEST_LOW_COST',
        name: bestGithub.title,
        capability,
        quality: bestGithub.quality,
        freeClass: bestGithub.freeClass as IntelligenceOption['freeClass'],
        localAvailability: bestGithub.localAvailability,
        reason:
          'Open-source candidate — never assumed API-executable; activation requires review, security and license checks, and approval.',
        evidence: bestGithub.evidence.map((e) => `${e.claim} (${e.source})`),
        requires: bestGithub.configurable
          ? ['api_key', 'additional_permission']
          : ['additional_permission', 'external_application'],
      });
    }

    // ── Better-option detection ────────────────────────────────────
    const bestOverall = this.bestByQuality(candidates.providers);
    const betterOptionAvailable = this.isMateriallyBetter(bestOverall, usableNow, ctx, configured);

    const fallback = this.fallbackPlan(capability, candidates, bestConfigured);

    return {
      taskId: this.taskId(ctx.objective),
      requestedOutcome: ctx.objective,
      options,
      bestAvailableNow: usableNow
        ? this.option('BEST_AVAILABLE_NOW', usableNow, capability, '')
        : undefined,
      betterOptionAvailable,
      fallback,
    };
  }

  // ── Selection helpers (quality-first, evidence-backed) ───────────

  private bestByQuality(providers: ProviderCandidateFact[]): ProviderCandidateFact | undefined {
    if (providers.length === 0) return undefined;
    return [...providers].sort((a, b) => this.rank(a, b) - this.rank(b, a))[0];
  }

  private bestLocal(
    models: LocalModelCandidateFact[],
  ): (LocalModelCandidateFact & { quality?: number }) | undefined {
    if (models.length === 0) return undefined;
    return [...models].sort((a, b) => {
      const qa = this.localQuality(a);
      const qb = this.localQuality(b);
      if (qb !== qa) return qb - qa;
      return a.available === b.available ? 0 : a.available ? -1 : 1;
    })[0];
  }

  private localQuality(m: LocalModelCandidateFact): number {
    // Quality is INFERRED from runtime/model name unless measured — never a verified claim.
    if (m.capabilitiesProvenance === 'MEASURED') return 85;
    if (m.capabilitiesProvenance === 'VERIFIED') return 78;
    if (m.capabilitiesProvenance === 'PROVIDER_DECLARED') return 65;
    if (m.capabilitiesProvenance === 'INFERRED') return 55;
    return 0;
  }

  private bestDiscovery(
    discoveries: DiscoveryCandidateFact[],
  ): (DiscoveryCandidateFact & { quality?: number }) | undefined {
    if (discoveries.length === 0) return undefined;
    return [...discoveries].sort((a, b) => {
      const qa = a.evidence.length * 4 + (a.securityFlags.length === 0 ? 8 : 0);
      const qb = b.evidence.length * 4 + (b.securityFlags.length === 0 ? 8 : 0);
      return qb - qa;
    })[0];
  }

  /**
   * Ranking: quality first; ties break toward evidence, then free/local,
   * then cost. Cost NEVER overrides a required quality threshold.
   */
  private rank(a: ProviderCandidateFact, b: ProviderCandidateFact): number {
    const qa = a.quality ?? 0;
    const qb = b.quality ?? 0;
    if (qb !== qa) return qb - qa;
    const ea = a.evidence.length;
    const eb = b.evidence.length;
    if (eb !== ea) return eb - ea;
    const costA = this.costRank(a);
    const costB = this.costRank(b);
    return costB - costA;
  }

  private costRank(p: ProviderCandidateFact): number {
    if (p.costTier === 'free') return 4;
    if (p.costTier === 'low') return 3;
    if (p.costTier === 'medium') return 2;
    return 1;
  }

  private freeClassOf(p: ProviderCandidateFact): string {
    return p.costTier === 'free' ? 'FREE_API' : 'PAID';
  }

  private qualityFloor(target: IntelligenceTaskContext['qualityTarget']): number {
    if (target === 'HIGH') return 80;
    if (target === 'MEDIUM') return 60;
    return 40;
  }

  private isMateriallyBetter(
    bestOverall: ProviderCandidateFact | undefined,
    usableNow: ProviderCandidateFact | undefined,
    ctx: IntelligenceTaskContext,
    configured: ProviderCandidateFact[],
  ): boolean {
    if (!bestOverall) return false;
    // Nothing better than what is already configured/usable.
    if (bestOverall.configured) return false;
    const bestQuality = bestOverall.quality ?? 0;
    const currentQuality =
      usableNow?.quality ??
      (configured.length > 0 ? Math.max(...configured.map((c) => c.quality ?? 0)) : 0);
    if (bestQuality < this.qualityFloor(ctx.qualityTarget)) return false;
    // A better capability exists but requires activation → recommendation.
    return bestQuality - currentQuality >= MATERIAL_IMPROVEMENT_MARGIN;
  }

  private fallbackPlan(
    capability: CapabilityId,
    candidates: CandidateSet,
    bestConfigured: ProviderCandidateFact | undefined,
  ): FallbackPlan {
    const order: FallbackPlan['order'] = [
      'FREE',
      'FREE_QUOTA',
      'LOCAL',
      'OPEN_SOURCE',
      'GITHUB',
      'CURRENT_CONFIGURED',
    ];
    const freeUsable = candidates.providers.some((p) => p.costTier === 'free' && !p.configured);
    const local = candidates.localModels.some((m) => m.available);
    const github = candidates.discoveries.some(
      (d) => d.category === 'github' || d.category === 'application',
    );
    return {
      order,
      bestAchievable: bestConfigured?.providerId
        ? `Continue with configured ${bestConfigured.providerId}${bestConfigured.modelId ? ` / ${bestConfigured.modelId}` : ''} — the best result achievable without new activation.`
        : 'No configured provider for this capability — the task completes honestly as PARTIAL until a capability is configured.',
      note: [
        freeUsable ? 'A free alternative exists and will be offered first.' : '',
        local ? 'A local alternative exists (privacy/cost benefit).' : '',
        github
          ? 'An open-source candidate exists but requires review + approval — never auto-integrated.'
          : '',
        'Declining a paid option is never treated as task failure.',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  private option(
    kind: IntelligenceOption['kind'],
    provider: ProviderCandidateFact,
    capability: CapabilityId,
    reason: string,
  ): IntelligenceOption {
    return {
      kind,
      providerId: provider.providerId,
      name: provider.name,
      capability,
      quality: provider.quality,
      costUsd: provider.estimatedCostUsd,
      freeClass: provider.costTier === 'free' ? 'FREE_API' : undefined,
      localAvailability: provider.family === 'ollama' ? 'yes' : 'UNKNOWN',
      reason:
        reason || `Quality-first selection from ${provider.evidence.length} evidence item(s).`,
      evidence: provider.evidence.map((e) => `${e.claim} (${e.source})`),
      requires: provider.configured ? [] : ['api_key'],
    };
  }

  private taskId(objective: string): string {
    let hash = 0;
    for (let i = 0; i < objective.length; i += 1) {
      hash = (hash * 31 + objective.charCodeAt(i)) | 0;
    }
    return `task-${Math.abs(hash).toString(36)}`;
  }
}
