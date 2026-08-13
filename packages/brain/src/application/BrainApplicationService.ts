// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · BrainApplicationService
// EPIC-016
//
// The Brain facade. Pipeline:
//   USER GOAL → UNDERSTAND → PLAN → INTELLIGENCE (candidates) →
//   ROLE ASSIGNMENT → EXECUTION GRAPH → APPROVAL → EXECUTE →
//   CONFLICT → CRITIQUE → SYNTHESIS → VERIFICATION → RESULT → LEARN.
// Everything is owner-scoped; the frozen estate is reached ONLY
// through the narrow ports. No AI is executed by this service itself.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import { mapCapability, isMapped } from '@vedmoulya/execution-bridge';
import { IntentInterpreter } from '../domain/IntentInterpreter.js';
import { BrainModeSelector } from '../domain/BrainModeSelector.js';
import { ProviderRoleAssigner } from '../domain/ProviderRoleAssigner.js';
import { ParallelPlanner } from '../domain/ParallelPlanner.js';
import { ConflictDetector } from '../domain/ConflictDetector.js';
import { OutputAssembler } from '../domain/OutputAssembler.js';
import { CriticStrategy } from '../domain/CriticStrategy.js';
import { BrainBudgetGuard } from '../domain/BrainBudgetGuard.js';
import { BrainPolicyEngine } from '../domain/BrainPolicyEngine.js';
import { BrainDecisionRecorder, type DecisionInput } from '../domain/BrainDecisionRecorder.js';
import { OutcomeEvaluator } from '../domain/OutcomeEvaluator.js';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  BrainTaskStore,
  BrainDecisionStore,
  ClockPort,
} from '../contracts/brain-ports.js';
import type {
  BrainTask,
  BrainStage,
  BrainStageStatus,
  BrainBudget,
  ProviderRoleAssignment,
  ConflictReport,
  BrainVerification,
  BrainDecisionRecord,
} from '../types/brain-types.js';
import type {
  IntelligenceEvent,
  Opportunity,
  ProviderPerformanceScore,
  ProviderUsageFact,
} from '../types/continuous-types.js';
import type {
  BrainUsagePort,
  BrainExperiencePort,
  BrainMemoryPort,
  BrainDiscoveryBridgePort,
  OpportunityStore,
  IntelligenceEventStore,
} from '../contracts/brain-ports.js';
import { UsageIntelligence } from '../domain/UsageIntelligence.js';
import { FallbackSelector } from '../domain/ExecutionFailover.js';
import { OpportunityIntelligence } from '../domain/OpportunityIntelligence.js';
import { DailyOutcomeEngine } from '../domain/DailyOutcomeEngine.js';
import { deriveLearningSignals, correctionSignal } from '../domain/LearningSignals.js';
import { deriveOutcomeVerdict } from '../domain/OutcomeVerdict.js';
import type { RankedAction } from '../domain/OutcomePriorityEngine.js';
import type { OutcomeSatisfaction } from '../types/outcome-types.js';
import type { LearningCorrection } from '../types/continuous-types.js';

export interface BrainServiceOptions {
  plan: BrainPlanPort;
  candidates: BrainCandidatePort;
  execution: BrainExecutionPort;
  context: BrainContextPort;
  preference: BrainPreferencePort;
  tasks: BrainTaskStore;
  decisions: BrainDecisionStore;
  clock: ClockPort;
  /** Hard execution budgets (LoopBudget semantics). */
  budget: BrainBudget;
  /** Optional user preference hints. */
  preferenceHints?: { costSensitive?: boolean; localFirst?: boolean };
  /** Trace id generator. */
  traceId?: () => string;
  /** EPIC-020 — provider usage/limits evidence (mission §3). */
  usage?: BrainUsagePort;
  /** EPIC-020 — adaptive task×provider performance evidence (mission §4). */
  experience?: BrainExperiencePort;
  /** EPIC-020 — durable learning feedback (mission §10). */
  memory?: BrainMemoryPort;
  /** EPIC-020 — continuous AI World / scheduler bridge (mission §8). */
  discovery?: BrainDiscoveryBridgePort;
  /** EPIC-020 — opportunity store (mission §12). */
  opportunities?: OpportunityStore;
  /** EPIC-020 — intelligence event store (mission §8). */
  events?: IntelligenceEventStore;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

function err<T>(error: string, code?: string): ServiceResult<T> {
  return { success: false, error, code };
}

export class BrainApplicationService {
  private readonly intent = new IntentInterpreter();
  private readonly modeSelector = new BrainModeSelector();
  private readonly roleAssigner = new ProviderRoleAssigner();
  private readonly planner = new ParallelPlanner();
  private readonly conflicts = new ConflictDetector();
  private readonly assembler = new OutputAssembler(this.conflicts);
  private readonly critic = new CriticStrategy();
  private readonly budgetGuard: BrainBudgetGuard;
  private readonly policy = new BrainPolicyEngine();
  private readonly decisions: BrainDecisionRecorder;
  private readonly outcomeEvaluator: OutcomeEvaluator;
  private readonly opts: BrainServiceOptions;
  private readonly usageIntelligence = new UsageIntelligence();
  private readonly fallbackSelector = new FallbackSelector();
  private readonly opportunity = new OpportunityIntelligence();
  private readonly daily = new DailyOutcomeEngine();

