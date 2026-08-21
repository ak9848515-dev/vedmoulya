// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Fabric · IntelligenceFabricService
// SPRINT-030 — the ONLY composition seam. Wires the deterministic policies
// (health ledger, cost guard, autonomy gate, selection strategy, verification
// chain, workflow bounds, result normalizer) to the frozen estate through
// narrow ports. Owns NO authority: no Brain, no provider selection, no
// approval, no budget, no execution, no memory/learning, no scheduler, no
// notification engine — every authority stays in the frozen estate.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  AutonomyDecision,
  AutonomyLevel,
  CostPolicyDecision,
  CostPolicyLimits,
  HealthObservation,
  NormalizedProviderResult,
  PrivacyClass,
  ProviderHealth,
  SelectionStrategyKind,
  StrategyCandidate,
  StrategySelection,
  VerificationChainConfig,
  VerificationChainDecision,
  WorkflowBoundsDecision,
  WorkflowLimits,
  WorkflowPlan,
} from '../types/fabric-types.js';
import { ProviderHealthLedger } from '../domain/ProviderHealthLedger.js';
import { CostPolicyGuard } from '../domain/CostPolicyGuard.js';
import { AutonomyPolicy } from '../domain/AutonomyPolicy.js';
import { SelectionStrategy } from '../domain/SelectionStrategy.js';
import { VerificationChainPolicy } from '../domain/VerificationChainPolicy.js';
import { WorkflowBounds } from '../domain/WorkflowBounds.js';
import { normalizeResult, type RawProviderResponse } from '../domain/ResultNormalizer.js';
import type { FabricCostPort, FabricProviderPort } from '../contracts/fabric-ports.js';
import type { ChainEvaluation, VerificationPlan } from '../domain/VerificationChainPolicy.js';

export interface FabricServiceOptions {
  healthLedger?: ProviderHealthLedger;
  costGuard?: CostPolicyGuard;
  autonomy?: AutonomyPolicy;
  strategy?: SelectionStrategy;
  verification?: VerificationChainPolicy;
  workflowBounds?: WorkflowBounds;
  /** EXISTING CostLedger (measures actual spend) — policy-checked, never duplicated. */
  costPort?: FabricCostPort;
  /** EXISTING provider registry — candidate evidence, never invented. */
  providerPort?: FabricProviderPort;
  /** Configurable workflow bounds (env-tunable at the gateway). */
  workflowLimits?: WorkflowLimits;
  /** Configurable cost caps (env-tunable at the gateway). */
  costLimits?: CostPolicyLimits;
  /** Configurable verification chain bounds. */
  verificationConfig?: VerificationChainConfig;
}

/**
 * The composition seam. Every method is deterministic given its inputs and
 * composes the frozen estate — the fabric never executes, approves, spends or
 * learns.
 */
export class IntelligenceFabricService {
  readonly healthLedger: ProviderHealthLedger;
  readonly costGuard: CostPolicyGuard;
  readonly autonomy: AutonomyPolicy;
  readonly strategy: SelectionStrategy;
  readonly verification: VerificationChainPolicy;
  readonly workflowBounds: WorkflowBounds;
  readonly costPort?: FabricCostPort;
  readonly providerPort?: FabricProviderPort;
  readonly workflowLimits: WorkflowLimits;
  readonly costLimits: CostPolicyLimits;
  readonly verificationConfig: VerificationChainConfig;

  constructor(options: FabricServiceOptions = {}) {
    this.healthLedger = options.healthLedger ?? new ProviderHealthLedger();
    this.costGuard = options.costGuard ?? new CostPolicyGuard();
    this.autonomy = options.autonomy ?? new AutonomyPolicy();
    this.strategy = options.strategy ?? new SelectionStrategy();
    this.verificationConfig = options.verificationConfig ?? {
      maxDepth: 3,
      maxProviders: 3,
      timeoutMs: 60_000,
      maxCostUsd: 5,
    };
    this.verification =
      options.verification ?? new VerificationChainPolicy(this.verificationConfig);
    this.workflowLimits = options.workflowLimits ?? {
      maxParallelProviders: 4,
      maxWorkflowDepth: 6,
      maxWorkflowTasks: 20,
      maxProviderCalls: 50,
      maxWorkflowCostUsd: 5,
      maxWorkflowTimeMs: 600_000,
    };
    this.workflowBounds = options.workflowBounds ?? new WorkflowBounds();
    this.costLimits = options.costLimits ?? {};
    this.costPort = options.costPort;
    this.providerPort = options.providerPort;
  }

  // ── G-1 · Provider health ────────────────────────────────────────────────

  observeHealth(observation: HealthObservation): ProviderHealth {
    this.healthLedger.observe(observation);
    return this.healthLedger.health(observation.providerId);
  }

  providerHealth(providerId: string): ProviderHealth {
    return this.healthLedger.health(providerId);
  }

  allProviderHealth(): ProviderHealth[] {
    return this.healthLedger.all();
  }

  // ── G-2 · Cost policy ─────────────────────────────────────────────────────

  checkCost(input: {
    additionalUsd?: number;
    providerId?: string;
    workspaceId?: string;
    ownerId?: string;
  }): CostPolicyDecision {
    const current =
      this.costPort?.snapshot({
        ownerId: input.ownerId,
        providerId: input.providerId,
        workspaceId: input.workspaceId,
      }) ?? {};
    return this.costGuard.check({
      additionalUsd: input.additionalUsd,
      providerId: input.providerId,
      workspaceId: input.workspaceId,
      limits: this.costLimits,
      current,
    });
  }

  // ── G-3 · Autonomy levels ────────────────────────────────────────────────

  gateAutonomy(input: {
    currentLevel: AutonomyLevel;
    action: string;
    userAuthorization?: { id: string; grantedAt: string; scope: string };
  }): AutonomyDecision {
    return this.autonomy.gate(input);
  }

  nextAutonomyLevel(currentLevel: AutonomyLevel, desiredLevel: AutonomyLevel): AutonomyLevel {
    return this.autonomy.nextLevel(currentLevel, desiredLevel);
  }

  // ── G-4 · Selection strategies ───────────────────────────────────────────

  async select(input: {
    strategy: SelectionStrategyKind;
    taskPrivacy: PrivacyClass;
    capability: string;
    candidates?: StrategyCandidate[];
  }): Promise<StrategySelection> {
    const candidates =
      input.candidates ??
      (this.providerPort ? await this.providerPort.candidates(input.capability) : []);
    return this.strategy.rank({
      strategy: input.strategy,
      taskPrivacy: input.taskPrivacy,
      candidates,
    });
  }

  // ── G-5 · Result normalization ────────────────────────────────────────────

  normalize(raw: RawProviderResponse): NormalizedProviderResult {
    return normalizeResult(raw);
  }

  // ── G-6 · Verification chains ────────────────────────────────────────────

  validateVerificationPlan(plan: VerificationPlan): { allowed: boolean; reasons: string[] } {
    return this.verification.validatePlan(plan);
  }

  evaluateVerificationChain(chain: ChainEvaluation): VerificationChainDecision {
    return this.verification.evaluate(chain);
  }

  // ── G-7 · Workflow bounds ────────────────────────────────────────────────

  validateWorkflow(plan: WorkflowPlan): WorkflowBoundsDecision {
    return this.workflowBounds.validate(plan, this.workflowLimits);
  }
}
