// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · WorldModelService
// SPRINT-032 — the ONLY composition seam. Represents the minimum useful world
// for better user decisions by INDEXING the existing estate:
//
//   USER → GOALS → PROJECTS → SKILLS → WORK → PREFERENCES → PERMISSIONS
//   PROJECT → TASKS → WORKFLOWS → OUTCOMES → OPPORTUNITIES
//   BUSINESS → PROBLEMS → SERVICES → CUSTOMERS → WORKFLOWS → REVENUE → COSTS
//   OPPORTUNITY → EVIDENCE → VALUE → EFFORT → RISK → CAPABILITIES → APPROVAL
//   AI CAPABILITY → PROVIDERS → MODELS → COST → QUALITY → LATENCY → AVAILABILITY
//   OUTCOME → EXPECTED → ACTUAL → COST → QUALITY → LEARNING SIGNAL
//
// Every authority stays in the frozen estate — reached ONLY through the
// narrow ports. This service:
//   • OBSERVES (evidence-backed, provenance-required) — never fabricates
//   • REASONS (advisory scores with every factor exposed)
//   • PROPOSES (bounded decompositions, advisory workers) — never executes,
//     never spends, never authorizes, never promotes to memory
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BlueprintApprovalRequest,
  BoundaryDecision,
  BusinessCandidate,
  BusinessProblem,
  BusinessUnit,
  BusinessWorkflow,
  CapitalMode,
  CommandCenterView,
  CustomerDiscoveryPlan,
  ExperimentPlan,
  FounderBriefing,
  OpportunityEvaluation,
  OpportunityPipelineEntry,
  OpportunityRadar,
  OrchestrationPlan,
  OutcomeEvidence,
  OutcomeFeedbackResult,
  ProblemAssessment,
  ProblemEvidence,
  ProblemStatus,
  ProviderEconomicsResult,
  RevenueDecisionHint,
  RevenueFigure,
  RevenueRanking,
  RevenueSnapshot,
  RevenueStream,
  RoleSpec,
  SignalHealthEntry,
  TimelineEvent,
  TimelineEventType,
  TimelineResult,
  WorldEntity,
  WorldEntityType,
  WorldGraphView,
  WorldOverview,
  WorldRelation,
  WorldRelationType,
  WorldSignalKind,
  WorldSignalSourceResult,
  ObservationStatus,
  CustomerDiscoveryRecord,
  EvidenceCalibrationResult,
  EvidenceQualityResult,
  FounderEvidenceState,
  FounderObservation,
  NextBestAction,
  OpportunityComparison,
  OpportunityDrilldown,
  ProspectDiscoveryStatus,
  WorkerSpec,
  WorkflowDecomposition,
  WorkflowExecutionBlueprint,
} from '../types/world-types.js';
import { normalizeOpportunityCategory } from '../types/world-types.js';
import type {
  WorldActionPort,
  WorldApprovalPort,
  WorldBrainPort,
  WorldControlPort,
  WorldCostPort,
  WorldFabricPort,
  WorldProactivePort,
  WorldSignalSourcePort,
  WorldStores,
} from '../contracts/world-ports.js';
import { WorldGraph, type ObserveInput } from '../domain/WorldGraph.js';
import { BusinessUnitValidator } from '../domain/BusinessUnit.js';
import { OpportunityEconomics, type FactorInput } from '../domain/OpportunityEconomics.js';
import { AIWorkforce } from '../domain/AIWorkforce.js';
import {
  WorkflowFactory,
  createWorkflowRecord,
  planWithinBounds,
} from '../domain/WorkflowFactory.js';
import { HumanAIBoundary } from '../domain/HumanAIBoundary.js';
import { RevenueIntelligence } from '../domain/RevenueIntelligence.js';
import { buildFounderBriefing } from '../domain/FounderBriefing.js';
import { WorkflowExecutionBlueprintFactory } from '../domain/WorkflowExecutionBlueprint.js';
import { OutcomeEvidenceModel } from '../domain/OutcomeEvidence.js';
import { BlueprintApprovalFactory } from '../domain/BlueprintApprovalFactory.js';
import { CostWeightedRevenue } from '../domain/CostWeightedRevenue.js';
import {
  MultiProviderOrchestrator,
  type OrchestrateInput,
} from '../domain/MultiProviderOrchestrator.js';
import {
  applyRevenueSignal,
  buildBusinessCandidate,
  buildCustomerDiscovery,
  buildOpportunityRadar,
  canTransition,
  classifyProblemLevel,
  deriveConfidence,
  planExperiment,
  problemStableKey,
  providerEconomics,
  recommendStop,
  sanitizeEvidenceText,
  scoreBusinessOpportunity,
  scoreExperiment,
  scoreProblem,
  transitionReason,
  validateEvidence,
} from '../domain/OpportunityDiscovery.js';
import {
  buildOpportunityComparison,
  calibrateFactors,
  canAdvanceProspect,
  evidenceQuality,
  nextBestAction,
  prospectTransitionReason,
  validateCustomerDiscoveryRecord,
  validateFounderObservation,
} from '../domain/FounderEvidenceLoop.js';
import type { ProblemFactor } from '../types/world-types.js';

export type WorldResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): WorldResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code = 'WORLD_ERROR'): WorldResult<T> {
  return { success: false, error, code };
}

export interface WorldModelOptions {
  brain: WorldBrainPort;
  proactive: WorldProactivePort;
  fabric: WorldFabricPort;
  action: WorldActionPort;
  control: WorldControlPort;
  stores: WorldStores;
  /** SPRINT-034 — the EXISTING approval authority (Brain). The world model
   *  never approves anything itself; blueprint approval decisions are
   *  delegated through this port only. */
  approval?: WorldApprovalPort;
  /** SPRINT-034 — CostLedger cost evidence (measure-only). */
  cost?: WorldCostPort;
  signalSources?: WorldSignalSourcePort[];
  now?: () => string;
}

const MAX_PIPELINE_ENTRIES = 20;
const MAX_OVERVIEW_SIGNALS = 11;

export class WorldModelService {
  readonly graph: WorldGraph;
  private readonly brain: WorldBrainPort;
  private readonly proactive: WorldProactivePort;
  private readonly fabric: WorldFabricPort;
  private readonly action: WorldActionPort;
  private readonly control: WorldControlPort;
  private readonly stores: WorldStores;
  private readonly signalSources: WorldSignalSourcePort[];
  private readonly now: () => string;
  private readonly units: BusinessUnitValidator;
  private readonly economics: OpportunityEconomics;
  private readonly workforce: AIWorkforce;
  private readonly factory: WorkflowFactory;
  private readonly boundary: HumanAIBoundary;
  private readonly revenue: RevenueIntelligence;
  private readonly blueprintFactory: WorkflowExecutionBlueprintFactory;
  private readonly approvalPort: WorldApprovalPort | undefined;
  private readonly costPort: WorldCostPort | undefined;
  private readonly outcomeModel: OutcomeEvidenceModel;
  private readonly approvalFactory: BlueprintApprovalFactory;
  private readonly costWeighted: CostWeightedRevenue;
  private readonly orchestrator: MultiProviderOrchestrator;

  constructor(opts: WorldModelOptions) {
    this.brain = opts.brain;
    this.proactive = opts.proactive;
    this.fabric = opts.fabric;
    this.action = opts.action;
    this.control = opts.control;
    this.stores = opts.stores;
    this.signalSources = opts.signalSources ?? [];
    this.approvalPort = opts.approval;
    this.costPort = opts.cost;
    this.now = opts.now ?? ((): string => new Date().toISOString());
    this.graph = new WorldGraph(
      { entities: opts.stores.entities, relations: opts.stores.relations },
      this.now,
    );
    this.units = new BusinessUnitValidator();
    this.economics = new OpportunityEconomics();
    this.workforce = new AIWorkforce();
    this.factory = new WorkflowFactory();
    this.boundary = new HumanAIBoundary(opts.action);
    this.revenue = new RevenueIntelligence(opts.stores.revenueStreams, this.now);
    this.blueprintFactory = new WorkflowExecutionBlueprintFactory(opts.action, this.now);
    this.outcomeModel = new OutcomeEvidenceModel();
    this.approvalFactory = new BlueprintApprovalFactory(opts.action, this.now);
    this.costWeighted = new CostWeightedRevenue(opts.cost, this.now);
    this.orchestrator = new MultiProviderOrchestrator({
      fabric: opts.fabric,
      action: opts.action,
      now: this.now,
    });
  }

  // ── 1. The world graph (bounded index — never a universal graph) ─────────

  /** Record an evidence-backed observation (provenance REQUIRED). */
  observe(input: ObserveInput): WorldResult<WorldEntity> {
    const result = this.graph.observe(input);
    return result.success ? ok(result.data) : err(result.error);
  }

  link(input: {
    ownerId: string;
    type: WorldRelationType;
    fromId: string;
    toId: string;
    note?: string;
  }): WorldResult<WorldRelation> {
    const result = this.graph.link(input);
    return result.success ? ok(result.data) : err(result.error);
  }

  listEntities(
    ownerId: string,
    opts?: { type?: WorldEntityType; limit?: number; offset?: number },
  ): WorldResult<{ entities: WorldEntity[]; total: number }> {
    const result = this.graph.listEntities(ownerId, opts);
    return result.success ? ok(result.data) : err(result.error);
  }

  listRelations(
    ownerId: string,
    opts?: { type?: WorldRelationType; limit?: number; offset?: number },
  ): WorldResult<{ relations: WorldRelation[]; total: number }> {
    const result = this.graph.listRelations(ownerId, opts);
    return result.success ? ok(result.data) : err(result.error);
  }

  view(ownerId: string): WorldGraphView {
    return this.graph.view(ownerId);
  }

  // ── 2. Business operating model (configurable units) ─────────────────────

