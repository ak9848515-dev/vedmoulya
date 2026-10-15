// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Brain Operating Dashboard (EPIC-020 §13)
//
// Answers the five dashboard questions with EXISTING telemetry:
//   • What is VedMoulya doing?          → active tasks + scheduler jobs
//   • Why is it doing it?               → task objectives + decision reasons
//   • What needs my approval?           → pending approval queue
//   • What did it learn?                → recent outcome memory + adaptive scores
//   • What can improve my life/income?  → opportunities + AI World discoveries
//
// Composes ONLY existing services through narrow reads — no duplicate
// engines, no new stores here. Owner-scoped everywhere.
// ─────────────────────────────────────────────────────────────────────────────

import type { BrainApplicationService as VedMoulyaBrainService } from '@vedmoulya/brain';
import type { BrainOutcomeMemory } from '@vedmoulya/brain';
import type { ProviderExperienceService } from './ProviderExperienceService.js';
import type { SchedulerApplicationService } from '@vedmoulya/ai-world-scheduler';

/** Narrow structural read port — the dashboard only consumes the learning
 *  feed; satisfied by the in-memory and Postgres outcome memories alike. */
export interface BrainOutcomeReadPort {
  list(userId: string): BrainOutcomeMemory[];
}

export interface BrainDashboardInput {
  brain: VedMoulyaBrainService;
  outcomeMemory: BrainOutcomeReadPort;
  providerExperience: ProviderExperienceService;
  aiWorldScheduler?: SchedulerApplicationService;
}

export interface BrainDashboardView {
  generatedAt: string;
  brainStatus: 'IDLE' | 'WORKING' | 'AWAITING_APPROVAL';
  activeTasks: number;
  pendingApprovals: Array<{
    taskId: string;
    objective: string;
    actions: string[];
  }>;
  recentTasks: Array<{
    id: string;
    objective: string;
    status: string;
    stage: string;
    updatedAt: string;
  }>;
  opportunities: Array<{
    id: string;
    category: string;
    title: string;
    uncertainty: number;
    status: string;
  }>;
  intelligenceEvents: Array<{
    id: string;
    kind: string;
    title: string;
    security: string;
    relevance: number;
    status: string;
  }>;
  providerHealth: Array<{
    providerId: string;
    name: string;
    availability: string;
    healthStatus: string;
    /** Provenance of `healthStatus` (absent ⇒ 'SEED' — never a live check). */
    healthSource?: 'SEED' | 'MEASURED';
    quotaUsedPercent: number;
    /** Provenance of `quotaUsedPercent` (absent ⇒ 'SEED' — not account usage). */
    quotaSource?: 'SEED' | 'PROVIDER_REPORTED';
  }>;
  /**
   * AI usage for this owner. Every figure is measured; the budget is READ from
   * the user's preferences (never a platform default) and its provenance travels
   * with it.
   */
  usage: {
    tokensUsed: number;
    /** The user's configured monthly limit. Undefined when none is configured. */
    tokenBudget?: number;
    budgetSource: 'NONE' | 'USER_CONFIGURED' | 'PLATFORM_ALLOWANCE';
    budgetConfiguredAt?: string;
    /** Present ONLY when a real limit exists. */
    remainingTokens?: number;
    budgetBasis: 'USER_BUDGET' | 'PLATFORM_ALLOWANCE' | 'PROVIDER_QUOTA' | 'UNKNOWN';
    costUsd: number;
    aiCalls: number;
    freePercent: number;
    /** WHICH store answered: the durable ledger, or the weaker trace store. */
    usageSource: 'DURABLE_USAGE_LEDGER' | 'TRACE_LEDGER';
    durableChecked: boolean;
  };
  adaptiveScores: Array<{
    providerId: string;
    capability: string;
    qualityScore: number;
    sampleCount: number;
  }>;
  learning: Array<{
    taskId: string;
    taskType: string;
    outcome: string;
    userAccepted: boolean;
    capturedAt: string;
    // ── SPRINT-025 — honest verdict + source/confidence transparency ──
    verdict?: string;
    verificationPassed?: boolean;
    signals: Array<{
      fact: string;
      kind: 'FACT' | 'INFERENCE' | 'UNKNOWN';
      source: 'EXPLICIT' | 'INFERRED';
      confidence: number;
      capturedAt: string;
    }>;
  }>;
  /** SPRINT-025 — user corrections ("you told me"), highest authority. */
  corrections: Array<{
    id: string;
    statement: string;
    target: string;
    providerId?: string;
    taskId?: string;
    confidence: number;
    capturedAt: string;
  }>;
  scheduler: {
    nextDiscoveryAt?: string;
    meaningfulUpdates: number;
    enabledJobs: number;
  };
}

export class BrainDashboardService {
  constructor(private readonly input: BrainDashboardInput) {}