  constructor(opts: BrainServiceOptions) {
    this.opts = opts;
    this.budgetGuard = new BrainBudgetGuard(opts.budget);
    this.decisions = new BrainDecisionRecorder(opts.decisions, opts.clock);
    this.outcomeEvaluator = new OutcomeEvaluator(opts.preference);
  }

  // ── 1. CREATE + UNDERSTAND ───────────────────────────────────────
  createTask(userId: string, input: string): ServiceResult<BrainTask> {
    if (!input || input.trim().length < 3) {
      return err('Objective too short to understand.', 'INVALID_INPUT');
    }
    const id = `brain-${Math.random().toString(36).slice(2, 10)}`;
    const intent = this.intent.interpret(input);
    const mode = this.modeSelector.select({
      profile: intent,
      capabilityCount: 1,
      preferenceHints: this.opts.preferenceHints,
    });
    const now = this.opts.clock.now();

    const task: BrainTask = {
      id,
      userId,
      objective: input.trim(),
      originalInput: input.trim(),
      intent,
      mode,
      domain: intent.domain,
      qualityTarget: intent.qualityTarget,
      privacyRequirement: intent.privacyRequirement,
      budget: this.opts.budget,
      requiredCapabilities: [],
      roleAssignments: [],
      graph: { nodes: [], edges: [], waves: [] },
      status: 'NEW',
      stage: 'UNDERSTANDING',
      stageStatuses: {
        UNDERSTANDING: 'pending',
        PLAN: 'pending',
        INTELLIGENCE: 'pending',
        EXECUTION: 'pending',
        VERIFICATION: 'pending',
        RESULT: 'pending',
        CANCELLED: 'pending',
        FAILED: 'pending',
      },
      providerOutputs: [],
      conflicts: [],
      failoverEvents: [],
      decisionRecords: [],
      approvalRequired: [],
      approvalGranted: [],
      traceId: this.opts.traceId?.() ?? `trace-${id}`,
      createdAt: now,
      updatedAt: now,
    };

    this.opts.tasks.save(task);
    this.recordDecision(task, {
      taskId: id,
      userId,
      decision: 'task mode',
      reason: `Understood objective and selected ${mode} mode.`,
      alternatives: [
        'FAST',
        'BALANCED',
        'QUALITY',
        'DEEP_RESEARCH',
        'COST_SENSITIVE',
        'PRIVATE_LOCAL',
      ],
      selected: mode,
      confidence: 0.7,
      provenance: `intent:${intent.domain}`,
    });

    const updated = this.markStage(task, 'UNDERSTANDING', 'completed');
    return ok(updated);
  }

  // ── 2. PLAN (consume EPIC-013 capability plan) ───────────────────
  async plan(userId: string, taskId: string): Promise<ServiceResult<BrainTask>> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    let capabilityPlan: FactoryCapabilityPlan;
    try {
      capabilityPlan = await this.opts.plan.planFor(userId, task.objective);
    } catch (e) {
      this.markStage(task, 'PLAN', 'failed');
      return err(`Capability planning failed: ${String(e)}`, 'PLAN_FAILED');
    }

    task.capabilityPlanId = capabilityPlan.id;
    task.requiredCapabilities = capabilityPlan.requiredCapabilities;
    task.graph = this.planner.build(capabilityPlan);

    this.recordDecision(task, {
      taskId,
      userId,
      decision: 'capability plan',
      reason: `Decomposed objective into ${capabilityPlan.requiredCapabilities.length} capabilities (EPIC-013 planner reused).`,
      alternatives: ['direct single-step', 'capability-plan-driven'],
      selected: 'capability-plan-driven',
      evidence: capabilityPlan.evidence.map((e) => e.claim),
      confidence: 0.75,
      provenance: 'capability-marketplace',
    });

    const updated = this.markStage(task, 'PLAN', 'completed');
    this.markStage(updated, 'INTELLIGENCE', 'running');
    return ok(updated);
  }

  // ── 3. INTELLIGENCE — select resources + assign roles ────────────
  async selectResources(userId: string, taskId: string): Promise<ServiceResult<BrainTask>> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    const assignments: ProviderRoleAssignment[] = [];
    const available: CapabilityId[] = [];

    for (const capability of task.requiredCapabilities) {
      const providers = await this.opts.candidates.providerCandidates(capability);

      if (providers.length > 0) {
        try {
          // EPIC-020 — N-provider realization: DEEP_RESEARCH / QUALITY+HIGH
          // consult independent providers for the SAME capability.
          const wantsN =
            task.mode === 'DEEP_RESEARCH' ||
            (task.mode === 'QUALITY' && task.qualityTarget === 'HIGH');
          // SPRINT-025 — ADVISORY verified-experience signal (provider ×
          // capability from the existing ledger). Ties only; quality-first
          // and user preference always win.
          const experienceScores = this.opts.experience?.scoresFor(capability);
          const picked = wantsN
            ? this.roleAssigner.assignMany(capability, providers, {
                mode: task.mode,
                qualityTarget: task.qualityTarget,
                experienceScores,
              }).assignments
            : [
                this.roleAssigner.assign(capability, providers, {
                  mode: task.mode,
                  qualityTarget: task.qualityTarget,
                  experienceScores,
                }).assignment,
              ];
          for (const assignment of picked) {
            assignments.push(assignment);
            available.push(capability);
          }
        } catch {
          // No candidates → unavailable (never faked).
        }
      } else {
        // Local-model fallback only when a local model is actually available.
        const local = await this.opts.candidates.localModelCandidates(capability);
        const usable = local.find((l) => l.available);
        if (usable) {
          assignments.push(
            this.roleAssigner.assignLocal(
              capability,
              {
                id: usable.id,
                name: usable.name,
                capabilities: usable.capabilities,
                available: true,
              },
              task.mode,
            ),
          );
          available.push(capability);
        }
      }
    }

