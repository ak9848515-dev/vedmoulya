// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge
// LiveIntelligenceBridgeService — EPIC-017
//
// The ORCHESTRATOR of the full loop:
//   USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY →
//   PROVIDER/MODEL INTELLIGENCE → ECOSYSTEM INTELLIGENCE →
//   SECURITY/LICENSE/AVAILABILITY → TASK-SPECIFIC QUALITY →
//   COMPARE CURRENT VS BETTER → RECOMMENDATION → USER APPROVAL →
//   CONFIGURATION/HAND-OFF → VALIDATION → ROUTING → EPIC-014
//   EXECUTION → VERIFY → EVALUATE → MEMORY/PREFERENCE FEEDBACK.
//
// Every method is owner-scoped (IDOR-safe by construction). The bridge
// NEVER executes AI itself — it composes the existing Brain,
// Intelligence, Marketplace and Execution services through narrow
// ports. Nothing is fabricated; UNKNOWN is first-class; nothing is
// auto-activated without approval.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId, FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type { IntelligenceTaskContext } from '@vedmoulya/ecosystem-intelligence';
import type { ExecutionRun } from '@vedmoulya/execution-bridge';
import type {
  BridgeAiWorldPort,
  BridgeBrainPort,
  BridgeClockPort,
  BridgeExecutionPort,
  BridgeIntelligencePort,
  BridgeLoopStore,
  BridgeMarketplacePort,
} from '../contracts/bridge-ports.js';
import type { BrainCandidatePort, BrainPreferencePort } from '../contracts/bridge-ports.js';
import type {
  BridgeComparison,
  BridgeLoopRun,
  BridgeNotificationEvent,
  BridgeRecommendation,
} from '../types/bridge-types.js';
import { BRIDGE_STAGES } from '../types/bridge-types.js';
import { BridgeCandidateAssembler } from '../domain/BridgeCandidateAssembler.js';
import { BridgeComparisonBuilder } from '../domain/BridgeComparisonBuilder.js';
import { BridgeRecommendationBuilder } from '../domain/BridgeRecommendationBuilder.js';
import { BridgeApprovalPolicy } from '../domain/BridgeApprovalPolicy.js';
import { BridgeOutcomeEvaluator } from '../domain/BridgeOutcomeEvaluator.js';
import { BridgePreferenceFeedback } from '../domain/BridgePreferenceFeedback.js';
import { BridgeNotificationMapper } from '../domain/BridgeNotificationMapper.js';

export interface BridgeServiceOptions {
  clock: BridgeClockPort;
  brain: BridgeBrainPort;
  intelligence: BridgeIntelligencePort;
  marketplace: BridgeMarketplacePort;
  execution: BridgeExecutionPort;
  candidates: BrainCandidatePort;
  preference: BrainPreferencePort;
  aiWorld: BridgeAiWorldPort;
  loops: BridgeLoopStore;
  traceId?: () => string;
}

export interface BridgeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class LiveIntelligenceBridgeService {
  private readonly assembler = new BridgeCandidateAssembler();
  private readonly comparisonBuilder = new BridgeComparisonBuilder();
  private readonly recommendationBuilder = new BridgeRecommendationBuilder();
  private readonly approvals = new BridgeApprovalPolicy();
  private readonly outcomeEvaluator = new BridgeOutcomeEvaluator();
  private readonly feedback = new BridgePreferenceFeedback();
  private readonly notifications = new BridgeNotificationMapper();

  constructor(private readonly opts: BridgeServiceOptions) {}