  async get(userId: string): Promise<BrainDashboardView> {
    const { brain, outcomeMemory, providerExperience, aiWorldScheduler } = this.input;
    const now = new Date().toISOString();

    const tasks = brain.listTasks(userId).data ?? [];
    const activeTasks = tasks.filter(
      (t) => t.status === 'RUNNING' || t.status === 'VERIFYING' || t.status === 'AWAITING_APPROVAL',
    );
    const pendingApprovals = tasks
      .filter((t) => t.approvalRequired.length > 0)
      .map((t) => ({ taskId: t.id, objective: t.objective, actions: t.approvalRequired }))
      .slice(0, 10);

    const brainStatus: BrainDashboardView['brainStatus'] =
      pendingApprovals.length > 0
        ? 'AWAITING_APPROVAL'
        : activeTasks.length > 0
          ? 'WORKING'
          : 'IDLE';

    const opportunities = (brain.listOpportunities(userId).data ?? [])
      .filter((o) => o.status === 'NEW' || o.status === 'RECOMMENDED')
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        category: o.category,
        title: o.title,
        uncertainty: o.uncertainty,
        status: o.status,
      }));

    const intelligenceEvents = (brain.listIntelligenceEvents(userId).data ?? [])
      .filter((e) => e.status === 'NEW' || e.status === 'RECOMMENDED')
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        title: e.title,
        security: e.security,
        relevance: e.relevance,
        status: e.status,
      }));

    // Provider health + usage from the EXISTING experience service.
    const overview = await providerExperience.getOverview(userId);
    const providerHealth = (overview.success ? (overview.data?.providers ?? []) : [])
      .map((row) => ({
        providerId: row.providerId,
        name: row.name,
        availability: row.availability,
        healthStatus: row.health.status,
        healthSource: row.health.healthSource,
        quotaUsedPercent: row.health.quotaUsedPercent,
        quotaSource: row.health.quotaSource,
      }))
      .slice(0, 12);
    // Usage comes from the DURABLE owner-scoped ledger through the provider
    // experience read (which also reports which store answered). The budget is
    // whatever the user actually configured: when nothing is configured the
    // figure is absent and the UI says "not configured" — there is no default
    // 1M-token allowance to fall back to.
    const overviewUsage = overview.success ? overview.data?.usage : undefined;
    const usage: BrainDashboardView['usage'] = overviewUsage
      ? {
          tokensUsed: overviewUsage.tokensUsed,
          ...(overviewUsage.tokenBudget !== undefined
            ? { tokenBudget: overviewUsage.tokenBudget }
            : {}),
          budgetSource: overviewUsage.budgetSource,
          ...(overviewUsage.budgetConfiguredAt !== undefined
            ? { budgetConfiguredAt: overviewUsage.budgetConfiguredAt }
            : {}),
          ...(overviewUsage.remainingTokens !== undefined
            ? { remainingTokens: overviewUsage.remainingTokens }
            : {}),
          budgetBasis: overviewUsage.budgetBasis,
          costUsd: overviewUsage.costUsd,
          aiCalls: overviewUsage.aiCalls,
          freePercent: overviewUsage.freePercent,
          usageSource: overviewUsage.usageSource,
          durableChecked: overviewUsage.durableChecked,
        }
      : {
          tokensUsed: 0,
          budgetSource: 'NONE',
          budgetBasis: 'UNKNOWN',
          costUsd: 0,
          aiCalls: 0,
          freePercent: 0,
          usageSource: 'TRACE_LEDGER',
          durableChecked: false,
        };

    // Adaptive provider performance evidence (internal scores, advisory only).
    const capabilities = ['CODING', 'REASONING', 'RESEARCH', 'TEXT_GENERATION', 'RAG'];
    const adaptiveScores: BrainDashboardView['adaptiveScores'] = [];
    for (const capability of capabilities) {
      for (const score of brain.providerScores(capability as never).data ?? []) {
        adaptiveScores.push({
          providerId: score.providerId,
          capability: score.capability,
          qualityScore: score.qualityScore,
          sampleCount: score.sampleCount,
        });
      }
    }

    const allOutcomeMemory = outcomeMemory.list(userId);
    const learning = allOutcomeMemory
      .filter((m) => (m.corrections?.length ?? 0) === 0)
      .slice(-8)
      .map((m) => ({
        taskId: m.taskId,
        taskType: m.taskType,
        outcome: m.outcome,
        userAccepted: m.userAccepted,
        capturedAt: m.capturedAt,
        verdict: m.verdict,
        verificationPassed: m.verificationPassed,
        signals: (m.signals ?? []).map((s) => ({
          fact: s.fact,
          kind: s.kind,
          source: s.source,
          confidence: s.confidence,
          capturedAt: s.capturedAt,
        })),
      }));
    // Corrections are EXCLUSIVELY user-authored — rendered separately as
    // "you told me" facts with the highest authority.
    const corrections = allOutcomeMemory
      .flatMap((m) => m.corrections ?? [])
      .slice(-10)
      .map((c) => ({
        id: c.id,
        statement: c.statement,
        target: c.target,
        providerId: c.providerId,
        taskId: c.taskId,
        confidence: c.confidence,
        capturedAt: c.capturedAt,
      }));

    let scheduler: BrainDashboardView['scheduler'] = { meaningfulUpdates: 0, enabledJobs: 0 };
    if (aiWorldScheduler) {
      const status = aiWorldScheduler.getStatus(userId);
      scheduler = {
        nextDiscoveryAt: status.nextDiscoveryAt,
        meaningfulUpdates: status.meaningfulUpdates,
        enabledJobs: status.jobs.filter((j) => j.enabled).length,
      };
    }

    return {
      generatedAt: now,
      brainStatus,
      activeTasks: activeTasks.length,
      pendingApprovals,
      recentTasks: [...tasks]
        .reverse()
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          objective: t.objective,
          status: t.status,
          stage: t.stage,
          updatedAt: t.updatedAt,
        })),
      opportunities,
      intelligenceEvents,
      providerHealth,
      usage,
      adaptiveScores: adaptiveScores.sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 8),
      learning: [...learning].reverse(),
      corrections: [...corrections].reverse(),
      scheduler,
    };
  }
}
