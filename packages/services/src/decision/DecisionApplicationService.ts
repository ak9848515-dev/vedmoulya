// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Application Service
// Core orchestration service for all decision operations
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// BLD-005 — AI Orchestrator Integration (use only BLD-005 contracts)
// BLD-006 — Knowledge Graph Integration (consume only)
// BLD-007 — Memory Engine Integration (consume only)
// ──────────────────────────────────────────────────────────────────

import type { DecisionRepository } from '@vedmoulya/domain';
import { DecisionFactory } from '@vedmoulya/domain';
import { DecisionDomainService } from '@vedmoulya/domain';
import {
  decisionContentRule,
  reasoningRequiredRule,
  outcomeRequiredRule,
  validate,
} from '@vedmoulya/domain';
import type {
  CreateDecisionDTO,
  UpdateDecisionDTO,
  AddOptionDTO,
  ScoreOptionDTO,
  AssessRiskDTO,
  AssessOpportunityDTO,
  CompleteDecisionDTO,
  DecideDTO,
  DecisionDTO,
  DecisionListDTO,
  DecisionStatsDTO,
  RankingDTO,
  RecommendationDTO,
  TradeoffDTO,
} from './DecisionDTO.js';
import { DecisionMapper } from './DecisionMapper.js';
import {
  DecisionScore,
  DecisionRisk,
  DecisionOpportunity,
  DecisionReasoning,
  DecisionOutcome,
} from '@vedmoulya/domain';

export class DecisionApplicationService {
  private readonly repository: DecisionRepository;
  private readonly factory: DecisionFactory;
  private readonly domainService: DecisionDomainService;

