// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Planner
// EPIC-013 — the orchestrating engine:
//   OUTCOME → DECOMPOSE → MATCH CANDIDATES → CLASSIFY →
//   QUALITY-FIRST SELECT → ASSEMBLE PLAN (evidence, risks, approval).
// Consumes existing intelligence through CapabilitySourcePort — it
// never duplicates provider intelligence or AI World discovery.
// Untrusted discovered content is never auto-integrated.
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityCandidate,
  CapabilityEvidence,
  CapabilityId,
  CapabilityPlanRequest,
  FactoryCapabilityPlan,
  PlanStep,
} from '../types/capability-types.js';
import type { CapabilitySourcePort } from '../contracts/CapabilitySourcePort.js';
import { CapabilityDecomposer } from './CapabilityDecomposer.js';
import { IntegrationClassifier } from './IntegrationClassifier.js';
import { AutomationBoundaryEngine } from './AutomationBoundaryEngine.js';
import { QualityFirstSelector } from './QualityFirstSelector.js';
import { ApprovalEngine } from './ApprovalEngine.js';

export interface PlannerOptions {
  source: CapabilitySourcePort;
  userModules?: string[];
  now?: () => Date;
}

export class CapabilityPlanner {
  private readonly decomposer: CapabilityDecomposer;
  private readonly integration: IntegrationClassifier;
  private readonly automation: AutomationBoundaryEngine;
  private readonly selector: QualityFirstSelector;
  private readonly approval: ApprovalEngine;
  private readonly source: CapabilitySourcePort;
  private readonly now: () => Date;

  constructor(options: PlannerOptions) {
    this.source = options.source;
    this.now = options.now ?? ((): Date => new Date());
    this.decomposer = new CapabilityDecomposer();
    this.integration = new IntegrationClassifier();
    this.automation = new AutomationBoundaryEngine();
    this.selector = new QualityFirstSelector();
    this.approval = new ApprovalEngine();
  }

  async plan(request: CapabilityPlanRequest): Promise<FactoryCapabilityPlan> {
    const decomposition = this.decomposer.decompose(request.outcome);
    const allCandidates: CapabilityCandidate[] = [];
    const steps: PlanStep[] = [];

    for (const stepTemplate of decomposition.steps) {
      const candidates = await this.candidatesFor(stepTemplate.capability);
      // Quality-first ranking.
      const { selected, ranked } = this.selector.select(candidates);
      const approval = this.approval.decide(stepTemplate.title, stepTemplate.purpose);
      const { automation: stepAutomation, reasons: automationReasons } = this.automation.assess(
        ranked,
        approval.irreversible,
      );

      for (const candidate of ranked) {
        if (!allCandidates.some((c) => c.id === candidate.id)) {
          allCandidates.push(candidate);
        }
      }

      steps.push({
        id: stepTemplate.id,
        title: stepTemplate.title,
        capability: stepTemplate.capability,
        purpose: stepTemplate.purpose,
        candidates: ranked.slice(0, 3),
        selectedCandidateId: selected?.id,
        automation: stepAutomation,
        irreversible: approval.irreversible,
        reasons: [
          ...automationReasons,
          ...(selected
            ? this.selectionReasons(selected, ranked)
            : ['No eligible candidate — step is manual.']),
        ],
      });
    }

    const { automation: planAutomation, percent } = this.automation.overall(steps);
    const humanApprovalPoints = steps.filter((s) => s.irreversible);
    const unavailableCapabilities = decomposition.requiredCapabilities.filter(
      (cap) =>
        !steps.some((s) => {
          if (s.capability !== cap || !s.selectedCandidateId) return false;
          const selected = s.candidates.find((c) => c.id === s.selectedCandidateId);
          // A manual-fallback selection means the capability is NOT actually
          // available — it must be reported as unavailable, never hidden.
          return selected !== undefined && selected.kind !== 'manual';
        }),
    );

    const evidence = this.collectEvidence(allCandidates);
    const risks = this.collectRisks(steps, unavailableCapabilities);
    const estimatedCostUsd = this.estimateCost(steps);
    const estimatedTimeMinutes = this.estimateTime(steps);

    const id = hashPlanId(`${request.outcome}|${this.now().toISOString()}`);

    return {
      id,
      requestedOutcome: request.outcome,
      createdAt: this.now().toISOString(),
      requiredCapabilities: decomposition.requiredCapabilities,
      candidates: allCandidates,
      steps,
      automationLevel: planAutomation,
      automationPercent: percent,
      estimatedCostUsd,
      estimatedTimeMinutes,
      evidence,
      risks,
      humanApprovalPoints,
      unavailableCapabilities,
      recommendations: this.buildRecommendations(steps),
    };
  }