  // ── 1. UNDERSTAND — create the loop, brain understands + plans ──
  async start(userId: string, objective: string): Promise<BridgeResult<BridgeLoopRun>> {
    if (!objective || objective.trim().length < 3) {
      return { success: false, error: 'Objective too short to understand.', code: 'INVALID_INPUT' };
    }
    const loopId = `bridge-${Math.random().toString(36).slice(2, 10)}`;
    const now = this.opts.clock.now();
    const loop: BridgeLoopRun = {
      loopId,
      userId,
      objective: objective.trim(),
      status: 'NEW',
      stage: 'UNDERSTAND',
      stageStatuses: Object.fromEntries(
        BRIDGE_STAGES.map((s) => [s, 'pending']),
      ) as BridgeLoopRun['stageStatuses'],
      capabilities: [],
      candidates: [],
      comparisons: [],
      recommendations: [],
      approvals: [],
      performance: [],
      notifications: [],
      traceId: this.opts.traceId?.() ?? `bridge-${loopId}`,
      createdAt: now,
      updatedAt: now,
    };
    this.markStage(loop, 'UNDERSTAND', 'running');
    loop.status = 'UNDERSTANDING';

    const created = this.opts.brain.createTask(userId, objective);
    if (!created.success || !created.data) {
      loop.failureReason = created.error ?? 'Brain could not understand the task.';
      this.markStage(loop, 'UNDERSTAND', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason, code: created.code };
    }
    const task = created.data;
    loop.intent = {
      domain: task.intent.domain,
      qualityTarget: task.intent.qualityTarget,
      privacyRequirement: task.intent.privacyRequirement,
      authorizedActions: task.intent.authorizedActions,
    };

    const planned = await this.opts.brain.plan(userId, task.id);
    if (!planned.success || !planned.data) {
      loop.failureReason = planned.error ?? 'Brain could not plan the task.';
      this.markStage(loop, 'UNDERSTAND', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason, code: planned.code };
    }
    loop.capabilities = planned.data.requiredCapabilities;
    this.markStage(loop, 'UNDERSTAND', 'completed');
    loop.status = 'UNDERSTANDING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 2. DISCOVER — candidates per capability (existing seams) ────
  async discover(userId: string, loopId: string): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };

    this.markStage(loop, 'DISCOVER', 'running');
    loop.status = 'DISCOVERING';
    const qualityFloor = this.qualityFloor(loop.intent?.qualityTarget);

    const candidates: BridgeLoopRun['candidates'] = [];
    for (const capability of loop.capabilities) {
      const cap = capability as CapabilityId;
      const [providers, discoveries, locals] = await Promise.all([
        this.opts.candidates.providerCandidates(cap),
        this.opts.candidates.discoveryCandidates(cap),
        this.opts.candidates.localModelCandidates(cap),
      ]);
      // Normalize each source into the bridge view model (evidence-first).
      for (const p of providers) {
        candidates.push(
          this.assembler.assemble({
            capability: cap,
            qualityFloor,
            option: {
              kind: p.configured ? 'BEST_CONFIGURED' : 'BEST_PAID',
              providerId: p.providerId,
              name: p.modelName ? `${p.name} · ${p.modelName}` : p.name,
              capability: cap,
              quality: p.quality !== undefined ? p.quality * 100 : undefined,
              costUsd: p.estimatedCostUsd,
              freeClass: p.costTier === 'free' ? 'FREE_API' : undefined,
              localAvailability:
                p.family === 'ollama' || p.family === 'lm-studio' ? 'yes' : 'UNKNOWN',
              reason: `Quality-first candidate from provider intelligence (${p.evidence.length} evidence item(s)).`,
              evidence: p.evidence.map((e) => `${e.claim} (${e.source})`),
              requires: p.configured ? [] : ['api_key'],
            },
            configured: p.configured,
          }),
        );
      }
      for (const d of discoveries) {
        candidates.push(
          this.assembler.assemble({
            capability: cap,
            qualityFloor,
            option: {
              kind: 'BEST_PAID',
              providerId: `discovery:${d.itemId}`,
              name: d.title,
              capability: cap,
              quality: undefined,
              freeClass: d.freeClass as
                | 'FREE_API'
                | 'FREE_WITH_QUOTA'
                | 'OPEN_WEIGHTS'
                | 'OPEN_SOURCE'
                | 'LOCAL'
                | 'PAID'
                | 'UNKNOWN',
              localAvailability: d.localAvailability,
              reason:
                'Open-source/application candidate from AI World — untrusted until security + license review.',
              evidence: d.evidence.map((e) => `${e.claim} (${e.source})`),
              requires: d.configurable ? ['additional_permission'] : ['external_application'],
            },
          }),
        );
      }
      for (const l of locals) {
        candidates.push(
          this.assembler.assemble({
            capability: cap,
            qualityFloor,
            option: {
              kind: 'BEST_LOCAL',
              providerId: `local:${l.id}`,
              name: l.name,
              capability: cap,
              quality: undefined,
              localAvailability: l.available ? 'yes' : 'no',
              reason:
                'Local model candidate — recommended only when quality is acceptable and hardware is suitable.',
              evidence: l.evidence.map((e) => `${e.claim} (${e.source})`),
              requires: l.available ? ['download', 'local_install'] : ['additional_permission'],
            },
          }),
        );
      }
    }

