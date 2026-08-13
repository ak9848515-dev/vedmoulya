// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Learning Intelligence: Application Service
// EI-007
// Facade over the learning domain services. Exposes the API surface:
// record / list / get / timeline events, aggregation models, insights,
// recommendations with the human-approval safety workflow (approve /
// reject / rollback — versioned + audited), analytics, reports, and the
// Enterprise Learning Dashboard aggregate. Everything composes the six
// existing EI engines through narrow ports — no engine logic duplicated,
// no AI calls.
// ──────────────────────────────────────────────────────────────────

import type { PaginationParams } from '@vedmoulya/core';
import type { LearningEngines } from '../contracts/learning-engines.js';
import type { LearningRepository } from '../domain/repository/LearningRepository.js';
import { LearningAggregationService } from '../domain/services/LearningAggregationService.js';
import { LearningRecommendationService } from '../domain/services/LearningRecommendationService.js';
import { LearningInsightService } from '../domain/services/LearningInsightService.js';
import { LearningReportService } from '../domain/services/LearningReportService.js';
import { LearningSafetyService } from '../domain/services/LearningSafetyService.js';
import { validateLearningEvent } from '../domain/rules/LearningRules.js';
import type { LearningSafetyThresholds } from '../domain/rules/LearningRules.js';
import { generateLearningEventId } from '../domain/value-objects/LearningEventId.js';
import type {
  LearningEvent,
  LearningModel,
  LearningRecommendation,
} from '../types/learning-types.js';
import type { AggregationOptions } from '../domain/services/LearningAggregationService.js';
import type { InsightOptions } from '../domain/services/LearningInsightService.js';
import type { RecommendationOptions } from '../domain/services/LearningRecommendationService.js';
import { LearningMapper } from './LearningMapper.js';
import type {
  LearningAnalyticsDTO,
  LearningApprovalDTO,
  LearningCategoryQueryDTO,
  LearningDashboardDTO,
  LearningDecisionDTO,
  LearningEventDTO,
  LearningEventQueryDTO,
  LearningInsightDTO,
  LearningModelDTO,
  LearningModelQueryDTO,
  LearningRecommendationDTO,
  LearningReportDTO,
  LearningTimelineDTO,
  RecordLearningEventDTO,
} from './LearningDTO.js';

export interface LearningResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LearningApplicationOptions {
  safety?: Partial<LearningSafetyThresholds>;
  aggregation?: AggregationOptions;
  insight?: InsightOptions;
  recommendation?: RecommendationOptions;
}

const RECENT_EVENT_LIMIT = 50;

export class LearningIntelligenceApplicationService {
  private readonly aggregation: LearningAggregationService;
  private readonly recommendations: LearningRecommendationService;
  private readonly insights: LearningInsightService;
  private readonly reports: LearningReportService;
  readonly safety: LearningSafetyService;

  constructor(
    private readonly repository: LearningRepository,
    private readonly engines: LearningEngines,
    options: LearningApplicationOptions = {},
  ) {
    this.safety = new LearningSafetyService(options.safety);
    this.aggregation = new LearningAggregationService(options.aggregation);
    this.recommendations = new LearningRecommendationService(options.recommendation);
    this.insights = new LearningInsightService(options.insight);
    this.reports = new LearningReportService();
  }

  // ── RecordLearningEvent ───────────────────────────────────────────────────

