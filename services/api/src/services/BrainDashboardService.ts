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
    quotaUsedPercent: number;
  }>;
  usage: {
    tokensUsed: number;
    tokenBudget: number;
    costUsd: number;
    aiCalls: number;
    freePercent: number;
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
        quotaUsedPercent: row.health.quotaUsedPercent,
      }))
      .slice(0, 12);
    const usage = overview.success
      ? {
          tokensUsed: overview.data?.usage.tokensUsed ?? 0,
          tokenBudget: overview.data?.usage.tokenBudget ?? 0,
          costUsd: overview.data?.usage.costUsd ?? 0,
          aiCalls: overview.data?.usage.aiCalls ?? 0,
          freePercent: overview.data?.usage.freePercent ?? 0,
        }
      : { tokensUsed: 0, tokenBudget: 0, costUsd: 0, aiCalls: 0, freePercent: 0 };

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

    const learning = outcomeMemory
      .list(userId)
      .slice(-8)
      .map((m) => ({
        taskId: m.taskId,
        taskType: m.taskType,
        outcome: m.outcome,
        userAccepted: m.userAccepted,
        capturedAt: m.capturedAt,
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
      scheduler,
    };
  }
}