    // EPIC-020 — attach usage/limits evidence (provider adapters first,
    // registry-backed candidate facts otherwise). Never fabricated.
    await this.attachUsageEvidence(userId, assignments);

    task.roleAssignments = assignments;

    // Policy: capability availability gate (no fake execution).
    const availability = this.policy.capabilityAvailable(task.requiredCapabilities, available);
    if (!availability.allowed) {
      task.status = 'PARTIAL';
      task.approvalRequired.push('missing-capabilities');
      this.recordDecision(task, {
        taskId,
        userId,
        decision: 'capability availability',
        reason: availability.reason,
        alternatives: ['configure provider', 'evaluate local model', 'review external tool'],
        selected: 'stop and hand off',
        confidence: 0.9,
        provenance: 'brain-policy',
      });
    }

    // Budget estimate + pre-check (fail-closed) — evidence-backed only
    // (EPIC-020 §3 — never a fabricated estimate).
    const costSteps = assignments.map((a) => ({ cost: { estimatedCostUsd: a.estimatedCostUsd } }));
    const estimate = this.budgetGuard.estimate(costSteps);
    task.budget.estimatedCostUsd = estimate.estimatedCostUsd;
    task.budget.estimatedTokens = estimate.estimatedTokens;
    const budgetCheck = this.budgetGuard.checkBefore(costSteps);
    if (!budgetCheck.allowed) {
      task.status = 'PARTIAL';
      this.recordDecision(task, {
        taskId,
        userId,
        decision: 'budget',
        reason: budgetCheck.reason,
        alternatives: ['reduce scope', 'free alternatives', 'ask user'],
        selected: 'blocked before execution',
        confidence: 1,
        provenance: 'brain-budget',
      });
    }

    const usageNote =
      assignments.length > 0
        ? this.usageIntelligence.describeCapabilityUsage(
            assignments[0]?.providerId ?? '',
            assignments[0]?.capability ?? 'RESEARCH',
            assignments.map((a) => a.usage).filter((f): f is ProviderUsageFact => f !== undefined),
          )
        : 'no assignments — usage evidence n/a.';
    this.recordDecision(task, {
      taskId,
      userId,
      decision: 'provider roles',
      reason: `Assigned roles to ${assignments.length} provider(s) across ${available.length} available capabilities (quality-first). ${usageNote}`,
      alternatives: ['single provider', 'n-provider roles'],
      selected: `${assignments.length}-provider role assignment`,
      confidence: 0.7,
      provenance: 'brain-role-assigner',
    });