  async recordEvent(dto: RecordLearningEventDTO): Promise<LearningResult<LearningEventDTO>> {
    const event: LearningEvent = {
      eventId: generateLearningEventId(),
      category: dto.category,
      entityType: dto.entityType,
      entityId: dto.entityId,
      entityLabel: dto.entityLabel ?? dto.entityId,
      outcome: dto.outcome,
      confidence: dto.confidence,
      costUsd: dto.costUsd,
      latencyMs: dto.latencyMs,
      accuracy: dto.accuracy,
      retries: dto.retries,
      quality: dto.quality,
      feedback: dto.feedback,
      businessOutcome: dto.businessOutcome,
      sourceRef: dto.sourceRef,
      metadata: dto.metadata ?? {},
      occurredAt: dto.occurredAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const validation = validateLearningEvent(event);
    if (!validation.passed) {
      return { success: false, error: validation.message ?? 'Invalid learning event' };
    }
    await this.repository.saveEvent(event);
    return { success: true, data: LearningMapper.eventToDTO(event) };
  }

  // ── ListEvents / GetEvent / Timeline ─────────────────────────────────────

  async listEvents(
    dto: LearningEventQueryDTO,
  ): Promise<LearningResult<{ items: LearningEventDTO[]; total: number }>> {
    const pagination: PaginationParams = { page: dto.page ?? 1, limit: dto.limit ?? 50 };
    const result = await this.repository.listEvents(
      { category: dto.category, outcome: dto.outcome, entityId: dto.entityId },
      pagination,
    );
    return {
      success: true,
      data: { items: result.data.map((e) => LearningMapper.eventToDTO(e)), total: result.total },
    };
  }

  async getEvent(eventId: string): Promise<LearningResult<LearningEventDTO>> {
    const event = await this.repository.findEventById(eventId);
    if (!event) return { success: false, error: `Learning event not found: ${eventId}` };
    return { success: true, data: LearningMapper.eventToDTO(event) };
  }

  async getTimeline(dto: LearningTimelineDTO = {}): Promise<LearningResult<LearningEventDTO[]>> {
    const limit = Math.max(1, Math.min(200, dto.limit ?? RECENT_EVENT_LIMIT));
    const events = await this.repository.listAllEvents();
    const recent = [...events]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, limit);
    return { success: true, data: recent.map((e) => LearningMapper.eventToDTO(e)) };
  }

  // ── Models / Insights ────────────────────────────────────────────────────

  async getModels(dto: LearningModelQueryDTO = {}): Promise<LearningResult<LearningModelDTO[]>> {
    const models = await this.buildModels();
    const filtered = dto.category ? models.filter((m) => m.category === dto.category) : models;
    return { success: true, data: filtered.map((m) => LearningMapper.modelToDTO(m)) };
  }

  async getInsights(
    dto: LearningCategoryQueryDTO = {},
  ): Promise<LearningResult<LearningInsightDTO[]>> {
    const models = await this.buildModels();
    const insights = this.insights.generateInsights(models);
    const filtered = dto.category ? insights.filter((i) => i.category === dto.category) : insights;
    return { success: true, data: filtered.map((i) => LearningMapper.insightToDTO(i)) };
  }

  // ── Recommendations + human-approval safety workflow ─────────────────────

  async getRecommendations(
    dto: LearningCategoryQueryDTO = {},
  ): Promise<LearningResult<LearningRecommendationDTO[]>> {
    const [models, decisions] = await Promise.all([
      this.buildModels(),
      this.repository.listDecisions(),
    ]);
    const generated = await this.recommendations.generateRecommendations(
      models,
      this.engines,
      this.safety.thresholds,
    );
    const overlaid = this.overlayDecisions(generated, decisions);
    const filtered = dto.category ? overlaid.filter((r) => r.category === dto.category) : overlaid;
    return { success: true, data: filtered.map((r) => LearningMapper.recommendationToDTO(r)) };
  }

  async getRecommendation(
    recommendationId: string,
  ): Promise<LearningResult<LearningRecommendationDTO>> {
    const [models, decisions] = await Promise.all([
      this.buildModels(),
      this.repository.listDecisions(),
    ]);
    const generated = await this.recommendations.generateRecommendations(
      models,
      this.engines,
      this.safety.thresholds,
    );
    const recommendation = this.overlayDecisions(generated, decisions).find(
      (r) => r.recommendationId === recommendationId,
    );
    if (!recommendation) {
      return { success: false, error: `Recommendation not found: ${recommendationId}` };
    }
    return { success: true, data: LearningMapper.recommendationToDTO(recommendation) };
  }

  async approveRecommendation(
    dto: LearningApprovalDTO,
  ): Promise<LearningResult<LearningDecisionDTO>> {
    return this.decide(dto, 'approve');
  }

  async rejectRecommendation(
    dto: LearningApprovalDTO,
  ): Promise<LearningResult<LearningDecisionDTO>> {
    return this.decide(dto, 'reject');
  }

  async rollbackRecommendation(
    dto: LearningApprovalDTO,
  ): Promise<LearningResult<LearningDecisionDTO>> {
    return this.decide(dto, 'rollback');
  }

  // ── Analytics / Reports / Dashboard ──────────────────────────────────────

  async getAnalytics(
    dto: LearningCategoryQueryDTO = {},
  ): Promise<LearningResult<LearningAnalyticsDTO>> {
    const [events, models] = await Promise.all([
      this.repository.listAllEvents(),
      this.buildModels(),
    ]);
    const filteredEvents = dto.category
      ? events.filter((e) => e.category === dto.category)
      : events;
    const filteredModels = dto.category
      ? models.filter((m) => m.category === dto.category)
      : models;
    return {
      success: true,
      data: LearningMapper.analyticsToDTO({
        trend: this.aggregation.trend(filteredEvents),
        byCategory: this.aggregation.categoryStats(filteredEvents, filteredModels),
        events: filteredEvents,
        models: filteredModels,
      }),
    };
  }