  /** Find + classify candidates for one capability from all sources. */
  private async candidatesFor(capability: CapabilityId): Promise<CapabilityCandidate[]> {
    const candidates: CapabilityCandidate[] = [];

    // 1. Configured providers (existing provider intelligence).
    const providers = await this.source.providerCandidates(capability);
    for (const provider of providers) {
      const classification = this.integration.classifyProvider(provider);
      candidates.push({
        id: `provider:${provider.providerId}${provider.modelId ? `:${provider.modelId}` : ''}`,
        kind: provider.modelId ? 'model' : 'provider',
        name: provider.modelName ? `${provider.name} · ${provider.modelName}` : provider.name,
        providerFamily: provider.family,
        modelId: provider.modelId,
        capability,
        integrationType: classification.integrationType,
        classification: classification.classification,
        freeAvailability: provider.costTier === 'free' ? 'FREE' : 'UNKNOWN',
        localAvailability:
          provider.family === 'ollama' || provider.family === 'lm-studio' ? 'yes' : 'no',
        quality: provider.quality,
        availability: provider.availability,
        estimatedCostUsd: provider.estimatedCostUsd,
        evidence: provider.evidence,
        reasons: classification.reasons,
        configurable: !provider.configured,
        suggestedFamily: provider.family,
        apiAvailable: classification.apiAvailable,
      });
    }

    // 2. Local models (existing local-model discovery, honest inference).
    const locals = await this.source.localModelCandidates(capability);
    for (const local of locals) {
      const classification = this.integration.classifyLocalModel(local);
      candidates.push({
        id: `local:${local.id}`,
        kind: 'local-model',
        name: local.name,
        providerFamily: local.runtime,
        modelId: local.id,
        capability,
        integrationType: classification.integrationType,
        classification: classification.classification,
        freeAvailability: 'FREE',
        localAvailability: 'yes',
        quality: undefined,
        evidence: local.evidence,
        reasons: classification.reasons,
        configurable: !local.available,
        apiAvailable: classification.apiAvailable,
      });
    }

    // 3. AI World discoveries (untrusted input, evidence-first).
    const discoveries = await this.source.discoveryCandidates(capability);
    for (const discovery of discoveries) {
      const classification = this.integration.classifyDiscovery(discovery);
      candidates.push({
        id: `discovery:${discovery.itemId}`,
        kind: discovery.category === 'github' ? 'github' : 'application',
        name: discovery.title,
        providerFamily: discovery.suggestedFamily,
        capability,
        integrationType: classification.integrationType,
        classification: classification.classification,
        freeAvailability:
          discovery.freeClass === 'FREE_API'
            ? 'FREE'
            : discovery.freeClass === 'FREE_WITH_QUOTA'
              ? 'FREE_WITH_QUOTA'
              : 'UNKNOWN',
        localAvailability: discovery.localAvailability,
        quality: undefined,
        evidence: discovery.evidence,
        reasons: classification.reasons,
        configurable: discovery.configurable,
        suggestedFamily: discovery.suggestedFamily,
        apiAvailable: classification.apiAvailable,
        externalNote:
          classification.integrationType === 'EXTERNAL_APPLICATION'
            ? 'External application required — no API is assumed. Check whether automation is possible before relying on it.'
            : undefined,
      });
    }

    // 4. No candidates at all → honest manual step.
    if (candidates.length === 0) {
      const manual = this.integration.manual();
      candidates.push({
        id: `manual:${capability}`,
        kind: 'manual',
        name: 'Manual action',
        capability,
        integrationType: manual.integrationType,
        classification: manual.classification,
        freeAvailability: 'UNKNOWN',
        localAvailability: 'no',
        quality: undefined,
        evidence: [],
        reasons: manual.reasons,
        configurable: false,
        apiAvailable: 'no',
        externalNote: 'A human must perform this step — no tool can automate it yet.',
      });
    }

    return candidates;
  }

  /** Why the top-ranked candidate won (user-friendly). */
  private selectionReasons(selected: CapabilityCandidate, ranked: CapabilityCandidate[]): string[] {
    const reasons: string[] = [`${selected.name} is the best candidate for this step.`];
    if (ranked.length > 1) {
      const runnerUp = ranked[1];
      if (runnerUp) {
        const selectedQuality = selected.quality ?? 0;
        const runnerQuality = runnerUp.quality ?? 0;
        if (selectedQuality > runnerQuality) {
          reasons.push(`Chosen over ${runnerUp.name} for higher evidence-backed quality.`);
        } else if (selected.freeAvailability === 'FREE' && runnerUp.freeAvailability !== 'FREE') {
          reasons.push(`Chosen over ${runnerUp.name} as a free/local option at equal quality.`);
        } else if (
          (selected.estimatedCostUsd ?? Infinity) < (runnerUp.estimatedCostUsd ?? Infinity)
        ) {
          reasons.push(`Chosen over ${runnerUp.name} for lower cost at equal quality.`);
        }
      }
    }
    return reasons;
  }