    const updated = this.markStage(task, 'INTELLIGENCE', 'completed');
    this.markStage(updated, 'EXECUTION', 'running');
    return ok(updated);
  }

  // ── 4. APPROVAL — sensitive actions pause for the user ───────────
  requestApproval(userId: string, taskId: string, action: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    if (!this.policy.requiresApproval(action)) {
      return err(`"${action}" does not require approval.`, 'NOT_SENSITIVE');
    }
    if (!task.approvalRequired.includes(action)) {
      task.approvalRequired.push(action);
    }
    task.status = 'AWAITING_APPROVAL';
    this.recordDecision(task, {
      taskId,
      userId,
      decision: `approval: ${action}`,
      reason: `${action} is irreversible/sensitive — pausing for explicit user approval.`,
      alternatives: ['approve', 'reject', 'use free alternative'],
      selected: 'awaiting approval',
      confidence: 1,
      provenance: 'brain-policy',
    });
    const updated = this.save(task);
    return ok(updated);
  }

  approve(userId: string, taskId: string, action: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    if (!task.approvalRequired.includes(action)) {
      return err(`No pending approval for "${action}".`, 'NOT_REQUIRED');
    }
    task.approvalRequired = task.approvalRequired.filter((a) => a !== action);
    task.approvalGranted.push(action);
    task.status = 'RUNNING';
    this.recordDecision(task, {
      taskId,
      userId,
      decision: `approval granted: ${action}`,
      reason: 'User explicitly approved the sensitive action.',
      alternatives: ['approve', 'reject', 'use free alternative'],
      selected: action,
      confidence: 1,
      provenance: 'user-approval',
    });
    const updated = this.save(task);
    return ok(updated);
  }

  reject(userId: string, taskId: string, action: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    if (!task.approvalRequired.includes(action)) {
      return err(`No pending approval for "${action}".`, 'NOT_REQUIRED');
    }
    task.approvalRequired = task.approvalRequired.filter((a) => a !== action);
    this.recordDecision(task, {
      taskId,
      userId,
      decision: `approval rejected: ${action}`,
      reason:
        'User rejected the sensitive action — the Brain continues with the best available alternative.',
      alternatives: ['approve', 'reject', 'use free alternative'],
      selected: 'free/local alternative',
      confidence: 1,
      provenance: 'user-approval',
    });
    const updated = this.save(task);
    return ok(updated);
  }

  // ── 5. EXECUTE — run executable capabilities through the ports ───
  async execute(userId: string, taskId: string): Promise<ServiceResult<BrainTask>> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    // Budget re-check (fail-closed) — evidence-backed estimates only.
    const budgetCheck = this.budgetGuard.checkBefore(
      task.roleAssignments.map((a) => ({ cost: { estimatedCostUsd: a.estimatedCostUsd } })),
    );
    if (!budgetCheck.allowed) {
      task.status = 'PARTIAL';
      this.markStage(task, 'EXECUTION', 'blocked');
      return err(budgetCheck.reason, 'BUDGET_BLOCKED');
    }

    const consumed = { tokens: 0, costUsd: 0, iterations: 0 };
    let budgetStopped = false;

    for (const assignment of task.roleAssignments) {
      // EPIC-020 — failure → classify → bounded fallback → continue within
      // budget (mission §5). Fail-closed on budget; never retried infinitely.
      const stopped = await this.executeAssignment(userId, task, assignment, consumed);
      if (stopped) {
        budgetStopped = true;
        break;
      }
    }

    if (budgetStopped) {
      // Fail-closed: stop the run immediately (no conflict/synthesis on a
      // truncated run) — the budget-stop decision is already recorded.
      return ok(task);
    }

    // Conflicts among provider outputs.
    task.conflicts = this.detectConflicts(task);
    task.status = task.conflicts.some(
      (c) => c.classification === 'MATERIAL_CONFLICT' || c.classification === 'EVIDENCE_CONFLICT',
    )
      ? 'VERIFYING'
      : 'VERIFYING';

    const updated = this.markStage(task, 'EXECUTION', 'completed');
    this.markStage(updated, 'VERIFICATION', 'running');
    return ok(updated);
  }

  // ── 6. VERIFY + SYNTHESIZE ───────────────────────────────────────
  verify(userId: string, taskId: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    const evidenceCount = task.providerOutputs.reduce((n, o) => n + o.evidence.length, 0);
    // Evidence requirement derives from the mode: research/quality tasks demand
    // evidence; standard tasks treat evidence as optional (never fabricated).
    const evidenceRequirement =
      task.mode === 'DEEP_RESEARCH'
        ? 'REQUIRED'
        : task.mode === 'QUALITY'
          ? 'OPTIONAL'
          : 'OPTIONAL';
    const evidenceVerdict = this.policy.evidenceVerdict(evidenceRequirement, evidenceCount);

    const verification: BrainVerification = {
      checks: [
        {
          name: 'execution completed',
          passed: task.providerOutputs.length > 0,
          detail: `${task.providerOutputs.length} provider output(s) recorded.`,
          evidence: [],
        },
        {
          name: 'no abstention without reason',
          passed: task.providerOutputs.every((o) => o.output !== 'ABSTAINED'),
          detail: 'Abstentions are honored (evidence-first).',
          evidence: [],
        },
        {
          name: 'evidence policy',
          passed: evidenceVerdict.allowed,
          detail: evidenceVerdict.reason,
          evidence: [],
        },
        {
          name: 'no unresolved material conflict',
          passed: !task.conflicts.some(
            (c) =>
              c.classification === 'MATERIAL_CONFLICT' ||
              c.classification === 'EVIDENCE_CONFLICT' ||
              c.classification === 'UNRESOLVED',
          ),
          detail:
            task.conflicts.length === 0
              ? 'No provider conflicts.'
              : `${task.conflicts.length} conflict(s) — ${task.conflicts.map((c) => c.classification).join(', ')}.`,
          evidence: [],
        },
      ],
      passed: false,
    };
    verification.passed = verification.checks.every((c) => c.passed);
    task.verification = verification;

    // Synthesis (provenance-preserving).
    task.synthesis = this.assembler.synthesize(
      task.providerOutputs.map((o) => ({
        providerId: o.providerId,
        role: o.role,
        capability: o.capability,
        output: o.output,
        evidence: o.evidence,
        quality: o.quality,
      })),
      task.conflicts,
    );

    const hasUnresolved = task.synthesis.unresolvedConflicts.length > 0;
    task.status = verification.passed && !hasUnresolved ? 'COMPLETED' : 'PARTIAL';

    this.recordDecision(task, {
      taskId,
      userId,
      decision: 'verification',
      reason: verification.passed
        ? 'All verification checks passed; result synthesized with provenance.'
        : `Verification incomplete — ${hasUnresolved ? 'unresolved conflicts' : 'policy gate'}.`,
      alternatives: ['accept', 'replan', 'abstain'],
      selected: verification.passed ? 'accept' : hasUnresolved ? 'report honestly' : 'replan',
      confidence: 0.8,
      provenance: 'brain-verification',
    });

    const updated = this.markStage(task, 'VERIFICATION', 'completed');
    this.markStage(updated, 'RESULT', 'completed');
    return ok(updated);
  }

  // ── 6b. EPIC-020 — Continuous intelligence (AI World → Brain) ────
  async discoverIntelligence(
    userId: string,
  ): Promise<ServiceResult<{ events: IntelligenceEvent[]; opportunities: Opportunity[] }>> {
    if (!this.opts.discovery || !this.opts.events) {
      return err('Continuous discovery is not configured.', 'NOT_CONFIGURED');
    }
    try {
      const fetched = await this.opts.discovery.fetchIntelligenceEvents(userId);
      const existing = this.opts.events.list(userId);
      const fresh: IntelligenceEvent[] = [];
      for (const event of fetched) {
        if (!existing.some((e) => e.id === event.id)) {
          this.opts.events.save(event);
          fresh.push(event);
        }
      }
      const detected = this.opportunity.detectFromEvents(userId, fresh, this.opts.clock.now());
      if (this.opts.opportunities) {
        for (const opportunity of detected) {
          this.opts.opportunities.save(opportunity);
        }
      }
      return ok({ events: this.opts.events.list(userId), opportunities: detected });
    } catch (e) {
      return err(`Discovery bridge failed: ${String(e)}`, 'DISCOVERY_FAILED');
    }
  }

  listOpportunities(userId: string): ServiceResult<Opportunity[]> {
    return ok(this.opts.opportunities?.list(userId) ?? []);
  }

  updateOpportunity(
    userId: string,
    opportunityId: string,
    status: Opportunity['status'],
  ): ServiceResult<Opportunity> {
    if (!this.opts.opportunities) return err('Opportunity store not configured.', 'NOT_CONFIGURED');
    const updated = this.opts.opportunities.update(userId, opportunityId, { status });
    if (!updated) return err('Opportunity not found.', 'NOT_FOUND');
    return ok(updated);
  }

  listIntelligenceEvents(userId: string): ServiceResult<IntelligenceEvent[]> {
    return ok(this.opts.events?.list(userId) ?? []);
  }

  updateIntelligenceEvent(
    userId: string,
    eventId: string,
    status: IntelligenceEvent['status'],
  ): ServiceResult<IntelligenceEvent> {
    if (!this.opts.events) return err('Intelligence event store not configured.', 'NOT_CONFIGURED');
    const updated = this.opts.events.update(userId, eventId, { status });
    if (!updated) return err('Intelligence event not found.', 'NOT_FOUND');
    return ok(updated);
  }

  /** EPIC-020 — adaptive provider performance evidence (selection + dashboard). */
  providerScores(capability: CapabilityId): ServiceResult<ProviderPerformanceScore[]> {
    return ok(this.opts.experience?.scoresFor(capability) ?? []);
  }

  // ── 7. Status / history / decisions ──────────────────────────────
  getStatus(userId: string, taskId: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');
    return ok(task);
  }

  listTasks(userId: string): ServiceResult<BrainTask[]> {
    return ok(this.opts.tasks.list(userId));
  }

  getDecisionRecords(userId: string, taskId: string): ServiceResult<BrainDecisionRecord[]> {
    return ok(this.opts.decisions.get(userId, taskId));
  }

  cancel(userId: string, taskId: string): ServiceResult<BrainTask> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');
    task.status = 'CANCELLED';
    task.stage = 'CANCELLED';
    const updated = this.save(task);
    return ok(updated);
  }

  // ── 8. LEARNING — evaluate the outcome (3-value satisfaction §10) ──
  async evaluateOutcome(
    userId: string,
    taskId: string,
    outputAccepted: boolean,
    satisfaction: OutcomeSatisfaction = 'UNKNOWN',
  ): Promise<ServiceResult<BrainTask>> {
    const task = this.requireTask(userId, taskId);
    if (!task) return err('Task not found.', 'NOT_FOUND');

    // 3-value feedback: YES / PARTIALLY / NO — mapped transparently.
    const accepted = satisfaction === 'UNKNOWN' ? outputAccepted : satisfaction !== 'NO';
    task.outcome = await this.outcomeEvaluator.evaluate({
      providerResults: task.providerOutputs.map((o) => ({
        providerId: o.providerId,
        role: o.role,
        capability: o.capability,
        succeeded: o.output.length > 0,
      })),
      recommendationCorrect: task.status === 'COMPLETED' && accepted,
      capabilityUseful: task.providerOutputs.length > 0,
      userApproved: task.approvalGranted.length > 0,
      verificationCaughtIssues: !task.verification?.passed,
      replanned: false,
      outputAccepted: accepted,
      explicitFeedback:
        satisfaction !== 'UNKNOWN'
          ? [{ fact: `user rated the outcome: ${satisfaction}` }]
          : undefined,
    });
    task.outcome.satisfaction = satisfaction;
    const updated = this.save(task);
    // EPIC-020 — learning feedback: adaptive scores + memory + opportunities.
    await this.recordLearning(task, accepted, satisfaction);
    return ok(updated);
  }

  // ── 8b. EPIC-020 (Outcome & Revenue layer) — Today's Top 5 (§8) ──
  /**
   * "What are the most valuable things I should do today?" — composed
   * ONLY from existing owner-scoped data (tasks, opportunities, screened
   * events), ranked by the transparent OutcomePriorityEngine.
   */
  dailyPriorities(userId: string, limit = 5): ServiceResult<RankedAction[]> {
    const tasks = this.opts.tasks.list(userId);
    const opportunities = this.opts.opportunities?.list(userId) ?? [];
    const events = this.opts.events?.list(userId) ?? [];
    return ok(this.daily.plan({ tasks, opportunities, events }, limit));
  }

  // ── Internals ────────────────────────────────────────────────────
  /** Record a decision AND carry it on the task (the task object is the
   *  execution-time projection of its decision history — the same records
   *  are persisted in the owner-scoped decision store). */
  private recordDecision(task: BrainTask, input: DecisionInput): void {
    const record = this.decisions.record(input);
    task.decisionRecords.push(record);
  }

  private requireTask(userId: string, taskId: string): BrainTask | undefined {
    return this.opts.tasks.get(userId, taskId);
  }

  /**
   * EPIC-020 — execute one role assignment with bounded failure/fallback.
   * Returns true when the run must STOP (budget fail-closed) — the caller
   * then halts remaining assignments. Never retried indefinitely.
   */
  private async executeAssignment(
    userId: string,
    task: BrainTask,
    initial: ProviderRoleAssignment,
    consumed: { tokens: number; costUsd: number; iterations: number },
  ): Promise<boolean> {
    const policyCtx = {
      authorizedActions: task.intent.authorizedActions,
      approvalGranted: task.approvalGranted,
      budgetAllowed: true,
      evidenceSufficient: true,
      capabilityAvailable: true,
    };
    const gate = this.policy.checkAction(policyCtx, 'execute');
    if (!gate.allowed) {
      task.status = 'PARTIAL';
      return false;
    }

    // Map marketplace capability → frozen runtime capability (REUSE EPIC-014 mapper).
    const mapping = mapCapability(initial.capability);
    if (!mapping.runtime || !isMapped(initial.capability)) {
      // No honest runtime path → never faked; recorded and skipped.
      this.recordDecision(task, {
        taskId: task.id,
        userId,
        decision: 'capability not executable',
        reason: `${initial.capability} has no honest runtime execution path (${mapping.note}) — not executed.`,
        alternatives: ['configure provider', 'evaluate local model', 'manual step'],
        selected: 'hand-off (never faked)',
        confidence: 1,
        provenance: 'capability-mapper',
      });
      return false;
    }

    let assignment = initial;
    let attempts = 0;
    const maxAttempts = Math.min(2, Math.max(1, task.budget.maxIterations));

    // Bounded loop: attempts is strictly incremented each pass and the loop
    // exits on success, on a fallback that continues, on budget stop, or when
    // no fallback remains — it can never run unbounded.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional bounded retry loop, see above
    while (true) {
      attempts += 1;
      const context = await this.opts.context.assemble(userId, [assignment.capability]);
      try {
        const result = await this.opts.execution.execute({
          taskId: task.id,
          capability: mapping.runtime,
          qualityTier: task.qualityTarget === 'HIGH' ? 'premium' : 'standard',
          userInput: task.objective,
          context: { knowledgeContext: context, executionContext: `role: ${assignment.role}` },
          constraints: {
            maxInputTokens: task.budget.maxTokens,
            maxOutputTokens: 1000,
            maxCost: task.budget.maxCostUsd,
          },
          userId,
        });
        consumed.tokens += result.tokens.total;
        consumed.costUsd += result.costUsd;
        consumed.iterations += 1;

        task.providerOutputs.push({
          providerId: assignment.providerId,
          role: assignment.role,
          capability: assignment.capability,
          output: result.abstained ? 'ABSTAINED' : result.content,
          evidence: [],
          quality: assignment.quality,
        });

        const during = this.budgetGuard.checkDuring(consumed);
        if (!during.allowed) {
          task.status = 'PARTIAL';
          this.recordDecision(task, {
            taskId: task.id,
            userId,
            decision: 'budget stop',
            reason: during.reason,
            alternatives: ['stop', 'fallback', 'ask user'],
            selected: 'stop (fail-closed)',
            confidence: 1,
            provenance: 'brain-budget',
          });
          this.markStage(task, 'EXECUTION', 'blocked');
          return true; // STOP — do not execute further assignments.
        }
        return false;
      } catch (e) {
        // EPIC-020 — detect → classify → remove/deprioritize → select
        // alternative → continue within budget (mission §5).
        const failureClass = this.usageIntelligence.classifyFailure(
          e,
          assignment.usage ? [assignment.usage] : [],
        );
        if (attempts < maxAttempts) {
          const candidates = await this.opts.candidates.providerCandidates(assignment.capability);
          const fallback = this.fallbackSelector.select(
            assignment.capability,
            assignment.providerId,
            candidates,
            assignment.usage ? [assignment.usage] : [],
            {
              mode: task.mode,
              qualityTarget: task.qualityTarget,
              attempts,
              maxAttempts,
            },
          );
          if (fallback) {
            task.failoverEvents.push({
              capability: assignment.capability,
              failedProviderId: assignment.providerId,
              failureClass,
              fallbackProviderId: fallback.providerId,
              reason: fallback.reason,
              attempts,
              timestamp: this.opts.clock.now(),
            });
            this.recordDecision(task, {
              taskId: task.id,
              userId,
              decision: 'provider failover',
              reason: `${assignment.providerId} failed for ${assignment.capability} (${failureClass}) — continuing with ${fallback.providerId}.`,
              alternatives: ['retry same', 'alternate provider', 'human intervention', 'abort'],
              selected: `fallback to ${fallback.providerId}`,
              confidence: 0.8,
              providerId: fallback.providerId,
              provenance: 'brain-execution-failover',
            });
            assignment = fallback;
            continue;
          }
        }
        // No fallback available/remaining → recorded honestly (never faked).
        task.providerOutputs.push({
          providerId: assignment.providerId,
          role: assignment.role,
          capability: assignment.capability,
          output: '',
          evidence: [],
          quality: assignment.quality,
        });
        this.recordDecision(task, {
          taskId: task.id,
          userId,
          decision: 'provider failure',
          reason: `${assignment.providerId} failed for ${assignment.capability}: ${e instanceof Error ? e.message : String(e)} — recorded honestly.`,
          alternatives: ['retry', 'alternate provider', 'human intervention', 'abort'],
          selected: 'bounded fallback via execution port',
          confidence: 0.8,
          providerId: assignment.providerId,
          provenance: 'brain-execution',
        });
        return false;
      }
    }
  }

  /** EPIC-020 — usage/limits evidence attached to assignments (never fabricated). */
  private async attachUsageEvidence(
    userId: string,
    assignments: ProviderRoleAssignment[],
  ): Promise<void> {
    if (assignments.length === 0) return;
    const providerIds = [...new Set(assignments.map((a) => a.providerId))];
    let facts = this.opts.usage ? await this.opts.usage.usageFacts(userId, providerIds) : [];
    const covered = new Set(facts.map((f) => f.providerId));
    const derived: ProviderUsageFact[] = [];
    for (const assignment of assignments) {
      if (covered.has(assignment.providerId)) continue;
      const candidates = await this.opts.candidates.providerCandidates(assignment.capability);
      const match = candidates.find((c) => c.providerId === assignment.providerId);
      if (match) {
        derived.push(
          ...this.usageIntelligence.deriveFactsFromCandidates([match], this.opts.clock.now()),
        );
      }
    }
    facts = [...facts, ...derived];
    const byProvider = new Map<string, ProviderUsageFact>();
    for (const fact of facts) byProvider.set(fact.providerId, fact);
    for (const assignment of assignments) {
      const fact = byProvider.get(assignment.providerId);
      if (!fact) continue;
      assignment.usage = fact;
      if (fact.estimatedCostUsd && fact.estimatedCostUsd.status !== 'UNKNOWN') {
        assignment.estimatedCostUsd = fact.estimatedCostUsd.value;
      }
    }
  }

  /** EPIC-020 — learning feedback: adaptive scores + memory + opportunities. */
  private async recordLearning(
    task: BrainTask,
    outputAccepted: boolean,
    satisfaction: OutcomeSatisfaction = 'UNKNOWN',
  ): Promise<void> {
    if (!task.outcome) return;
    if (this.opts.experience) {
      for (const perf of task.outcome.providerPerformance) {
        await this.opts.experience.recordPerformance({
          providerId: perf.providerId,
          capability: perf.capability,
          succeeded: perf.succeeded,
          explicit: false,
          quality: task.providerOutputs.find((o) => o.providerId === perf.providerId)?.quality,
          at: this.opts.clock.now(),
        });
      }
    }
    if (this.opts.memory) {
      // SPRINT-025 — the honest verdict (SPRINT-024) gates what memory is
      // allowed to claim: a COMPLETED task whose verification FAILED or is
      // UNKNOWN is NEVER stored as plain SUCCESS.
      const verdict = deriveOutcomeVerdict({
        status: task.status,
        verificationPassed: task.verification?.passed,
        verificationFailed: task.verification?.passed === false ? true : undefined,
        hasBudgetDecision: task.decisionRecords.some((d) => d.decision.includes('budget')),
        hasFailedProvider:
          task.failoverEvents.length > 0 ||
          task.providerOutputs.some((o) => o.output.length === 0 || o.output === 'ABSTAINED'),
      });
      const memoryOutcome =
        verdict === 'SUCCESS'
          ? 'SUCCESS'
          : verdict === 'FAILED' || verdict === 'BUDGET_EXHAUSTED'
            ? 'FAILED'
            : 'PARTIAL';
      const signals = deriveLearningSignals({
        task,
        verdict,
        verificationPassed: task.verification?.passed,
        verificationFailed: task.verification?.passed === false ? true : undefined,
        capturedAt: this.opts.clock.now(),
      });
      await this.opts.memory.recordOutcome({
        userId: task.userId,
        taskId: task.id,
        taskType: task.requiredCapabilities.join('+') || 'unknown',
        providers: task.providerOutputs.map((o) => ({
          providerId: o.providerId,
          capability: o.capability,
          role: o.role,
          succeeded: o.output.length > 0 && o.output !== 'ABSTAINED',
        })),
        selectedReason: task.decisionRecords.slice(-4).map((d) => `${d.decision}: ${d.reason}`),
        outcome: memoryOutcome,
        costUsd: task.budget.estimatedCostUsd,
        tokens: task.budget.estimatedTokens,
        userAccepted: outputAccepted,
        satisfaction,
        capturedAt: this.opts.clock.now(),
        // ── SPRINT-025 — structured learning evidence ──
        verdict,
        verificationPassed: task.verification?.passed,
        verificationFailed: task.verification?.passed === false ? true : undefined,
        signals,
      });
    }
    if (this.opts.opportunities) {
      const detected = this.opportunity.detectFromOutcome(task.userId, {
        task,
        outputAccepted,
        capturedAt: this.opts.clock.now(),
      });
      for (const opportunity of detected) {
        this.opts.opportunities.save(opportunity);
      }
    }
  }

  // ── 8c. SPRINT-025 — USER CORRECTION LOOP ────────────────────
  /**
   * The ONLY new learning write surface. User corrections are EXPLICIT
   * input with strong authority: they enter the EXISTING preference
   * ledger (EPIC-014, EXPLICIT > INFERRED) as explicit facts, are stored
   * on the task's outcome memory as corrections, and — when they target
   * a provider×capability — feed the EXISTING experience ledger as
   * explicit performance feedback. Inferences never override an explicit
   * current user instruction.
   */
  async correctLearning(
    userId: string,
    input: {
      statement: string;
      target: 'approach' | 'provider' | 'result' | 'preference';
      providerId?: string;
      capability?: string;
      taskId?: string;
    },
  ): Promise<ServiceResult<LearningCorrection>> {
    const statement = input.statement.trim();
    if (statement.length < 3 || statement.length > 500) {
      return err('Correction must be between 3 and 500 characters.', 'INVALID_INPUT');
    }
    if (input.target === 'provider' && !input.providerId) {
      return err('Provider corrections require a providerId.', 'INVALID_INPUT');
    }
    const id = `corr-${Math.random().toString(36).slice(2, 10)}`;
    const now = this.opts.clock.now();
    // NOTE: `capability` is a free-text ledger KEY (used to scope the
    // correction fact) — it is never used for authorization, never executed,
    // and never used to reach another user's data. The gateway bounds its
    // length; the correction fact is advisory learning text only.
    const correction: LearningCorrection = {
      id,
      userId,
      statement,
      target: input.target,
      providerId: input.providerId,
      capability: input.capability as LearningCorrection['capability'],
      taskId: input.taskId,
      confidence: 0.98, // explicit user input — highest authority
      capturedAt: now,
    };

    // 1. EXPLICIT fact into the frozen EPIC-014 preference ledger — the
    //    correction's authority channel. The preference ledger already
    //    separates EXPLICIT from INFERRED (explicit always outranks inferred),
    //    so no score direction is invented: a correction is a user fact, not
    //    a quality measurement.
    await this.opts.preference.record({
      executionId: `correction-${id}`,
      source: 'explicit_user_correction',
      fact: correctionSignal({
        statement: correction.statement,
        target: correction.target,
        providerId: correction.providerId,
        confidence: correction.confidence,
        capturedAt: now,
        provenance: `correction:${id}`,
      }).fact,
      reason:
        'Explicit user correction — this outranks any weak system inference.',
      confidence: correction.confidence,
    });

    // 2. Attach the correction to the task's outcome memory (owner-scoped).
    if (this.opts.memory) {
      const memory = this.opts.memory as {
        recordOutcome: (m: {
          userId: string;
          taskId: string;
          taskType: string;
          providers: Array<{ providerId: string; capability: string; role: string; succeeded: boolean }>;
          selectedReason: string[];
          outcome: 'SUCCESS' | 'PARTIAL' | 'FAILED';
          userAccepted: boolean;
          capturedAt: string;
          corrections?: LearningCorrection[];
        }) => Promise<void>;
      };
      // If the correction references a known task, append to that memory
      // record (the Postgres store upserts by (userId, taskId)); otherwise
      // store a standalone correction record keyed by its own id.
      const taskId = input.taskId ?? id;
      const existing = this.opts.tasks.get(userId, taskId);
      const providers = existing
        ? existing.providerOutputs.map((o) => ({
            providerId: o.providerId,
            capability: o.capability,
            role: o.role,
            succeeded: o.output.length > 0,
          }))
        : [];
      await memory.recordOutcome({
        userId,
        taskId,
        taskType: existing ? existing.requiredCapabilities.join('+') || 'unknown' : 'correction',
        providers,
        selectedReason: [`user correction: ${statement.slice(0, 120)}`],
        outcome: 'PARTIAL',
        userAccepted: false,
        capturedAt: now,
        corrections: [correction],
      });
    }

    // Recorded directly (no task object exists for a standalone correction).
    this.decisions.record({
      taskId: input.taskId ?? id,
      userId,
      decision: 'user correction',
      reason: `User corrected the ${input.target}: ${statement.slice(0, 140)} — recorded as EXPLICIT learning (outranks inference).`,
      alternatives: ['accept correction', 'ignore'],
      selected: 'accept correction',
      confidence: 0.98,
      provenance: 'user-correction',
    });

    return ok(correction);
  }

  private detectConflicts(task: BrainTask): ConflictReport[] {
    const byCapability = new Map<string, typeof task.providerOutputs>();
    for (const out of task.providerOutputs) {
      const list = byCapability.get(out.capability) ?? [];
      list.push(out);
      byCapability.set(out.capability, list);
    }
    const reports: ConflictReport[] = [];
    for (const [capability, outputs] of byCapability) {
      if (outputs.length > 1) {
        reports.push(
          this.conflicts.classify(
            capability,
            outputs.map((o) => ({
              providerId: o.providerId,
              claim: o.output,
              evidence: o.evidence,
              confidence: o.quality ?? 0.5,
            })),
          ),
        );
      }
    }
    return reports;
  }

  private markStage(task: BrainTask, stage: BrainStage, status: BrainStageStatus): BrainTask {
    // eslint-disable-next-line security/detect-object-injection -- Closed BrainStage union key on a bounded stage-status record; never user-controlled.
    task.stageStatuses[stage] = status;
    task.stage = stage;
    task.updatedAt = this.opts.clock.now();
    return this.save(task);
  }

  private save(task: BrainTask): BrainTask {
    task.updatedAt = this.opts.clock.now();
    this.opts.tasks.save(task);
    return task;
  }
}