  async getReports(
    dto: LearningCategoryQueryDTO = {},
  ): Promise<LearningResult<LearningReportDTO[]>> {
    const [events, models] = await Promise.all([
      this.repository.listAllEvents(),
      this.buildModels(),
    ]);
    const filteredEvents = dto.category
      ? events.filter((e) => e.category === dto.category)
      : events;
    const filteredModels = dto.category
      ? models.filter((m) => m.category === dto.category)
      : models;
    const reports = this.reports.generateAll(filteredEvents, filteredModels);
    return { success: true, data: reports.map((r) => LearningMapper.reportToDTO(r)) };
  }

  async getDashboard(): Promise<LearningResult<LearningDashboardDTO>> {
    const [events, decisions] = await Promise.all([
      this.repository.listAllEvents(),
      this.repository.listDecisions(),
    ]);
    const models = this.aggregation.aggregate(events);
    const insights = this.insights.generateInsights(models);
    const generated = await this.recommendations.generateRecommendations(
      models,
      this.engines,
      this.safety.thresholds,
    );
    const recommendations = this.overlayDecisions(generated, decisions);
    const reports = this.reports.generateAll(events, models);

    return {
      success: true,
      data: LearningMapper.dashboardToDTO({
        events,
        models,
        recommendations,
        insights,
        reports,
        trend: this.aggregation.trend(events),
        byCategory: this.aggregation.categoryStats(events, models),
        pendingApprovals: decisions.filter((d) => d.status === 'pending').length,
        approved: decisions.filter((d) => d.status === 'approved').length,
      }),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async buildModels(): Promise<LearningModel[]> {
    const events = await this.repository.listAllEvents();
    return this.aggregation.aggregate(events);
  }

  /**
   * Overlay persisted approval decisions onto freshly generated
   * recommendations: a decision changes the recommendation's status,
   * version, and last-updated time. Undecided recommendations stay pending.
   */
  private overlayDecisions(
    recommendations: LearningRecommendation[],
    decisions: Awaited<ReturnType<LearningRepository['listDecisions']>>,
  ): LearningRecommendation[] {
    return recommendations.map((recommendation) => {
      const decision = decisions.find(
        (d) => d.recommendationId === recommendation.recommendationId,
      );
      if (!decision || decision.status === 'pending') return recommendation;
      return {
        ...recommendation,
        status: decision.status,
        version: decision.version,
        updatedAt: decision.updatedAt,
      };
    });
  }

  private async decide(
    dto: LearningApprovalDTO,
    action: 'approve' | 'reject' | 'rollback',
  ): Promise<LearningResult<LearningDecisionDTO>> {
    const { recommendationId, actor, note } = dto;
    if (!actor || actor.trim().length === 0) {
      return { success: false, error: 'actor is required for learning decisions' };
    }

    // Re-derive the recommendation + its model (approval is gated on data).
    const [models, decisions] = await Promise.all([
      this.buildModels(),
      this.repository.listDecisions(),
    ]);
    const generated = await this.recommendations.generateRecommendations(
      models,
      this.engines,
      this.safety.thresholds,
    );
    const recommendation = generated.find((r) => r.recommendationId === recommendationId);
    if (!recommendation) {
      return { success: false, error: `Recommendation not found: ${recommendationId}` };
    }

    let decision = decisions.find((d) => d.recommendationId === recommendationId);
    if (!decision) {
      decision = this.safety.createDecision(recommendation, actor);
    }

    try {
      if (action === 'approve') {
        const model = models.find(
          (m) =>
            m.entityId === recommendation.targetEntity.entityId &&
            m.category === recommendation.category,
        );
        const gate = this.safety.canApprove(model);
        if (!gate.allowed) {
          return {
            success: false,
            error: `Approval blocked by safety gate: ${gate.reasons.join('; ')}`,
          };
        }
        decision = this.safety.approve(decision, actor, note);
      } else if (action === 'reject') {
        decision = this.safety.reject(decision, actor, note);
      } else {
        decision = this.safety.rollback(decision, actor, note);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid decision transition',
      };
    }

    await this.repository.saveDecision(decision);
    return { success: true, data: LearningMapper.decisionToDTO(decision) };
  }
}