    loop.candidates = candidates.slice(0, 60);
    this.markStage(loop, 'DISCOVER', 'completed');
    loop.status = 'DISCOVERING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 3. COMPARE — current vs better per capability ───────────────
  async compare(userId: string, loopId: string): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };

    this.markStage(loop, 'COMPARE', 'running');
    loop.status = 'COMPARING';
    const qualityFloor = this.qualityFloor(loop.intent?.qualityTarget);
    const ctx = this.context(loop);
    const comparisons: BridgeComparison[] = [];

    for (const capability of loop.capabilities) {
      const cap = capability as CapabilityId;
      const result = await this.opts.intelligence.findBetterOption(userId, cap, ctx);
      comparisons.push(this.comparisonBuilder.build({ capability: cap, qualityFloor, result }));
    }

    loop.comparisons = comparisons;
    this.markStage(loop, 'COMPARE', 'completed');
    loop.status = 'COMPARING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 4. RECOMMEND — material improvements → premium recommendation ──
  async recommend(userId: string, loopId: string): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };

    this.markStage(loop, 'RECOMMEND', 'running');
    loop.status = 'RECOMMENDING';
    const qualityFloor = this.qualityFloor(loop.intent?.qualityTarget);
    const ctx = this.context(loop);
    const recommendations: BridgeRecommendation[] = [];

    for (const comparison of loop.comparisons) {
      if (!comparison.betterOptionAvailable || !comparison.alternative) continue;
      const result = await this.opts.intelligence.findBetterOption(
        userId,
        comparison.capability as CapabilityId,
        ctx,
      );
      const best = result.options.find((o) => o.kind === 'BEST_PAID') ?? result.options[0];
      if (!best) continue;
      // Reuse a pending recommendation for the SAME option (no dupes on refetch).
      const existing = loop.recommendations.find(
        (r) => r.capability === comparison.capability && r.state === 'PENDING',
      );
      const built = this.recommendationBuilder.build({
        capability: comparison.capability as CapabilityId,
        current: comparison.current
          ? { name: comparison.current.name, quality: comparison.current.quality }
          : undefined,
        best,
        freeAlternative:
          comparison.alternative.costClass === 'FREE_API' ||
          comparison.alternative.costClass === 'FREE_WITH_QUOTA'
            ? comparison.alternative.candidate
            : undefined,
        localAlternative:
          comparison.alternative.localAvailability === 'yes'
            ? comparison.alternative.candidate
            : undefined,
        now: this.opts.clock.now(),
      });
      recommendations.push(existing ? { ...existing, ...built, id: existing.id } : built);

      // Approval records for the recommended activation.
      const verdict = this.approvals.forCandidate(built.acquisition, false);
      if (verdict.required) {
        loop.approvals.push({
          id: `appr-${built.id}`,
          loopId,
          action: verdict.actions[0] ?? 'configuration_consent',
          reason: verdict.reason,
          state: 'REQUIRED',
        });
      }
      void qualityFloor;
    }

    loop.recommendations = recommendations;
    const pendingApprovals = loop.approvals.filter((a) => a.state === 'REQUIRED');
    this.markStage(loop, 'RECOMMEND', 'completed');
    if (pendingApprovals.length > 0) {
      this.markStage(loop, 'APPROVAL', 'running');
      loop.status = 'AWAITING_APPROVAL';
    } else {
      loop.status = 'RECOMMENDING';
    }
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 5. APPROVAL — approve / reject a recommendation ─────────────
  async approve(
    userId: string,
    loopId: string,
    recommendationId: string,
  ): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    const recommendation = loop.recommendations.find((r) => r.id === recommendationId);
    if (!recommendation)
      return { success: false, error: 'Recommendation not found.', code: 'NOT_FOUND' };

    // Surface the acceptance through the intelligence layer (explicit signal).
    await this.opts.intelligence.respondToRecommendation(
      userId,
      recommendationId,
      'use_recommended',
    );

    recommendation.state = 'ACCEPTED';
    for (const approval of loop.approvals.filter((a) => a.state === 'REQUIRED')) {
      approval.state = 'GRANTED';
      approval.decidedAt = this.opts.clock.now();
    }
    this.markStage(loop, 'APPROVAL', 'completed');
    loop.status = 'RECOMMENDING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  async reject(
    userId: string,
    loopId: string,
    recommendationId: string,
  ): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    const recommendation = loop.recommendations.find((r) => r.id === recommendationId);
    if (!recommendation)
      return { success: false, error: 'Recommendation not found.', code: 'NOT_FOUND' };

    await this.opts.intelligence.respondToRecommendation(
      userId,
      recommendationId,
      'continue_with_current',
    );
    recommendation.state = 'DECLINED';
    for (const approval of loop.approvals.filter((a) => a.state === 'REQUIRED')) {
      approval.state = 'REJECTED';
      approval.decidedAt = this.opts.clock.now();
    }
    this.markStage(loop, 'APPROVAL', 'completed');
    // Declining is NOT task failure — the loop continues with the best
    // available configured option.
    loop.status = 'RECOMMENDING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 6. HANDOFF — configuration / execution hand-off ─────────────
  async handOff(userId: string, loopId: string): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };

    this.markStage(loop, 'HANDOFF', 'running');
    loop.status = 'HANDING_OFF';

    // A capability plan is required for execution (EPIC-013 → EPIC-014).
    let plan: FactoryCapabilityPlan;
    try {
      plan = await this.opts.marketplace.plan(userId, { outcome: loop.objective });
    } catch (e) {
      loop.failureReason = `Capability planning failed: ${String(e)}`;
      this.markStage(loop, 'HANDOFF', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason, code: 'PLAN_FAILED' };
    }

    const planId = plan.id;
    this.markStage(loop, 'HANDOFF', 'completed');
    this.markStage(loop, 'PLAN', 'completed');
    loop.status = 'PLANNING';
    this.opts.loops.save(loop);

    // Start execution through EPIC-014 (bounded, verified, honest).
    const started = await this.opts.execution.start(userId, planId);
    if (!started.success || !started.data) {
      loop.failureReason = started.error ?? 'Execution could not start.';
      this.markStage(loop, 'EXECUTE', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason };
    }
    const run = started.data;
    const gated = run.steps.find(
      (s) =>
        s.state === 'waiting_approval' ||
        s.state === 'configure_required' ||
        s.state === 'manual_required',
    );
    loop.executionHandoff = {
      planId,
      executionId: run.executionId,
      kind: gated
        ? gated.state === 'configure_required'
          ? 'CONFIGURE'
          : gated.state === 'waiting_approval'
            ? 'EXECUTE'
            : 'MANUAL'
        : run.status === 'COMPLETED'
          ? 'EXECUTE'
          : 'UNAVAILABLE',
      stepTitle: gated?.title ?? 'run',
      detail: gated
        ? `Execution paused at "${gated.title}" — configuration/manual/approval boundary (never auto-executed).`
        : `Execution ${run.status}.`,
      deepLink: gated?.state === 'configure_required' ? '/providers' : undefined,
    };
    this.markStage(loop, 'EXECUTE', gated ? 'blocked' : 'completed');
    loop.status = gated ? 'CONFIGURING' : 'EXECUTING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── 7. VERIFY + EVALUATE + FEEDBACK ─────────────────────────────
  verify(userId: string, loopId: string): BridgeResult<BridgeLoopRun> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    const executionId = loop.executionHandoff?.executionId;
    if (!executionId)
      return { success: false, error: 'No execution to verify.', code: 'NOT_EXECUTED' };

    this.markStage(loop, 'VERIFY', 'running');
    loop.status = 'VERIFYING';
    const runResult = this.opts.execution.get(userId, executionId);
    if (!runResult.success || !runResult.data) {
      loop.failureReason = runResult.error ?? 'Execution not found.';
      this.markStage(loop, 'VERIFY', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason };
    }
    this.markStage(loop, 'VERIFY', 'completed');
    loop.status = 'VERIFYING';
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  async evaluateAndLearn(
    userId: string,
    loopId: string,
    _outputAccepted: boolean,
  ): Promise<BridgeResult<BridgeLoopRun>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    const executionId = loop.executionHandoff?.executionId;
    if (!executionId)
      return { success: false, error: 'No execution to evaluate.', code: 'NOT_EXECUTED' };

    this.markStage(loop, 'EVALUATE', 'running');
    loop.status = 'EVALUATING';

    const runResult = this.opts.execution.get(userId, executionId);
    if (!runResult.success || !runResult.data) {
      loop.failureReason = runResult.error ?? 'Execution not found.';
      this.markStage(loop, 'EVALUATE', 'failed');
      loop.status = 'FAILED';
      this.opts.loops.save(loop);
      return { success: false, error: loop.failureReason };
    }
    const run: ExecutionRun = runResult.data;

    const userApproval: 'GRANTED' | 'REJECTED' | 'NOT_REQUIRED' = loop.approvals.some(
      (a) => a.state === 'REJECTED',
    )
      ? 'REJECTED'
      : loop.approvals.some((a) => a.state === 'GRANTED')
        ? 'GRANTED'
        : 'NOT_REQUIRED';

    const evaluation = this.outcomeEvaluator.evaluate({
      run,
      userApproval,
      recommendedCapabilityUsed: loop.recommendations.some((r) => r.state === 'ACCEPTED'),
      evaluatedAt: this.opts.clock.now(),
    });
    loop.outcome = {
      taskCompleted: evaluation.taskCompleted,
      quality: evaluation.quality,
      accuracy: evaluation.accuracy,
      validation: evaluation.validation,
      failures: evaluation.failures,
      providerPerformance: evaluation.providerPerformance,
      latencyMs: evaluation.latencyMs,
      costUsd: evaluation.costUsd,
      reliability: evaluation.reliability,
      userApproval: evaluation.userApproval,
      chosenCapabilityPerformedBetter: evaluation.chosenCapabilityPerformedBetter,
      evaluatedAt: evaluation.evaluatedAt,
    };
    this.markStage(loop, 'EVALUATE', 'completed');

    // ── FEEDBACK — task-specific performance facts through the EXISTING ledger ──
    this.markStage(loop, 'FEEDBACK', 'running');
    loop.status = 'FEEDBACK';
    for (const perf of evaluation.providerPerformance) {
      const qualityScore = evaluation.taskCompleted ? 85 : 45;
      const fact = this.feedback.fact({
        loopId,
        capability: loop.capabilities[0] ?? 'UNKNOWN',
        providerId: perf.provider,
        qualityScore,
        privacyBenefit: 'UNKNOWN',
        costBenefit: perf.costUsd > 0 ? 'no' : 'yes',
        evidence: [
          `Outcome: ${evaluation.quality} (${evaluation.validation})`,
          `Latency ${perf.latencyMs}ms, cost $${perf.costUsd.toFixed(4)}.`,
        ],
        now: this.opts.clock.now(),
      });
      loop.performance.push(fact);
      await this.opts.preference.record({
        executionId: executionId,
        stepId: perf.role,
        source: 'inferred_observation',
        fact: `Provider ${perf.provider} completed '${perf.role}' — task-specific performance recorded.`,
        provider: perf.provider,
        capability: loop.capabilities[0] ?? 'UNKNOWN',
        reason: 'outcome evaluated by the bridge',
        confidence: 0.7,
      });
    }
    this.markStage(loop, 'FEEDBACK', 'completed');

    // ── NOTIFY — meaningful changes reach the existing AI World surface ──
    this.markStage(loop, 'NOTIFY', 'running');
    const accepted = loop.recommendations.find((r) => r.state === 'ACCEPTED');
    if (accepted && evaluation.chosenCapabilityPerformedBetter !== false) {
      const event = this.notifications.fromBetterCapability({
        loopId,
        capability: accepted.capability,
        provider: accepted.recommended.name,
        quality: accepted.recommended.quality,
        currentQuality: accepted.current?.quality,
        now: this.opts.clock.now(),
      });
      if (!('dropped' in event)) {
        loop.notifications.push(event);
        await this.opts.aiWorld.emit(userId, event);
      }
    }
    this.markStage(loop, 'NOTIFY', 'completed');

    loop.status = evaluation.taskCompleted ? 'COMPLETED' : 'PARTIAL';
    this.markStage(loop, 'COMPLETED', evaluation.taskCompleted ? 'completed' : 'blocked');
    this.opts.loops.save(loop);
    return { success: true, data: loop };
  }

  // ── Reads (owner-scoped) ────────────────────────────────────────
  get(userId: string, loopId: string): BridgeResult<BridgeLoopRun> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    return { success: true, data: loop };
  }

  list(userId: string): BridgeResult<BridgeLoopRun[]> {
    return { success: true, data: this.opts.loops.list(userId) };
  }

  /** Task-specific performance profile (derived, time-aware, reversible). */
  performanceProfile(userId: string): BridgeResult<unknown[]> {
    const loops = this.opts.loops.list(userId);
    const events = loops.flatMap((l) =>
      l.performance.map((p) => ({
        timestamp: p.recordedAt,
        provider: p.providerId,
        capability: p.capability,
        source: 'inferred_observation',
        model: undefined as string | undefined,
      })),
    );
    const profile = this.feedback.taskProfile({
      loopId: 'profile',
      capability: 'ALL',
      providerId: 'ALL',
      events: events as never,
      now: this.opts.clock.now(),
    });
    return { success: true, data: profile };
  }

  // ── Notification surface (gated) ────────────────────────────────
  async emitNotification(
    userId: string,
    loopId: string,
    candidate: {
      kind: BridgeNotificationEvent['kind'];
      title: string;
      body: string;
      relevance: number;
    },
  ): Promise<BridgeResult<BridgeNotificationEvent | { dropped: true; reason: string }>> {
    const loop = this.requireLoop(userId, loopId);
    if (!loop) return { success: false, error: 'Loop not found.', code: 'NOT_FOUND' };
    const event = this.notifications.maybeNotify(candidate, loopId, this.opts.clock.now());
    if ('dropped' in event) return { success: true, data: event };
    loop.notifications.push(event);
    this.opts.loops.save(loop);
    await this.opts.aiWorld.emit(userId, event);
    return { success: true, data: event };
  }

  // ── Internals ───────────────────────────────────────────────────
  private requireLoop(userId: string, loopId: string): BridgeLoopRun | undefined {
    return this.opts.loops.get(userId, loopId);
  }

  private markStage(
    loop: BridgeLoopRun,
    stage: BridgeLoopRun['stage'],
    status: BridgeLoopRun['stageStatuses'][BridgeLoopRun['stage']],
  ): void {
    // eslint-disable-next-line security/detect-object-injection -- Closed BridgeStage union key on the bounded stage record; never user-controlled.
    loop.stageStatuses[stage] = status;
    loop.stage = stage;
    loop.updatedAt = this.opts.clock.now();
  }

  private context(loop: BridgeLoopRun): IntelligenceTaskContext {
    return {
      objective: loop.objective,
      domain: loop.intent?.domain ?? 'UNKNOWN',
      qualityTarget:
        loop.intent?.qualityTarget === 'HIGH' ||
        loop.intent?.qualityTarget === 'MEDIUM' ||
        loop.intent?.qualityTarget === 'LOW'
          ? loop.intent.qualityTarget
          : 'MEDIUM',
      privacyRequirement: loop.intent?.privacyRequirement === 'PRIVATE' ? 'PRIVATE' : 'STANDARD',
      constraints: [],
      authorizedActions: loop.intent?.authorizedActions ?? [],
    };
  }

  private qualityFloor(target?: string): number {
    if (target === 'HIGH') return 80;
    if (target === 'MEDIUM') return 60;
    return 40;
  }
}