  private collectEvidence(candidates: CapabilityCandidate[]): CapabilityEvidence[] {
    const seen = new Set<string>();
    const evidence: CapabilityEvidence[] = [];
    for (const candidate of candidates) {
      for (const e of candidate.evidence) {
        const key = `${candidate.id}|${e.claim}`;
        if (!seen.has(key)) {
          seen.add(key);
          evidence.push(e);
        }
      }
    }
    return evidence.slice(0, 40);
  }

  private collectRisks(steps: PlanStep[], unavailable: CapabilityId[]): string[] {
    const risks: string[] = [];
    if (unavailable.length > 0) {
      risks.push(
        `Capabilities with no available candidate: ${unavailable.join(', ')} — these steps need manual work or a new tool.`,
      );
    }
    const external = steps.filter((s) =>
      s.candidates.some((c) => c.integrationType === 'EXTERNAL_APPLICATION'),
    );
    if (external.length > 0) {
      risks.push(
        'External applications are required for some steps — automation depends on APIs that are not assumed to exist.',
      );
    }
    const approvals = steps.filter((s) => s.irreversible);
    if (approvals.length > 0) {
      risks.push(
        `Irreversible actions require approval: ${approvals.map((s) => s.title).join(', ')}.`,
      );
    }
    return risks;
  }

  private estimateCost(steps: PlanStep[]): number | undefined {
    // Only the SELECTED candidate per step counts — the estimate is the cost
    // of the plan, never the sum of every option considered.
    const selected = steps
      .map((s) => s.candidates.find((c) => c.id === s.selectedCandidateId))
      .filter((c): c is CapabilityCandidate => c?.estimatedCostUsd !== undefined);
    if (selected.length === 0) return undefined;
    return selected.reduce((sum, c) => sum + (c.estimatedCostUsd ?? 0), 0);
  }

  private estimateTime(steps: PlanStep[]): number | undefined {
    // Deterministic heuristic: automated steps ≈ 1 min each, manual ≈ 30 min.
    // Only reported as an estimate when evidence exists (at least one
    // candidate has an API).
    const hasAutomation = steps.some((s) => s.automation !== 'MANUAL');
    if (!hasAutomation) return undefined;
    const minutes = steps.reduce(
      (sum, s) =>
        sum + (s.automation === 'MANUAL' ? 30 : s.automation === 'HUMAN_APPROVAL' ? 15 : 1),
      0,
    );
    return minutes;
  }

  private buildRecommendations(steps: PlanStep[]): FactoryCapabilityPlan['recommendations'] {
    const recommendations: FactoryCapabilityPlan['recommendations'] = [];
    for (const step of steps) {
      const configurable = step.candidates.find((c) => c.configurable && c.suggestedFamily);
      if (configurable?.suggestedFamily) {
        recommendations.push({
          capability: step.capability,
          action: 'CONFIGURE_PROVIDER',
          label: `Configure ${configurable.suggestedFamily} to automate "${step.title}"`,
          suggestedFamily: configurable.suggestedFamily,
        });
        continue;
      }
      const evaluate = step.candidates.find((c) => c.classification === 'EVALUATE');
      if (evaluate) {
        recommendations.push({
          capability: step.capability,
          action: 'EVALUATE_LOCAL_MODEL',
          label: `Evaluate "${evaluate.name}" for "${step.title}"`,
        });
        continue;
      }
      const external = step.candidates.find((c) => c.classification === 'EXTERNAL');
      if (external) {
        recommendations.push({
          capability: step.capability,
          action: 'REVIEW_EXTERNAL_TOOL',
          label: `Review external tool "${external.name}" for "${step.title}"`,
        });
      }
    }
    return recommendations.slice(0, 6);
  }
}

/**
 * Deterministic portable plan id — 16 hex chars ≈ 64 bits of a pure-JS
 * djb2-style double hash (two 32-bit passes with different seeds). NO Node
 * builtins, so the package stays bundle-safe for client-side imports (the
 * capability-marketplace index re-exports this planner; a `node:crypto`
 * dependency would break webpack client bundles with UnhandledSchemeError).
 */
function hashPlanId(seed: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + code) >>> 0;
    h2 = ((h2 << 5) + h2 + code) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