  constructor(repository: DecisionRepository) {
    this.repository = repository;
    this.factory = new DecisionFactory(repository);
    this.domainService = new DecisionDomainService(repository);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  /** Create a new decision */
  async createDecision(
    dto: CreateDecisionDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const result = await this.factory.createDecision({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      priorityScore: dto.priorityScore,
      initiator: dto.initiator,
      request: dto.requester
        ? {
            requester: dto.requester,
            reason: dto.requestReason ?? '',
            context: dto.requestContext ?? '',
          }
        : undefined,
      knowledgeNodeIds: dto.knowledgeNodeIds,
      memoryIds: dto.memoryIds,
      tags: dto.tags,
      metadata: dto.metadata,
    });

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Failed to create decision' };
    }

    const decision = result.data;
    const validation = validate([decisionContentRule], decision);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    await this.repository.save(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Get a decision by ID */
  async getDecision(id: string): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) {
      return { success: false, error: `Decision not found: ${id}` };
    }
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Update a decision */
  async updateDecision(
    id: string,
    dto: UpdateDecisionDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) {
      return { success: false, error: `Decision not found: ${id}` };
    }

    if (dto.title) decision.updateTitle(dto.title);
    if (dto.description) decision.updateDescription(dto.description);
    if (dto.priorityScore !== undefined) {
      const priority = DecisionDomainService.calculatePriority({
        urgency: dto.priorityScore,
        impact: dto.priorityScore,
        timeSensitivity: dto.priorityScore,
        strategicAlignment: dto.priorityScore,
        stakeholderPressure: dto.priorityScore,
      });
      decision.updatePriority(priority);
    }
    if (dto.tags) {
      for (const tag of dto.tags) decision.addTag(tag);
    }
    if (dto.metadata) decision.updateMetadata(dto.metadata);

    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  // ── Lifecycle Operations ────────────────────────────────────────────────

  /** Start analysis phase */
  async startAnalysis(
    id: string,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    decision.startAnalysis();
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Add an option and start evaluation */
  async addOption(
    id: string,
    dto: AddOptionDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    decision.addOption({
      id: `opt_${crypto.randomUUID().slice(0, 8)}`,
      label: dto.label,
      description: dto.description,
      pros: dto.pros,
      cons: dto.cons,
      estimatedEffort: dto.estimatedEffort,
      estimatedCost: dto.estimatedCost,
    });

    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Start evaluation phase */
  async startEvaluation(
    id: string,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    decision.startEvaluation();
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Score an option */
  async scoreOption(
    id: string,
    dto: ScoreOptionDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const score = DecisionScore.compute(dto.criteria);
    decision.scoreOption(dto.optionId, score);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Assess risk for an option */
  async assessRisk(
    id: string,
    dto: AssessRiskDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const risk = DecisionRisk.fromScore(dto.riskScore, dto.description, dto.mitigation);
    decision.assessRisk(dto.optionId, risk);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Assess opportunity for an option */
  async assessOpportunity(
    id: string,
    dto: AssessOpportunityDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const opportunity = DecisionOpportunity.fromScore(
      dto.opportunityScore,
      dto.description,
      dto.expectedValue,
    );
    decision.assessOpportunity(dto.optionId, opportunity);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Rank all options */
  async rankOptions(
    id: string,
  ): Promise<{ success: boolean; data?: RankingDTO[]; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const result = this.domainService.rankOptions(decision);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Ranking failed' };
    }
    return { success: true, data: DecisionMapper.toRankingDTO(result.data) };
  }

  /** Compare two options */
  async compareOptions(
    id: string,
    optionAId: string,
    optionBId: string,
  ): Promise<{ success: boolean; data?: TradeoffDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const result = this.domainService.compareOptions(decision, optionAId, optionBId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Comparison failed' };
    }
    return { success: true, data: DecisionMapper.toTradeoffDTO(result.data) };
  }

  /** Detect conflicts between options */
  async detectConflicts(id: string): Promise<{
    success: boolean;
    data?: Array<{ optionA: string; optionB: string; reason: string }>;
    error?: string;
  }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    return { success: true, data: decision.detectConflicts() };
  }

  /** Evaluate constraints */
  async evaluateConstraints(id: string): Promise<{
    success: boolean;
    data?: Array<{ optionId: string; violated: string[] }>;
    error?: string;
  }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    const results = decision.evaluateConstraints();
    return {
      success: true,
      data: results.map((r) => ({
        optionId: r.optionId,
        violated: r.violated.map((v) => v.toString()),
      })),
    };
  }

  /** Get recommendation */
  async recommend(
    id: string,
  ): Promise<{ success: boolean; data?: RecommendationDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const result = this.domainService.recommend(decision);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Recommendation failed' };
    }
    return { success: true, data: DecisionMapper.toRecommendationDTO(result.data) };
  }

  /** Make the decision */
  async decide(
    id: string,
    dto: DecideDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const reasoning = new DecisionReasoning({
      method: dto.reasoningMethod as never,
      summary: dto.reasoningSummary,
      assumptions: dto.assumptions,
      pros: dto.pros,
      cons: dto.cons,
    });

    decision.decide(dto.optionId, reasoning);
    decision.updateConfidence(DecisionDomainService.calculateConfidence(decision));

    const validation = validate([reasoningRequiredRule], decision);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Complete the decision */
  async completeDecision(
    id: string,
    dto: CompleteDecisionDTO,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };

    const outcome = new DecisionOutcome({
      result: dto.result,
      description: dto.description,
      actualImpact: dto.actualImpact,
      lessons: dto.lessons,
    });

    decision.complete(outcome);

    const validation = validate([outcomeRequiredRule], decision);
    if (!validation.valid) {
      return { success: false, error: validation.message };
    }

    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Archive a decision */
  async archiveDecision(
    id: string,
    reason?: string,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    decision.archive(reason);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  /** Cancel a decision */
  async cancelDecision(
    id: string,
    reason: string,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    decision.cancel(reason);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }

  // ── List & Search ───────────────────────────────────────────────────────

  /** List decisions with pagination */
  async listDecisions(
    page: number = 1,
    limit: number = 20,
  ): Promise<{ success: boolean; data?: DecisionListDTO; error?: string }> {
    try {
      const total = await this.repository.count();
      const result = await this.repository.search({ query: '' }, { page, limit });
      return {
        success: true,
        data: DecisionMapper.toListDTO(result.data, total, page, limit),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'List error' };
    }
  }

  /** Search decisions with filters */
  async searchDecisions(params: {
    query?: string;
    categories?: string[];
    statuses?: string[];
    page?: number;
    limit?: number;
  }): Promise<{ success: boolean; data?: DecisionListDTO; error?: string }> {
    try {
      const searchParams = {
        query: params.query ?? '',
        categories: params.categories,
        statuses: params.statuses,
      } as import('@vedmoulya/domain').DecisionSearchParams;
      const pagination = { page: params.page ?? 1, limit: params.limit ?? 20 };
      const result = await this.repository.search(searchParams, pagination);
      return {
        success: true,
        data: DecisionMapper.toListDTO(
          result.data,
          result.total,
          pagination.page,
          pagination.limit,
        ),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Search error' };
    }
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  /** Get decision statistics */
  async getStats(): Promise<{
    success: boolean;
    data?: DecisionStatsDTO;
    error?: string;
  }> {
    try {
      const [total, byCategory, byStatus, linkedCount] = await Promise.all([
        this.repository.count(),
        this.repository.countByCategory(),
        this.repository.countByStatus(),
        this.repository.countLinked(),
      ]);
      return {
        success: true,
        data: DecisionMapper.toStatsDTO({ total, byCategory, byStatus, linkedCount }),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Stats error' };
    }
  }

  /** Re-evaluate a decision */
  async reEvaluateDecision(
    id: string,
    reason: string,
  ): Promise<{ success: boolean; data?: DecisionDTO; error?: string }> {
    const decision = await this.repository.findById(id as never);
    if (!decision) return { success: false, error: `Decision not found: ${id}` };
    decision.reEvaluate(reason);
    await this.repository.update(decision);
    return { success: true, data: DecisionMapper.toDTO(decision) };
  }
}