  listBusinessUnits(ownerId: string): WorldResult<BusinessUnit[]> {
    return ok(this.stores.businessUnits.list(ownerId));
  }

  createBusinessUnit(input: {
    ownerId: string;
    name: string;
    purpose: string;
    targetCustomer?: string;
    offerings?: string[];
    automationLevel?: number;
    aiCapabilities?: string[];
    humanResponsibilities?: string[];
    approvalRequirements?: string[];
  }): WorldResult<BusinessUnit> {
    const validated = this.units.validate(input);
    if (!validated.success) return err(validated.error, validated.code);
    // Stable-key idempotency: same name → same unit (upsert, never duplicate).
    const existing = this.stores.businessUnits.getByKey(input.ownerId, validated.data.stableKey);
    const unit = { ...validated.data, id: existing?.id ?? validated.data.id };
    this.stores.businessUnits.save(unit);
    return ok(unit);
  }

  updateBusinessUnit(input: {
    ownerId: string;
    id: string;
    name?: string;
    purpose?: string;
    targetCustomer?: string;
    offerings?: string[];
    automationLevel?: number;
    aiCapabilities?: string[];
    humanResponsibilities?: string[];
    approvalRequirements?: string[];
    status?: BusinessUnit['status'];
  }): WorldResult<BusinessUnit> {
    const existing = this.stores.businessUnits.get(input.ownerId, input.id);
    if (!existing) return err('Business unit not found.', 'NOT_FOUND');
    const merged = this.units.validate({
      ownerId: input.ownerId,
      id: existing.id,
      name: input.name ?? existing.name,
      purpose: input.purpose ?? existing.purpose,
      targetCustomer: input.targetCustomer ?? existing.targetCustomer,
      offerings: input.offerings ?? existing.offerings,
      workflowIds: existing.workflowIds,
      opportunityIds: existing.opportunityIds,
      costs: existing.costs,
      revenue: existing.revenue,
      kpis: existing.kpis,
      automationLevel: input.automationLevel ?? existing.automationLevel,
      aiCapabilities: input.aiCapabilities ?? existing.aiCapabilities,
      humanResponsibilities: input.humanResponsibilities ?? existing.humanResponsibilities,
      approvalRequirements: input.approvalRequirements ?? existing.approvalRequirements,
      status: input.status ?? existing.status,
    });
    if (!merged.success) return err(merged.error, merged.code);
    const updated: BusinessUnit = {
      ...merged.data,
      createdAt: existing.createdAt,
      updatedAt: this.now(),
    };
    this.stores.businessUnits.save(updated);
    return ok(updated);
  }

  removeBusinessUnit(ownerId: string, id: string): WorldResult<{ removed: boolean }> {
    const existing = this.stores.businessUnits.get(ownerId, id);
    if (!existing) return err('Business unit not found.', 'NOT_FOUND');
    this.stores.businessUnits.remove(ownerId, id);
    return ok({ removed: true });
  }

  // ── 3. Opportunity economics (composes the EXISTING assessor) ────────────

  evaluateOpportunity(input: {
    ownerId: string;
    title: string;
    description: string;
    requiredCapabilities: string[];
    /** SPRINT-033 Part B — optional category from the closed vocabulary
     *  (normalized); absent → the assessor's category is kept. */
    category?: string;
    /** Factor evidence — UNKNOWN factors stay UNKNOWN (never fabricated). */
    factors: FactorInput[];
    /** The ACTUAL initial cost in INR (evidence-carrying) — drives capital mode. */
    initialCostInr?: { value?: number; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    /** The owner's zero/low-capital budget tier (INR). */
    capitalBudgetInr?: number;
  }): WorldResult<OpportunityEvaluation> {
    let assessment: ReturnType<WorldProactivePort['assessBusiness']>;
    try {
      assessment = this.proactive.assessBusiness(input.ownerId, {
        title: input.title,
        description: input.description,
        requiredCapabilities: input.requiredCapabilities,
      });
    } catch {
      return err('The opportunity assessor is unavailable.', 'ASSESSOR_UNAVAILABLE');
    }
    // SPRINT-034 — verified outcome feedback: evidence for the SAME category
    // nudges the factor inputs toward the observed direction, bounded (never
    // a rewrite). The feedback is attached to the evaluation so it stays
    // explainable.
    const feedback = this.applyOutcomeFeedbackToFactors(
      input.ownerId,
      evaluationCategory(input.category, assessment.category),
      input.factors,
    );
    const evaluation = this.economics.evaluate({
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      // SPRINT-033 (Part B) — normalize against the closed category vocabulary
      // when provided; otherwise the assessor's category is kept as-is (the
      // world model never invents a category).
      category: input.category ? normalizeOpportunityCategory(input.category) : assessment.category,
      baseScore: assessment.score,
      baseBusinessCase: assessment.businessCase,
      baseEstimatedCost: assessment.estimatedCost,
      baseEstimatedRevenue: assessment.estimatedRevenue,
      baseRiskLevel: assessment.riskLevel,
      baseMvpPlan: assessment.mvpPlan,
      baseEvidence: assessment.evidence,
      factors: feedback.factors,
      initialCostInr: input.initialCostInr,
      capitalBudgetInr: input.capitalBudgetInr,
      now: this.now,
    });
    return ok({ ...evaluation, feedback: feedback.adjustments });
  }

  /** The revenue opportunity pipeline — surface the best opportunities NOW.
   *  Ranked by advisory score; never a promise; never auto-launches. */
  opportunityPipeline(
    ownerId: string,
    opts?: { budgetInr?: number; limit?: number },
  ): WorldResult<OpportunityPipelineEntry[]> {
    const lifecycle = this.control.listOpportunities(ownerId);
    const brain = this.brain.listOpportunities(ownerId).data ?? [];
    const limit = Math.min(Math.max(opts?.limit ?? 10, 1), MAX_PIPELINE_ENTRIES);

    // SPRINT-043E — the AI World discovery must NOT pollute a brand-new
    // founder's pipeline before they have recorded any data. The Brain still
    // discovers and stores AI World opportunities (they belong to the AI World
    // discovery/bell surface), but the founder's revenue pipeline stays HONESTLY
    // EMPTY until the founder has engaged with the evidence loop: a recorded
    // problem, observation, prospect, or a control-plane lifecycle record.
    // Control records are founder-initiated so they always unlock the pipeline;
    // the founder's own evidence stores are never fabricated.
    const hasFounderData =
      lifecycle.length > 0 ||
      this.stores.problems.list(ownerId).length > 0 ||
      this.stores.observations.list(ownerId).length > 0 ||
      this.stores.prospects.list(ownerId).length > 0;
    const brainToSurface = hasFounderData ? brain : [];

    const entries: OpportunityPipelineEntry[] = [];
    const seen = new Set<string>();

    // 1. Control-plane opportunity lifecycle records (typed, guarded).
    for (const record of lifecycle) {
      if (record.status === 'REJECTED' || record.status === 'COMPLETED') continue;
      const key = record.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        opportunityId: record.id,
        title: record.title,
        category: record.category,
        status: record.status,
        score: 0,
        capitalMode: this.capitalModeFromRecord(record, opts?.budgetInr),
        riskLevel: mapRisk(record.riskLevel),
        estimatedCost: record.estimatedCost
          ? { label: record.estimatedCost.label, status: mapStatus(record.estimatedCost.status) }
          : undefined,
        estimatedValue: record.estimatedValue
          ? { label: record.estimatedValue.label, status: mapStatus(record.estimatedValue.status) }
          : undefined,
        firstStep: record.recommendedWorkflow?.[0],
        approvalRequired: true,
        evidence: record.evidence.map((e) => e.label),
      });
    }

    // 2. Brain opportunities (evidence-backed, uncertainty-exposed). Gated on
    //    founder activity (hasFounderData above) — never surfaced before the
    //    founder has recorded any data.
    for (const opportunity of brainToSurface) {
      if (opportunity.status === 'DISMISSED') continue;
      const key = opportunity.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        opportunityId: opportunity.id,
        title: opportunity.title,
        category: opportunity.category,
        status: opportunity.status,
        score: Math.max(0, Math.min(1, 1 - opportunity.uncertainty)),
        capitalMode: 'UNKNOWN',
        riskLevel: mapRisk(opportunity.risk ?? 'UNKNOWN'),
        estimatedCost: opportunity.cost
          ? { label: opportunity.cost.label, status: mapStatus(opportunity.cost.status) }
          : undefined,
        estimatedValue: opportunity.estimatedValue
          ? {
              label: opportunity.estimatedValue.label,
              status: mapStatus(opportunity.estimatedValue.status),
            }
          : undefined,
        firstStep: opportunity.recommendedNextAction,
        approvalRequired: true,
        evidence: opportunity.evidence.slice(0, 5),
      });
    }

    const sorted = entries.sort((a, b) => b.score - a.score).slice(0, limit);
    return ok(sorted);
  }

  private capitalModeFromRecord(
    record: { estimatedCost?: { label: string; status: string } },
    budgetInr?: number,
  ): CapitalMode {
    // No cost evidence → UNKNOWN (honest). Never fabricated.
    if (!record.estimatedCost || record.estimatedCost.status === 'UNKNOWN') return 'UNKNOWN';
    const digits = record.estimatedCost.label.replace(/[^\d]/g, '');
    if (digits.length === 0) return 'UNKNOWN';
    const value = Number(digits);
    if (Number.isNaN(value) || value <= 0) return 'NO_COST';
    if (budgetInr !== undefined && value <= budgetInr) return 'LOW_COST';
    return 'CAPITAL_REQUIRED';
  }

  // ── 4. AI workforce (provider-neutral roles + advisory workers) ──────────

  listRoles(ownerId: string): WorldResult<RoleSpec[]> {
    return ok(this.stores.roles.list(ownerId));
  }

  registerRole(input: {
    ownerId: string;
    name: string;
    responsibilities: string[];
    capabilities: string[];
    providerStrategies?: RoleSpec['providerStrategies'];
    privacyRequirement?: 'PRIVATE' | 'STANDARD';
    authorityClass?: 'A' | 'B' | 'C' | 'D';
  }): WorldResult<RoleSpec> {
    const result = this.workforce.registerRole(input);
    if (!result.success) return err(result.error);
    const existing = this.stores.roles.getByKey(input.ownerId, result.data.stableKey);
    const role = { ...result.data, id: existing?.id ?? result.data.id };
    this.stores.roles.save(role);
    return ok(role);
  }

  /** Suggest an ADVISORY worker for a role through the EXISTING fabric
   *  selection strategy (PRIVATE → local-only; no candidate → no worker). */
  async suggestWorkers(
    ownerId: string,
    roleId: string,
    strategy: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED' = 'BALANCED',
  ): Promise<WorldResult<WorkerSpec[]>> {
    const role = this.stores.roles.get(ownerId, roleId);
    if (!role) return err('Role not found.', 'NOT_FOUND');
    const workers: WorkerSpec[] = [];
    for (const capability of role.capabilities.slice(0, 5)) {
      const privacy = role.privacyRequirement === 'PRIVATE' ? 'PRIVATE' : 'INTERNAL';
      try {
        const selection = await this.fabric.selectStrategy({
          strategy,
          taskPrivacy: privacy,
          capability,
        });
        if (selection.selected) {
          workers.push({
            id: `worker-${Math.random().toString(36).slice(2, 10)}`,
            ownerId,
            roleId: role.id,
            roleName: role.name,
            providerId: selection.selected.providerId,
            modelId: selection.selected.modelId,
            strategy: selection.strategy,
            reasons: selection.reasons.slice(0, 4),
            authorityClass: role.authorityClass,
            advisory: true,
          });
        }
      } catch {
        // Honest: no selection when the fabric is unavailable.
        return err('The intelligence fabric is unavailable.', 'FABRIC_UNAVAILABLE');
      }
    }
    return ok(workers.slice(0, 5));
  }

  /** Structural no-escalation check — a worker can never create another
   *  worker with greater authority. */
  canDelegate(role: RoleSpec, targetClass: 'A' | 'B' | 'C' | 'D'): boolean {
    return this.workforce.canDelegate(role, targetClass);
  }

  // ── 5. Business workflow factory (generic + bounded) ─────────────────────

  createWorkflow(input: {
    ownerId: string;
    name: string;
    description: string;
    businessUnitId?: string;
    trigger: string;
    inputs: string[];
    steps: import('../types/world-types.js').WorkflowStep[];
    outputs: string[];
    expectedOutcome?: string;
  }): WorldResult<BusinessWorkflow> {
    const result = createWorkflowRecord(input);
    if (!result.success) return err(result.error);
    const existing = this.stores.workflows.getByKey(input.ownerId, result.data.stableKey);
    const workflow = { ...result.data, id: existing?.id ?? result.data.id };
    this.stores.workflows.save(workflow);
    return ok(workflow);
  }

  listWorkflows(ownerId: string): WorldResult<BusinessWorkflow[]> {
    return ok(this.stores.workflows.list(ownerId));
  }

  /** Bounded decomposition — validated against the EXISTING fabric
   *  WorkflowBounds. Representation only: `executed:false` is structural. */
  decomposeWorkflow(input: {
    ownerId: string;
    goal: string;
    steps: Array<{ label: string; capability?: string; roleName?: string }>;
    estimatedCostUsd?: number;
    estimatedTimeMs?: number;
  }): WorldResult<WorkflowDecomposition> {
    const result = this.factory.decompose(input);
    if (!result.success) return err(result.error);
    const plan = result.data.plan;
    // Validate through the EXISTING fabric bounds (the gateway's configured
    // limits are authoritative — the domain default is only the fallback).
    const fabricDecision = this.fabric.validateWorkflow(plan);
    const localDecision = planWithinBounds(plan);
    const allowed = fabricDecision.allowed && localDecision.allowed;
    const exceeded = fabricDecision.exceeded ?? localDecision.exceeded;
    return ok({
      ...result.data,
      bounds: {
        allowed,
        reason: allowed
          ? 'The decomposition is within all workflow bounds.'
          : fabricDecision.exceeded
            ? fabricDecision.reason
            : localDecision.reason,
        exceeded,
      },
    });
  }

  // ── 5b. Multi-provider orchestration plan (SPRINT-036) ────────────────────
  // The bounded orchestration composition seam: per-step provider selection
  // through the EXISTING Intelligence Fabric (advisory, strategy-aware,
  // privacy-overriding), the EXISTING WorkflowBounds, the EXISTING
  // ActionClassPolicy and the deterministic bounded retry/fallback policy.
  // The plan is a REPRESENTATION (`executed:false` structural) — it never
  // calls a provider, never spends, never approves; the runtime path remains
  // the EXISTING execution bridge.

  /** Produce a bounded, owner-scoped, EXPLAINABLE multi-provider plan. */
  async orchestratePlan(input: OrchestrateInput): Promise<WorldResult<OrchestrationPlan>> {
    const result = await this.orchestrator.plan(input);
    if (!result.success) return err(result.error, result.code);
    // Stable-key idempotency: same (goal, strategy) upserts, never duplicates.
    const existing = this.stores.orchestrationPlans.getByKey(input.ownerId, result.data.stableKey);
    const plan = {
      ...result.data,
      id: existing?.id ?? result.data.id,
      createdAt: existing?.createdAt ?? result.data.createdAt,
    };
    this.stores.orchestrationPlans.save(plan);
    return ok(plan);
  }

  listOrchestrationPlans(ownerId: string): WorldResult<OrchestrationPlan[]> {
    return ok(this.stores.orchestrationPlans.list(ownerId));
  }

  getOrchestrationPlan(ownerId: string, planId: string): WorldResult<OrchestrationPlan> {
    const plan = this.stores.orchestrationPlans.get(ownerId, planId);
    if (!plan) return err('Orchestration plan not found.', 'NOT_FOUND');
    return ok(plan);
  }

  // ── 5c. Orchestration plan approval (SPRINT-037) — through Brain ONLY ────
  // The founder explicitly approves the plan BEFORE it can be submitted to
  // the EXISTING execution bridge. The world model NEVER approves on its own:
  // the decision is routed through the existing approval authority
  // (WorldApprovalPort → Brain), exactly like decideBlueprintApproval. The
  // plan's `executed:false` is STRUCTURAL — approval never flips it; the
  // bridge is the only runtime path.

  /** Approve / reject an orchestration plan THROUGH the existing authority. */
  approveOrchestrationPlan(input: {
    ownerId: string;
    planId: string;
    decision: 'APPROVED' | 'REJECTED';
    note?: string;
  }): WorldResult<OrchestrationPlan> {
    const plan = this.stores.orchestrationPlans.get(input.ownerId, input.planId);
    if (!plan) return err('Orchestration plan not found.', 'NOT_FOUND');
    if (plan.status !== 'PLANNED') {
      return err('This plan is already decided.', 'ALREADY_DECIDED');
    }
    if (!this.approvalPort) {
      return err(
        'The existing approval authority is not configured.',
        'APPROVAL_AUTHORITY_UNAVAILABLE',
      );
    }
    // Register the plan's goal with the EXISTING authority (Brain) — the only
    // place a sensitive action is ever registered for approval.
    const registered = this.approvalPort.requestApproval({
      userId: input.ownerId,
      taskId: plan.id,
      action: plan.goal,
    });
    const taskId = registered.success && registered.data?.taskId ? registered.data.taskId : plan.id;
    if (input.decision === 'APPROVED') {
      const decision = this.approvalPort.approve({
        userId: input.ownerId,
        taskId,
        action: plan.goal,
      });
      if (!decision.success || !decision.data) {
        return err(decision.error ?? 'Approval refused by the authority.', 'APPROVAL_REFUSED');
      }
      const updated: OrchestrationPlan = {
        ...plan,
        status: 'APPROVED',
        approval: {
          grantedBy: input.ownerId,
          grantedAt: decision.data.grantedAt,
          scope: decision.data.scope,
          note: input.note,
        },
        updatedAt: this.now(),
      };
      this.stores.orchestrationPlans.save(updated);
      return ok(updated);
    }
    const decision = this.approvalPort.reject({ userId: input.ownerId, taskId, action: plan.goal });
    if (!decision.success) {
      return err(decision.error ?? 'Rejection refused by the authority.', 'REJECTION_REFUSED');
    }
    const updated: OrchestrationPlan = {
      ...plan,
      status: 'REJECTED',
      updatedAt: this.now(),
    };
    this.stores.orchestrationPlans.save(updated);
    return ok(updated);
  }

  // ── 5d. Opportunity Discovery & Revenue Validation (SPRINT-038) ──────────
  // A PRACTICAL problem→revenue-validation path composed over the frozen
  // estate — NOT an engine. Problems are evidence/provenance-REQUIRED; the
  // THREE advisory scores + LEVEL are deterministic and factor-exposed;
  // the lifecycle is bounded (no idea→business jump); revenue validation is
  // VERIFIED-payment-only; the experiment planner prefers NO_COST; the STOP
  // recommendation CAN say "do not build this"; provider economics reuse the
  // EXISTING Intelligence Fabric (existing providers preferred, capability
  // gaps → founder notifications, no automatic paid adoption). Nothing here
  // approves, spends, executes or promotes to memory.

  /** Register a PRACTICAL business problem. Evidence is REQUIRED (a problem
   *  with no evidence is refused); externally derived factual claims carry
   *  provenance. Stable-key idempotent (owner + statement) — never a
   *  duplicate. */
  registerProblem(input: {
    ownerId: string;
    problemStatement: string;
    customerOrBusiness?: string;
    industry?: string;
    workflow?: string;
    affectedRole?: string;
    pain?: string;
    frequency?: string;
    humanEffort?: string;
    estimatedCurrentCost?: RevenueFigure;
    revenueImpact?: RevenueFigure;
    errorImpact?: string;
    urgency?: string;
    currentSolution?: string;
    competitorAlternatives?: string[];
    aiSuitability?: string;
    automationPotential?: RevenueFigure;
    buyer?: string;
    implementationComplexity?: string;
    estimatedAiCost?: RevenueFigure;
    evidence: Array<{
      source: ProblemEvidence['source'];
      observedAt?: string;
      reference?: string;
      text: string;
      confidence: ObservationStatus;
    }>;
  }): WorldResult<BusinessProblem> {
    const statement = sanitizeEvidenceText(input.problemStatement, 300);
    if (statement.length === 0) {
      return err('A problem statement is required.', 'PROBLEM_STATEMENT_REQUIRED');
    }
    if (input.evidence.length === 0) {
      return err(
        'A problem requires at least one evidence record with provenance (no fabricated facts).',
        'EVIDENCE_REQUIRED',
      );
    }
    const evidence: ProblemEvidence[] = [];
    for (let i = 0; i < input.evidence.length; i += 1) {
      // eslint-disable-next-line security/detect-object-injection -- Array index access; i is the loop counter, never user-controlled.
      const claim = input.evidence[i];
      if (!claim) continue;
      const record = validateEvidence(
        {
          ownerId: input.ownerId,
          source: claim.source,
          observedAt: claim.observedAt,
          reference: claim.reference,
          text: claim.text,
          confidence: claim.confidence,
        },
        this.now,
        i,
      );
      if (!record.success) return err(record.error, record.code);
      evidence.push(record.data);
    }
    const stableKey = problemStableKey(input.ownerId, statement);
    const existing = this.stores.problems.getByKey(input.ownerId, stableKey);
    const ts = this.now();
    const problem: BusinessProblem = {
      id:
        existing?.id ??
        `problem-${ts.replace(/\D/g, '').slice(-10)}-${Math.random().toString(36).slice(2, 6)}`,
      ownerId: input.ownerId,
      stableKey,
      customerOrBusiness: input.customerOrBusiness?.slice(0, 160),
      industry: input.industry?.slice(0, 80),
      workflow: input.workflow?.slice(0, 160),
      problemStatement: statement,
      affectedRole: input.affectedRole?.slice(0, 120),
      pain: input.pain?.slice(0, 300),
      frequency: input.frequency?.slice(0, 200),
      humanEffort: input.humanEffort?.slice(0, 200),
      estimatedCurrentCost: input.estimatedCurrentCost,
      revenueImpact: input.revenueImpact,
      errorImpact: input.errorImpact?.slice(0, 300),
      urgency: input.urgency?.slice(0, 300),
      currentSolution: input.currentSolution?.slice(0, 300),
      competitorAlternatives: (input.competitorAlternatives ?? []).slice(0, 12),
      aiSuitability: input.aiSuitability?.slice(0, 300),
      automationPotential: input.automationPotential,
      buyer: input.buyer?.slice(0, 160),
      willingnessToPayEvidence: [],
      implementationComplexity: input.implementationComplexity?.slice(0, 300),
      estimatedAiCost: input.estimatedAiCost,
      evidence,
      confidence: deriveConfidence(evidence),
      status: 'OBSERVED',
      revenueState: 'NO_EVIDENCE',
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    this.stores.problems.save(problem);
    return ok(problem);
  }

  listProblems(ownerId: string): WorldResult<BusinessProblem[]> {
    return ok(this.stores.problems.list(ownerId));
  }

  getProblem(ownerId: string, problemId: string): WorldResult<BusinessProblem> {
    const problem = this.stores.problems.get(ownerId, problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    return ok(problem);
  }

  /** Append a problem-evidence record (Part B) — provenance-required,
   *  sanitized; a factual claim without evidence is refused. */
  addProblemEvidence(input: {
    ownerId: string;
    problemId: string;
    source: ProblemEvidence['source'];
    observedAt?: string;
    reference?: string;
    text: string;
    confidence: ObservationStatus;
  }): WorldResult<BusinessProblem> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const record = validateEvidence(
      {
        ownerId: input.ownerId,
        source: input.source,
        observedAt: input.observedAt,
        reference: input.reference,
        text: input.text,
        confidence: input.confidence,
      },
      this.now,
      problem.evidence.length,
    );
    if (!record.success) return err(record.error, record.code);
    // Bounded — never an unbounded evidence list per problem.
    const evidence = [...problem.evidence, record.data].slice(-20);
    const updated: BusinessProblem = {
      ...problem,
      evidence,
      confidence: deriveConfidence(evidence),
      updatedAt: this.now(),
    };
    this.stores.problems.save(updated);
    return ok(updated);
  }

  /** Record a customer/willingness-to-pay statement (Part G/J) — INTEREST is
   *  never revenue; "I would pay ₹X" is WTP EVIDENCE, never revenue. The
   *  revenue state is advanced by applyRevenueSignal only. */
  recordCustomerSignal(input: {
    ownerId: string;
    problemId: string;
    signal: 'INTEREST' | 'PROBLEM_CONFIRMED' | 'EXPERIMENT_SUCCESS' | 'WILLINGNESS_TO_PAY';
    text: string;
    reference?: string;
    confidence?: ObservationStatus;
  }): WorldResult<BusinessProblem> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const record = validateEvidence(
      {
        ownerId: input.ownerId,
        source: input.signal === 'WILLINGNESS_TO_PAY' ? 'customer_interview' : 'direct_observation',
        observedAt: this.now(),
        reference: input.reference,
        text: input.text,
        confidence:
          input.confidence ?? (input.signal === 'WILLINGNESS_TO_PAY' ? 'ESTIMATED' : 'ESTIMATED'),
      },
      this.now,
      problem.evidence.length,
    );
    if (!record.success) return err(record.error, record.code);
    const evidence = [...problem.evidence, record.data].slice(-20);
    // WTP evidence is tracked separately (Part G) so the radar can show it.
    const willingnessToPayEvidence =
      input.signal === 'WILLINGNESS_TO_PAY'
        ? [...problem.willingnessToPayEvidence, record.data].slice(-10)
        : problem.willingnessToPayEvidence;
    const revenue = applyRevenueSignal(
      problem.revenueState,
      input.signal,
      verifiedPaymentCount(evidence),
    );
    const updated: BusinessProblem = {
      ...problem,
      evidence,
      willingnessToPayEvidence,
      revenueState: revenue.state,
      updatedAt: this.now(),
    };
    this.stores.problems.save(updated);
    return ok(updated);
  }

  /** Record a VERIFIED payment (Part J) — the ONLY revenue-verification path.
   *  One verified payment → REVENUE_VERIFIED; two → REPEAT_REVENUE; three →
   *  REPEATABLE_BUSINESS. Interest / intent / proposals / invoices are NOT
   *  revenue and cannot reach these states. */
  recordVerifiedPayment(input: {
    ownerId: string;
    problemId: string;
    text: string;
    reference?: string;
  }): WorldResult<BusinessProblem> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const record = validateEvidence(
      {
        ownerId: input.ownerId,
        source: 'verified_payment',
        observedAt: this.now(),
        reference: input.reference,
        text: input.text,
        confidence: 'VERIFIED',
      },
      this.now,
      problem.evidence.length,
    );
    if (!record.success) return err(record.error, record.code);
    const evidence = [...problem.evidence, record.data].slice(-20);
    const revenue = applyRevenueSignal(
      problem.revenueState,
      'VERIFIED_PAYMENT',
      verifiedPaymentCount(evidence),
    );
    const updated: BusinessProblem = {
      ...problem,
      evidence,
      revenueState: revenue.state,
      updatedAt: this.now(),
    };
    this.stores.problems.save(updated);
    return ok(updated);
  }

  /** The THREE distinct advisory scores + LEVEL + capital mode + STOP
   *  recommendation for a problem (Parts C/D/M). Factor inputs are
   *  evidence-carrying; UNKNOWN factors contribute nothing. */
  assessProblem(input: {
    ownerId: string;
    problemId: string;
    problemFactors?: ProblemFactor[];
    opportunityFactors?: ProblemFactor[];
    experimentFactors?: ProblemFactor[];
  }): WorldResult<ProblemAssessment> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const problemScore = scoreProblem(input.problemFactors ?? []);
    const opportunityScore = scoreBusinessOpportunity(input.opportunityFactors ?? []);
    const experimentScore = scoreExperiment(input.experimentFactors ?? []);
    const level = classifyProblemLevel(problemScore, opportunityScore);
    const capitalMode = problem.estimatedAiCost
      ? classifyCapitalModeSimple(problem.estimatedAiCost, problem.estimatedAiCost.status)
      : 'UNKNOWN';
    const assessment: ProblemAssessment = {
      problemScore,
      opportunityScore,
      experimentScore,
      level: level.level,
      levelLabel: level.levelLabel,
      levelReasons: level.reasons,
      experimentCapitalMode: capitalMode,
      advisory: true,
    };
    const stop = recommendStop({ problem, assessment });
    const withStop: ProblemAssessment = { ...assessment, stopRecommendation: stop };
    const updated: BusinessProblem = {
      ...problem,
      level: level.level,
      levelLabel: level.levelLabel,
      assessment: withStop,
      stopReason: stop.stop ? stop.reasons[0]?.slice(0, 300) : undefined,
      updatedAt: this.now(),
    };
    this.stores.problems.save(updated);
    return ok(withStop);
  }

  /** Advance a problem through the BOUNDED lifecycle (Part E) — no
   *  idea→business jump; transitions are validated against the table. */
  advanceProblem(input: {
    ownerId: string;
    problemId: string;
    to: ProblemStatus;
  }): WorldResult<BusinessProblem> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    if (!canTransition(problem.status, input.to)) {
      return err(transitionReason(problem.status, input.to), 'INVALID_TRANSITION');
    }
    const updated: BusinessProblem = {
      ...problem,
      status: input.to,
      updatedAt: this.now(),
    };
    this.stores.problems.save(updated);
    return ok(updated);
  }

  /** The zero/low-cost experiment planner (Part F) — the CHEAPEST realistic
   *  validation experiment. NO_COST preferred, then LOW_COST, then
   *  CAPITAL_REQUIRED; spending stays behind existing authorization. */
  planProblemExperiment(input: {
    ownerId: string;
    problemId: string;
    hypothesis: string;
    targetCustomer: string;
    problemUnderTest: string;
    objective: string;
    minimumRequiredData: string[];
    actions: string[];
    estimatedAiCost?: RevenueFigure;
    humanEffort?: RevenueFigure;
    duration?: RevenueFigure;
    successCriteria: string[];
    failureCriteria: string[];
    stopConditions: string[];
    measurementMethod: string;
    expectedInformationGain?: RevenueFigure;
    maxBudget?: RevenueFigure;
    capitalBudgetInr?: number;
  }): WorldResult<ExperimentPlan> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const plan = planExperiment(
      { ...input, ownerId: input.ownerId, problemId: problem.id },
      this.now,
    );
    // A DRAFT/A CAPPED plan does not advance the lifecycle — the founder
    // decides. When the plan exists, the problem may become an
    // EXPERIMENT_CANDIDATE (advisory; the founder still advances explicitly).
    return ok(plan);
  }

  /** Customer discovery PREPARATION (Part G) — interview plan + question
   *  sets; NEVER fabricates an interview result. */
  customerDiscovery(input: {
    ownerId: string;
    problemId: string;
    customerProfile?: string;
  }): WorldResult<CustomerDiscoveryPlan> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    return ok(
      buildCustomerDiscovery({
        ownerId: input.ownerId,
        problemId: problem.id,
        customerProfile: input.customerProfile,
        problemStatement: problem.problemStatement,
        affectedRole: problem.affectedRole,
        currentSolution: problem.currentSolution,
      }),
    );
  }

  /** Provider economics (Part K) — composes the EXISTING Intelligence Fabric.
   *  Existing providers preferred when they satisfy the requirement;
   *  capability gaps → CAPABILITY GAP DETECTED founder notifications, no
   *  automatic paid adoption. */
  async problemProviderEconomics(input: {
    ownerId: string;
    problemId: string;
    requiredCapabilities: string[];
    qualityRequirement?: Array<{ capability: string; quality: number }>;
    privacy?: 'PUBLIC' | 'INTERNAL' | 'SENSITIVE' | 'PRIVATE';
    strategy?: 'CHEAP' | 'FAST' | 'QUALITY' | 'PRIVATE' | 'BALANCED';
  }): Promise<WorldResult<ProviderEconomicsResult>> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    if (input.requiredCapabilities.length === 0) {
      return err('At least one required capability is needed.', 'CAPABILITY_REQUIRED');
    }
    const result = await providerEconomics({
      ownerId: input.ownerId,
      problemId: problem.id,
      requiredCapabilities: input.requiredCapabilities,
      qualityRequirement: input.qualityRequirement,
      fabric: this.fabric,
      privacy: input.privacy ?? 'INTERNAL',
      strategy: input.strategy,
    });
    return ok(result);
  }

  /** Advisory Business Candidate (Part N) — produced only after verified
   *  payment + willingness-to-pay evidence; the founder remains the final
   *  authority. */
  businessCandidate(input: {
    ownerId: string;
    problemId: string;
    serviceDefinition: string;
    targetCustomer: string;
    pricingHypothesis?: RevenueFigure;
    deliveryWorkflow: string[];
    providerStrategy: string;
    aiCost?: RevenueFigure;
    humanCost?: RevenueFigure;
    marginHypothesis?: RevenueFigure;
    customerAcquisitionHypothesis?: string;
    mvpScope: string[];
    automationPotential?: RevenueFigure;
    risks: string[];
    nextExperiment?: string;
  }): WorldResult<BusinessCandidate> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const result = buildBusinessCandidate({ ...input, ownerId: input.ownerId, problem }, this.now);
    return result.success ? ok(result.data) : err(result.error, result.code);
  }

  /** Opportunity Radar (Part I) — bounded, presentation-only read model with
   *  stage counts for the Command Center. */
  opportunityRadar(ownerId: string, opts?: { limit?: number }): OpportunityRadar {
    return buildOpportunityRadar({
      ownerId,
      problems: this.stores.problems.list(ownerId),
      now: this.now,
      limit: opts?.limit,
    });
  }

  // ── 5e. Founder Evidence Loop (SPRINT-039) ───────────────────────────────
  // The disciplined feedback loop that turns the founder's real-world
  // observations + customer-discovery results into calibrated scoring —
  // COMPOSITION ONLY, no new engine. Observations/prospects are bounded
  // owner-scoped evidence records (provenance MANDATORY, explicit evidence
  // states); calibration is a bounded delta over the EXISTING SPRINT-038
  // factors; next-best-action + comparison compose the existing models;
  // voice presentation is read-only (VOICE ≠ AUTHORIZATION preserved).
  // Nothing here approves, spends, executes or promotes to memory.

  /** Record a founder observation (Part B) — provenance MANDATORY, explicit
   *  evidence states; never upgraded to VERIFIED automatically. */
  recordFounderObservation(input: {
    ownerId: string;
    problemId?: string;
    sourceType: FounderObservation['sourceType'];
    sourceReference: string;
    observedStatement: string;
    context?: string;
    affectedCustomerSegment?: string;
    frequency?: string;
    severity?: string;
    currentWorkaround?: string;
    statedWillingnessToPay?: RevenueFigure;
    statedBudget?: RevenueFigure;
    objection?: string;
    nextAction?: string;
    claimedState?: FounderEvidenceState;
    provenance: { source: string; reference?: string; observedAt: string };
  }): WorldResult<FounderObservation> {
    if (input.problemId) {
      const problem = this.stores.problems.get(input.ownerId, input.problemId);
      if (!problem) return err('Problem not found.', 'NOT_FOUND');
    }
    const record = validateFounderObservation({ ...input }, this.now);
    if (!record.success) return err(record.error, record.code);
    this.stores.observations.save(record.data);
    return ok(record.data);
  }

  listObservations(ownerId: string, problemId?: string): WorldResult<FounderObservation[]> {
    const list = problemId
      ? this.stores.observations.listByProblem(ownerId, problemId)
      : this.stores.observations.list(ownerId);
    return ok(list);
  }

  /** Register a customer-discovery record (Part C) — NOT a CRM; discovery ≠
   *  validation; provenance-required. */
  registerProspect(input: {
    ownerId: string;
    problemId: string;
    prospectReference: string;
    customerSegment: string;
    problemDiscussed: string;
    currentSolution?: string;
    painSeverity?: string;
    frequency?: string;
    existingSpending?: RevenueFigure;
    budgetIndication?: RevenueFigure;
    willingnessToPayIndication?: RevenueFigure;
    objection?: string;
    desiredOutcome?: string;
    nextStep?: string;
    discoveryStatus?: ProspectDiscoveryStatus;
    evidence?: Array<{
      source: string;
      observedAt?: string;
      reference?: string;
      text: string;
      confidence: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
    }>;
    provenance: { source: string; reference?: string; observedAt: string };
  }): WorldResult<CustomerDiscoveryRecord> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const record = validateCustomerDiscoveryRecord({ ...input, problemId: problem.id }, this.now);
    if (!record.success) return err(record.error, record.code);
    this.stores.prospects.save(record.data);
    return ok(record.data);
  }

  /** Advance a prospect through the bounded discovery chain (Part C) — a
   *  prospect cannot jump to VERIFIED_PAYMENT; only a verified payment record
   *  advances revenue state. */
  advanceProspect(input: {
    ownerId: string;
    problemId: string;
    prospectReference: string;
    to: ProspectDiscoveryStatus;
    verifiedPaymentText?: string;
  }): WorldResult<CustomerDiscoveryRecord> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const record = this.stores.prospects
      .listByProblem(input.ownerId, input.problemId)
      .find((p) => p.prospectReference === input.prospectReference);
    if (!record) return err('Prospect not found.', 'NOT_FOUND');
    if (!canAdvanceProspect(record.discoveryStatus, input.to)) {
      return err(prospectTransitionReason(record.discoveryStatus, input.to), 'INVALID_TRANSITION');
    }
    // A VERIFIED_PAYMENT prospect transition ALSO records the payment evidence
    // on the problem — the ONLY revenue-verification path (Part J). The payment
    // evidence text is MANDATORY here: a verified payment must carry real
    // verification evidence, never a fabricated placeholder (SPRINT-041
    // hardening — no fabricated revenue records).
    if (input.to === 'VERIFIED_PAYMENT') {
      const paymentText = input.verifiedPaymentText?.trim();
      if (!paymentText) {
        return err(
          'VERIFIED_PAYMENT requires the actual payment evidence (amount, method, reference) — a verified payment is never fabricated.',
          'PAYMENT_EVIDENCE_REQUIRED',
        );
      }
      const payment = this.recordVerifiedPayment({
        ownerId: input.ownerId,
        problemId: problem.id,
        text: paymentText,
        reference: input.prospectReference,
      });
      if (!payment.success) return err(payment.error, payment.code);
    }
    const updated: CustomerDiscoveryRecord = {
      ...record,
      discoveryStatus: input.to,
      updatedAt: this.now(),
    };
    this.stores.prospects.save(updated);
    return ok(updated);
  }

  listProspects(ownerId: string, problemId?: string): WorldResult<CustomerDiscoveryRecord[]> {
    const list = problemId
      ? this.stores.prospects.listByProblem(ownerId, problemId)
      : this.stores.prospects.list(ownerId);
    return ok(list);
  }

  /** Evidence quality (Part F) — deterministic dimensions, never fake
   *  precision; UNKNOWN / NEEDS_REVIEW when insufficient. */
  opportunityEvidenceQuality(
    ownerId: string,
    problemId: string,
  ): WorldResult<EvidenceQualityResult> {
    const problem = this.stores.problems.get(ownerId, problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const observations = this.stores.observations.listByProblem(ownerId, problemId);
    const prospects = this.stores.prospects.listByProblem(ownerId, problemId);
    return ok(evidenceQuality({ problemId, observations, prospects, evidence: problem.evidence }));
  }

  /** Bounded evidence calibration (Part E) — one observation may move a
   *  factor by at most CALIBRATION_DELTA_MAX; every adjustment keeps its
   *  evidence trail; conflicts visible; UNKNOWN never becomes zero. */
  calibrateProblemFactor(input: {
    ownerId: string;
    problemId: string;
    factorKey: string;
    direction: 1 | -1;
    reason: string;
  }): WorldResult<EvidenceCalibrationResult> {
    const problem = this.stores.problems.get(input.ownerId, input.problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const observations = this.stores.observations.listByProblem(input.ownerId, input.problemId);
    const prospects = this.stores.prospects.listByProblem(input.ownerId, input.problemId);
    const latest = observations[0];
    const current = problem.assessment?.opportunityScore.factors ?? [];
    const calibrated = calibrateFactors({
      problemId: problem.id,
      current,
      observation: latest,
      observations,
      prospects,
      factorKey: input.factorKey,
      direction: input.direction,
      reason: input.reason,
    });
    // Apply the bounded adjustment to the problem's stored assessment factors.
    if (calibrated.factors.length > 0 && problem.assessment) {
      const adjusted = problem.assessment.opportunityScore.factors.map((f) => {
        const moved = calibrated.factors.find((c) => c.key === f.key);
        if (!moved || moved.delta === 0) return f;
        return { ...f, value: moved.after };
      });
      const opportunityScore = scoreBusinessOpportunity(adjusted);
      problem.assessment = { ...problem.assessment, opportunityScore };
      this.stores.problems.save({
        ...problem,
        assessment: problem.assessment,
        updatedAt: this.now(),
      });
    }
    return ok(calibrated);
  }

  /** NEXT BEST ACTION (Part H) — explainable advisory; the system CAN say
   *  STOP. Composes problem assessment + evidence quality + revenue state. */
  opportunityNextBestAction(ownerId: string, problemId: string): WorldResult<NextBestAction> {
    const problem = this.stores.problems.get(ownerId, problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const observations = this.stores.observations.listByProblem(ownerId, problemId);
    const prospects = this.stores.prospects.listByProblem(ownerId, problemId);
    const quality = evidenceQuality({
      problemId,
      observations,
      prospects,
      evidence: problem.evidence,
    }).overall;
    return ok(
      nextBestAction({ problem, assessment: problem.assessment, observations, prospects, quality }),
    );
  }

  /** Opportunity comparison (Part I) — evidence-driven states; never
   *  "profitable" merely because a score is high. */
  compareOpportunities(ownerId: string, opts?: { limit?: number }): OpportunityComparison {
    const problems = this.stores.problems.list(ownerId);
    const observationsByProblem = new Map<string, FounderObservation[]>();
    const prospectsByProblem = new Map<string, CustomerDiscoveryRecord[]>();
    for (const p of problems) {
      observationsByProblem.set(p.id, this.stores.observations.listByProblem(ownerId, p.id));
      prospectsByProblem.set(p.id, this.stores.prospects.listByProblem(ownerId, p.id));
    }
    return buildOpportunityComparison({
      ownerId,
      problems,
      observationsByProblem,
      prospectsByProblem,
      now: this.now,
      limit: opts?.limit,
    });
  }

  /** Bounded drill-down for one opportunity (Part L) — PROBLEM / EVIDENCE /
   *  CUSTOMERS / EXPERIMENTS / ECONOMICS / PROVIDERS / REVENUE / DECISION. */
  opportunityDrilldown(ownerId: string, problemId: string): WorldResult<OpportunityDrilldown> {
    const problem = this.stores.problems.get(ownerId, problemId);
    if (!problem) return err('Problem not found.', 'NOT_FOUND');
    const observations = this.stores.observations.listByProblem(ownerId, problemId);
    const prospects = this.stores.prospects.listByProblem(ownerId, problemId);
    const quality = evidenceQuality({
      problemId,
      observations,
      prospects,
      evidence: problem.evidence,
    }).overall;
    return ok({
      problem,
      assessment: problem.assessment,
      observations,
      prospects,
      experiments: [], // planned experiments are composed by the existing planner on demand
      providers: undefined, // provider economics composes the fabric on demand
      nextBestAction: nextBestAction({
        problem,
        assessment: problem.assessment,
        observations,
        prospects,
        quality,
      }),
      revenueState: problem.revenueState,
      verifiedPaymentCount: problem.evidence.filter((e) => e.source === 'verified_payment').length,
      advisory: true,
    });
  }

  // ── 6. World signal interface (interfaces only — UNAVAILABLE honesty) ────

  async listSignals(_ownerId: string): Promise<WorldResult<WorldSignalSourceResult[]>> {
    const kinds: WorldSignalKind[] = [
      'market_trends',
      'startup_ideas',
      'technology_releases',
      'ai_model_releases',
      'open_source_projects',
      'pricing_changes',
      'customer_demand',
      'competitor_changes',
      'regulatory_changes',
      'job_market',
      'content_trends',
    ];
    const results: WorldSignalSourceResult[] = [];
    for (const kind of kinds) {
      if (this.signalSources.length === 0) {
        results.push({ kind, status: 'UNAVAILABLE', signals: [] });
        continue;
      }
      // A connected source either answers (AVAILABLE/… its own status) or
      // throws → ERROR. Both are truthful; a source never silently becomes
      // SUCCESS. When no source is connected the kind stays UNAVAILABLE.
      for (const source of this.signalSources) {
        try {
          const result = await source.listSignals(kind);
          results.push({ kind, ...result });
          break;
        } catch {
          // A failed source is ERROR, never SUCCESS.
          results.push({ kind, status: 'ERROR', signals: [], error: 'Source failed.' });
          break;
        }
      }
    }
    return ok(results);
  }

  // ── 7. Human vs AI responsibility boundary ───────────────────────────────

  classifyBoundary(action: string): BoundaryDecision {
    return this.boundary.classify(action);
  }

  // ── 8. Revenue intelligence (SPRINT-033 Part F) ──────────────────────────
  // Evidence-carrying revenue streams + advisory snapshot + advisory decision
  // hints. Nothing fabricated; the founder decides — nothing spends/commits.

  registerRevenueStream(input: {
    ownerId: string;
    name: string;
    kind: RevenueStream['kind'];
    status?: RevenueStream['status'];
    businessUnitId?: string;
    estimatedMonthlyRevenueUsd?: RevenueFigure;
    actualMonthlyRevenueUsd?: RevenueFigure;
    estimatedMonthlyCostUsd?: RevenueFigure;
    actualMonthlyCostUsd?: RevenueFigure;
    automationPercentage?: RevenueFigure;
    humanEffortHoursMonthly?: RevenueFigure;
    customerCount?: RevenueFigure;
    conversionRate?: RevenueFigure;
    retentionRate?: RevenueFigure;
    note?: string;
  }): WorldResult<RevenueStream> {
    const result = this.revenue.register(input);
    return result.success ? ok(result.data) : err(result.error, result.code);
  }

  listRevenueStreams(ownerId: string): WorldResult<RevenueStream[]> {
    return ok(this.revenue.list(ownerId));
  }

  removeRevenueStream(ownerId: string, id: string): WorldResult<{ removed: boolean }> {
    const result = this.revenue.remove(ownerId, id);
    return result.success ? ok(result.data) : err(result.error, result.code);
  }

  revenueSnapshot(ownerId: string): RevenueSnapshot {
    return this.revenue.snapshot(ownerId);
  }

  revenueDecisions(ownerId: string): RevenueDecisionHint[] {
    return this.revenue.decide(ownerId);
  }

  // ── 9. Founder briefing (SPRINT-033 Part A) — advisory, no-spam ──────────

  async founderBriefing(ownerId: string): Promise<WorldResult<FounderBriefing>> {
    const posture = this.control.autonomyPosture(ownerId);
    const pipeline = this.opportunityPipeline(ownerId);
    const revenue = this.revenue.snapshot(ownerId);
    const signals = await this.listSignals(ownerId);
    // Recent observations — bounded, per-owner (what changed).
    const recent = this.stores.entities
      .list(ownerId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 5);
    if (!pipeline.success) return err(pipeline.error, pipeline.code);
    const briefing = buildFounderBriefing({
      ownerId,
      generatedAt: this.now(),
      pendingApprovals: pipeline.data
        .filter((entry) => entry.approvalRequired && entry.status !== 'APPROVED')
        .map((entry) => ({ title: entry.title, category: entry.category, status: entry.status })),
      pipeline: pipeline.data,
      revenue: {
        streamCount: revenue.streamCount,
        totalEstimatedMonthlyRevenueUsd: revenue.totalEstimatedMonthlyRevenueUsd,
      },
      cost: this.fabric.costSnapshot(ownerId),
      posture,
      recentChanges: recent,
      signals: signals.success ? signals.data : [],
    });
    return ok(briefing);
  }

  // ── 10. Workflow execution blueprint (SPRINT-033 Part E) ──────────────────
  // The CONTROLLED Opportunity → approval → workflow → selection → execution
  // (existing bridge) → verification → outcome path. A blueprint is a
  // REPRESENTATION — `executed:false` + `authorizationRequired:true` are
  // structural; nothing here runs, spends or approves.

  buildExecutionBlueprint(input: {
    ownerId: string;
    sourceTitle: string;
    sourceGoal: string;
    businessUnitId?: string;
    steps: Array<{
      id: string;
      label: string;
      capability?: string;
      roleName?: string;
      verificationRequirement?: string;
      dependsOn: string[];
    }>;
    estimatedCostUsd?: RevenueFigure;
  }): WorldResult<WorkflowExecutionBlueprint> {
    const result = this.blueprintFactory.build(input);
    return result.success ? ok(result.data) : err(result.error, result.code);
  }

  // ── 11. Outcome evidence & revenue → outcome feedback (SPRINT-034) ────────
  // The ONLY path by which actual outcomes may influence future scoring:
  // verified, evidence-carrying records only. UNKNOWN stays UNKNOWN; one
  // outcome never rewrites policy (bounded deltas).

  /** Record VERIFIED outcome evidence (actuals are VERIFIED-only). */
  recordOutcomeEvidence(input: {
    ownerId: string;
    kind: OutcomeEvidence['kind'];
    opportunityId?: string;
    workflowId?: string;
    businessUnitId?: string;
    category?: string;
    expected?: { value: number; status: 'ESTIMATED'; evidence: string[] };
    actual?: { value: number; status: 'VERIFIED'; evidence: string[] };
    verificationStatus: OutcomeEvidence['verificationStatus'];
    evidence: string[];
    source?: string;
  }): WorldResult<OutcomeEvidence> {
    const result = this.outcomeModel.record(input, this.now);
    if (!result.success) return err(result.error, result.code);
    // Stable-key idempotency: re-recording the same (kind, target) upserts.
    const existing = this.stores.outcomeEvidence.getByKey(input.ownerId, result.data.stableKey);
    const record = { ...result.data, id: existing?.id ?? result.data.id };
    this.stores.outcomeEvidence.save(record);
    return ok(record);
  }

  listOutcomeEvidence(ownerId: string): WorldResult<OutcomeEvidence[]> {
    return ok(this.stores.outcomeEvidence.list(ownerId));
  }

  /** Apply ONE verified outcome record as bounded feedback — returns the
   *  (clamped) factor adjustments with their evidence. Never applied when the
   *  record is not VERIFIED; never exceeds FEEDBACK_DELTA_MAX per step. */
  applyOutcomeFeedback(ownerId: string, evidenceId: string): WorldResult<OutcomeFeedbackResult> {
    const evidence = this.stores.outcomeEvidence.get(ownerId, evidenceId);
    if (!evidence) return err('Outcome evidence not found.', 'NOT_FOUND');
    const result = this.outcomeModel.applyFeedback(
      evidence,
      this.stores.outcomeEvidence.list(ownerId).map((e) => ({ key: e.kind, value: undefined })),
      this.now,
    );
    return ok(result);
  }

  /** SPRINT-034 (Part 6) — bounded feedback into future evaluations. Verified
   *  outcome evidence for a category nudges matching factor inputs by at most
   *  FEEDBACK_DELTA_MAX toward the observed direction; every adjustment is
   *  evidence-attached. One outcome never rewrites global policy. */
  private applyOutcomeFeedbackToFactors(
    ownerId: string,
    category: string | undefined,
    factors: FactorInput[],
  ): { factors: FactorInput[]; adjustments: OutcomeFeedbackResult['adjustments'] } {
    if (!category) return { factors, adjustments: [] };
    const evidence = this.stores.outcomeEvidence
      .list(ownerId)
      .filter((e) => e.verificationStatus === 'VERIFIED' && e.category === category);
    if (evidence.length === 0) return { factors, adjustments: [] };
    const adjustments: OutcomeFeedbackResult['adjustments'] = [];
    let adjusted = [...factors];
    for (const record of evidence) {
      const result = this.outcomeModel.applyFeedback(record, adjusted, this.now);
      if (!result.applied) continue;
      for (const adjustment of result.adjustments) {
        adjusted = adjusted.map((f) =>
          f.key === adjustment.factor
            ? {
                ...f,
                value: adjustment.next,
                status: f.status === 'UNKNOWN' ? 'ESTIMATED' : f.status,
                evidence: [...f.evidence, ...adjustment.evidence].slice(0, 4),
              }
            : f,
        );
        adjustments.push(adjustment);
      }
    }
    return { factors: adjusted, adjustments };
  }

  // ── 12. Blueprint → approval-gated execution (SPRINT-034) ─────────────────
  // A blueprint produces an approval request; the DECISION goes exclusively
  // through the EXISTING approval authority (WorldApprovalPort → Brain). The
  // blueprint/request NEVER executes — `executed:false` is structural and no
  // alternate execution path exists.

  /** Build + register an approval request for a gated blueprint step. Also
   *  registers the sensitive action with the EXISTING approval authority. */
  requestBlueprintApproval(input: {
    ownerId: string;
    blueprint: WorkflowExecutionBlueprint;
    stepId: string;
    workflowId?: string;
    providerId?: string;
    estimatedCostUsd?: {
      value: number;
      status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
      evidence: string[];
    };
    dataScope?: string;
    expectedOutcome?: string;
  }): WorldResult<BlueprintApprovalRequest> {
    const step = input.blueprint.steps.find((s) => s.id === input.stepId);
    if (!step) return err('Blueprint step not found.', 'NOT_FOUND');
    const built = this.approvalFactory.build({
      ownerId: input.ownerId,
      blueprint: input.blueprint,
      step,
      workflowId: input.workflowId,
      providerId: input.providerId,
      estimatedCostUsd: input.estimatedCostUsd,
      dataScope: input.dataScope,
      expectedOutcome: input.expectedOutcome,
    });
    if (!built.success) return err(built.error, built.code);
    if (!this.approvalPort) {
      return err(
        'The existing approval authority is not configured.',
        'APPROVAL_AUTHORITY_UNAVAILABLE',
      );
    }
    // Register the action with the EXISTING authority (Brain) — the only place
    // a sensitive action is ever registered for approval.
    const registered = this.approvalPort.requestApproval({
      userId: input.ownerId,
      taskId: input.blueprint.id,
      action: step.label,
    });
    const existing = this.stores.blueprintApprovals.getByKey(input.ownerId, built.data.stableKey);
    const request: BlueprintApprovalRequest = {
      ...built.data,
      id: existing?.id ?? built.data.id,
      authorityTaskId: registered.success ? registered.data?.taskId : undefined,
      status: existing?.status ?? 'WAITING_FOR_APPROVAL',
      updatedAt: this.now(),
    };
    this.stores.blueprintApprovals.save(request);
    return ok(request);
  }

  listBlueprintApprovals(ownerId: string): WorldResult<BlueprintApprovalRequest[]> {
    return ok(this.stores.blueprintApprovals.list(ownerId));
  }

  /** Decide a blueprint approval THROUGH the existing authority. The world
   *  model records the decision exactly as the authority recorded it — it can
   *  never approve or reject on its own, and it can never mark a blueprint
   *  executed. */
  decideBlueprintApproval(input: {
    ownerId: string;
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    note?: string;
  }): WorldResult<BlueprintApprovalRequest> {
    const request = this.stores.blueprintApprovals.get(input.ownerId, input.requestId);
    if (!request) return err('Approval request not found.', 'NOT_FOUND');
    if (request.status !== 'WAITING_FOR_APPROVAL') {
      return err('This approval request is already decided.', 'ALREADY_DECIDED');
    }
    if (!this.approvalPort) {
      return err(
        'The existing approval authority is not configured.',
        'APPROVAL_AUTHORITY_UNAVAILABLE',
      );
    }
    const taskId = request.authorityTaskId ?? request.blueprintId;
    if (input.decision === 'APPROVED') {
      const decision = this.approvalPort.approve({
        userId: input.ownerId,
        taskId,
        action: request.action,
      });
      if (!decision.success || !decision.data)
        return err(decision.error ?? 'Approval refused.', 'APPROVAL_REFUSED');
      const updated: BlueprintApprovalRequest = {
        ...request,
        status: 'APPROVED',
        decision: { ...decision.data, note: input.note },
        updatedAt: this.now(),
      };
      this.stores.blueprintApprovals.save(updated);
      return ok(updated);
    }
    const decision = this.approvalPort.reject({
      userId: input.ownerId,
      taskId,
      action: request.action,
    });
    if (!decision.success) return err(decision.error ?? 'Rejection refused.', 'REJECTION_REFUSED');
    const updated: BlueprintApprovalRequest = {
      ...request,
      status: 'REJECTED',
      decision: {
        grantedBy: input.ownerId,
        grantedAt: this.now(),
        scope: `rejected:${request.action}`,
        note: input.note,
      },
      updatedAt: this.now(),
    };
    this.stores.blueprintApprovals.save(updated);
    return ok(updated);
  }

  // ── 13. Cost-weighted revenue intelligence (SPRINT-034) ───────────────────

  /** Margin-aware revenue ranking composing CostLedger evidence. UNKNOWN
   *  revenue/cost is NEVER zero; entries without both evidence sides are
   *  listed with their assumptions, never ranked. */
  revenueRanking(ownerId: string): RevenueRanking {
    return this.costWeighted.rank(ownerId, this.revenue.list(ownerId));
  }

  // ── 13b. SPRINT-035 — signal health (honest per-source state) ────────────
  // Composes the adapters' own health records — the world model never invents
  // a "live" status. Unconfigured sources report UNAVAILABLE by the adapter.
  signalHealth(_ownerId: string): SignalHealthEntry[] {
    const perKind = new Map<string, SignalHealthEntry>();
    for (const source of this.signalSources) {
      if (!source.health) continue;
      for (const entry of source.health()) {
        const prior = perKind.get(entry.kind);
        // Multiple sources: a kind is AVAILABLE if ANY source observed it;
        // otherwise prefer ERROR over UNAVAILABLE (the most informative).
        if (
          !prior ||
          entry.status === 'AVAILABLE' ||
          (prior.status === 'UNAVAILABLE' && entry.status === 'ERROR')
        ) {
          perKind.set(entry.kind, entry);
        }
      }
    }
    return [...perKind.values()];
  }

  // ── 13c. SPRINT-035 — bounded owner-scoped timeline ───────────────────────
  // Composed from the EXISTING owner-scoped stores (opportunity lifecycle,
  // outcome evidence, blueprint approvals, revenue streams). NO new event
  // store. Bounded + paginated — never an unbounded history query.
  buildTimeline(ownerId: string, opts?: { limit?: number; offset?: number }): TimelineResult {
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const events: TimelineEvent[] = [];
    const seen = new Set<string>();
    const push = (
      event: Omit<TimelineEvent, 'eventId' | 'stableKey'> & {
        stableKey: string;
        type: TimelineEventType;
        at: string;
        label: string;
      },
    ): void => {
      if (seen.has(event.stableKey)) return; // idempotent — never duplicated
      seen.add(event.stableKey);
      events.push({
        eventId: `ev-${event.stableKey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}-${events.length}`,
        type: event.type,
        label: event.label,
        status: event.status,
        at: event.at,
        stableKey: event.stableKey,
      });
    };

    for (const record of this.control.listOpportunities(ownerId)) {
      push({
        type: 'OPPORTUNITY',
        label: record.title.slice(0, 160),
        status: record.status,
        at: record.updatedAt || record.createdAt,
        stableKey: `opportunity:${record.id}`,
      });
    }
    for (const evidence of this.stores.outcomeEvidence.list(ownerId)) {
      push({
        type: 'OUTCOME',
        label: `${evidence.kind} outcome${evidence.category ? ` · ${evidence.category}` : ''}`,
        status: evidence.verificationStatus,
        at: evidence.recordedAt,
        stableKey: `outcome:${evidence.stableKey}`,
      });
    }
    for (const approval of this.stores.blueprintApprovals.list(ownerId)) {
      push({
        type: 'APPROVAL',
        label: approval.action.slice(0, 160),
        status: approval.status,
        at: approval.updatedAt || approval.createdAt,
        stableKey: `approval:${approval.stableKey}`,
      });
    }
    for (const stream of this.revenue.list(ownerId)) {
      push({
        type: 'REVENUE',
        label: stream.name.slice(0, 160),
        status: stream.status,
        at: stream.updatedAt || stream.createdAt,
        stableKey: `revenue:${stream.stableKey}`,
      });
    }

    const sorted = events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const page = sorted.slice(offset, offset + limit);
    return {
      ownerId,
      events: page,
      hasMore: offset + page.length < sorted.length,
      offset,
      limit,
    };
  }

  // ── 14. Founder Command Center (SPRINT-034) — presentation-only ───────────
  // Composes the EXISTING read models (overview, founder briefing, revenue
  // snapshot, opportunity pipeline, blueprint approvals, cost). No new engine.

  async commandCenter(ownerId: string): Promise<CommandCenterView> {
    const briefing = await this.founderBriefing(ownerId);
    const overview = await this.overview(ownerId);
    const revenue = this.revenue.snapshot(ownerId);
    const pipeline = this.opportunityPipeline(ownerId);
    const approvals = this.stores.blueprintApprovals.list(ownerId);
    const cost = this.fabric.costSnapshot(ownerId);
    // SPRINT-035 — advisory revenue-vs-cost line: shown ONLY where both sides
    // have evidence; UNKNOWN otherwise. A margin/ROI is NEVER claimed here.
    const monthlyRevenue =
      revenue.totalActualMonthlyRevenueUsd ?? revenue.totalEstimatedMonthlyRevenueUsd;
    const revenueVsCost: { label: string; status: ObservationStatus } =
      monthlyRevenue !== undefined && cost.dailyUsd !== undefined
        ? {
            label: `monthly revenue ${monthlyRevenue.toFixed(2)} USD vs measured cost ${cost.dailyUsd.toFixed(3)} USD/day — figures only, margin never claimed without evidence`,
            status: revenue.totalActualMonthlyRevenueUsd !== undefined ? 'VERIFIED' : 'ESTIMATED',
          }
        : { label: 'No evidence-backed revenue or measured cost figures', status: 'UNKNOWN' };
    return {
      ownerId,
      generatedAt: this.now(),
      advisory: true,
      today: {
        briefingHasContent: briefing.success ? briefing.data.hasContent : false,
        pendingApprovals: briefing.success ? briefing.data.today.pendingApprovals : [],
        highRiskOpportunities: briefing.success ? briefing.data.today.highRiskOpportunities : 0,
        attention: briefing.success ? briefing.data.attention : [],
        changes: briefing.success ? briefing.data.whatChanged : [],
        emergencyStopEngaged: overview.emergencyStopEngaged,
        settingsConfirmed: overview.settingsConfirmed,
      },
      portfolio: {
        businessUnits: overview.businessUnits,
        revenueStreams: revenue.streamCount,
        activeRevenueStreams: revenue.activeStreamCount,
        totalEstimatedMonthlyRevenueUsd: revenue.totalEstimatedMonthlyRevenueUsd,
        totalActualMonthlyRevenueUsd: revenue.totalActualMonthlyRevenueUsd,
        costDailyUsd: cost.dailyUsd,
        costProviderUsd: cost.providerUsd,
        revenueVsCost,
        pipelineOpportunities: pipeline.success ? pipeline.data.length : 0,
      },
      intelligence: {
        signals: overview.signals,
        signalHealth: this.signalHealth(ownerId),
        entityCount: overview.entityCount,
        relationCount: overview.relationCount,
      },
      automation: {
        workflows: this.stores.workflows.list(ownerId).length,
        blueprintApprovals: approvals.map((a) => ({
          id: a.id,
          blueprintId: a.blueprintId,
          action: a.action,
          status: a.status,
        })),
        // SPRINT-037 — orchestration plans with honest status/approval state.
        // `approved` is true ONLY when the existing Brain authority recorded a
        // grant (plan.approval present) — a PLANNED plan is never presented
        // as runnable.
        orchestrationPlans: this.stores.orchestrationPlans.list(ownerId).map((p) => ({
          id: p.id,
          goal: p.goal,
          strategy: p.strategy,
          status: p.status,
          approved: p.status === 'APPROVED' && p.approval !== undefined,
          steps: p.steps.length,
        })),
      },
      approvals: approvals
        .filter((a) => a.status === 'WAITING_FOR_APPROVAL')
        .map((a) => ({
          id: a.id,
          action: a.action,
          reason: a.reason,
          businessUnitId: a.businessUnitId,
          workflowId: a.workflowId,
          providerId: a.providerId,
          estimatedCostUsd: a.estimatedCostUsd?.value,
          riskLevel: a.riskLevel,
          expectedOutcome: a.expectedOutcome,
          reversibility: a.reversibility,
          authorityRequired: a.authorityRequired,
        })),
    };
  }

  // ── 15. The composed overview (bounded snapshot) ─────────────────────────

  async overview(ownerId: string): Promise<WorldOverview> {
    const posture = this.control.autonomyPosture(ownerId);
    const lifecycle = this.control.listOpportunities(ownerId);
    const pipeline = this.opportunityPipeline(ownerId);
    const signals = await this.listSignals(ownerId);
    return {
      ownerId,
      observedAt: this.now(),
      entities: this.stores.entities.countByType(ownerId),
      entityCount: this.stores.entities.count(ownerId),
      relationCount: this.stores.relations.count(ownerId),
      businessUnits: this.stores.businessUnits.list(ownerId).length,
      roles: this.stores.roles.list(ownerId).length,
      activeOpportunities: lifecycle.filter(
        (o) => o.status !== 'REJECTED' && o.status !== 'COMPLETED',
      ).length,
      pipelineEntries: pipeline.success ? pipeline.data.length : 0,
      signals: (signals.success ? signals.data : []).slice(0, MAX_OVERVIEW_SIGNALS).map((s) => ({
        kind: s.kind,
        status: s.status,
      })),
      emergencyStopEngaged: posture.emergencyStopEngaged,
      autonomyLevel: posture.autonomyLevel,
      settingsConfirmed: posture.settingsConfirmed,
      bounded: true,
    };
  }
}

function mapRisk(risk: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
  if (risk === 'LOW' || risk === 'MEDIUM' || risk === 'HIGH') return risk;
  return 'UNKNOWN';
}

function mapStatus(status: string): 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' {
  if (status === 'VERIFIED' || status === 'ESTIMATED') return status;
  return 'UNKNOWN';
}

/** The category an evaluation is scored under: the normalized input category
 *  when provided, otherwise the assessor's own category. Outcome feedback is
 *  scoped to this value (bounded, evidence-only). */
function evaluationCategory(
  inputCategory: string | undefined,
  assessedCategory: string,
): string | undefined {
  const category = inputCategory ? normalizeOpportunityCategory(inputCategory) : assessedCategory;
  return category.trim().length > 0 ? category.slice(0, 120) : undefined;
}

/** Count VERIFIED payment evidence records — the ONLY revenue-verification
 *  path (Part J). Interest / intent / proposals / invoices never count. */
function verifiedPaymentCount(evidence: ProblemEvidence[]): number {
  return evidence.filter((e) => e.source === 'verified_payment').length;
}

/** Simple capital-mode classification from a RevenueFigure — NO_COST when the
 *  evidence says zero; LOW_COST when the figure is small; otherwise
 *  CAPITAL_REQUIRED; UNKNOWN when there is no evidence. Never fabricated. */
function classifyCapitalModeSimple(figure: RevenueFigure, _status: ObservationStatus): CapitalMode {
  if (figure.status === 'UNKNOWN') return 'UNKNOWN';
  if (figure.value <= 0) return 'NO_COST';
  if (figure.value <= 100) return 'LOW_COST';
  return 'CAPITAL_REQUIRED';
}
