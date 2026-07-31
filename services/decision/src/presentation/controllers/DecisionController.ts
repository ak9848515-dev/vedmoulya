// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Controller
// HTTP controller handling all decision engine API operations
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Context } from 'hono';
import { BaseController } from '@vedmoulya/core';
import type { DecisionApplicationService } from '@vedmoulya/services';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';
import {
  createDecisionSchema,
  updateDecisionSchema,
  addOptionSchema,
  scoreOptionSchema,
  assessRiskSchema,
  assessOpportunitySchema,
  decideSchema,
  completeDecisionSchema,
  searchQuery,
} from '../validation/DecisionSchemas.js';

export class DecisionController extends BaseController {
  private readonly decisionService: DecisionApplicationService;

  constructor(decisionService: DecisionApplicationService) {
    super('decision');
    this.decisionService = decisionService;
  }

  // ── Decision CRUD ─────────────────────────────────────────────────────────

  /** POST /decisions */
  async createDecision(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createDecisionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.createDecision(parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'CREATE_ERROR', message: result.error ?? 'Create failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /decisions/:id */
  async getDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.decisionService.getDecision(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** PATCH /decisions/:id */
  async updateDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateDecisionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.updateDecision(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** DELETE /decisions/:id */
  async deleteDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      // Decisions are archived rather than hard-deleted
      const result = await this.decisionService.archiveDecision(id, 'User requested deletion');
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: { message: 'Decision archived' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Lifecycle Operations ──────────────────────────────────────────────────

  /** POST /decisions/:id/analyze */
  async startAnalysis(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.decisionService.startAnalysis(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/evaluate */
  async startEvaluation(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.decisionService.startEvaluation(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/options */
  async addOption(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = addOptionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.addOption(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/options/:optionId/score */
  async scoreOption(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = scoreOptionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.scoreOption(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/options/:optionId/risk */
  async assessRisk(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = assessRiskSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.assessRisk(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/options/:optionId/opportunity */
  async assessOpportunity(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = assessOpportunitySchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.assessOpportunity(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /decisions/:id/rankings */
  async rankOptions(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.decisionService.rankOptions(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /decisions/:id/compare/:optionA/:optionB */
  async compareOptions(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const optionA = c.req.param('optionA') ?? '';
      const optionB = c.req.param('optionB') ?? '';
      const result = await this.decisionService.compareOptions(id, optionA, optionB);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Comparison failed' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /decisions/:id/recommend */
  async recommend(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.decisionService.recommend(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/decide */
  async decide(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = decideSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.decide(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'DECIDE_ERROR', message: result.error ?? 'Decision failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/complete */
  async completeDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = completeDecisionSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const result = await this.decisionService.completeDecision(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'COMPLETE_ERROR', message: result.error ?? 'Complete failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/archive */
  async archiveDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const archiveBody = (await c.req.json().catch(() => ({}))) as { reason?: string };
      const result = await this.decisionService.archiveDecision(id, archiveBody.reason);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /decisions/:id/cancel */
  async cancelDecision(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const cancelBody = (await c.req.json().catch(() => ({}))) as { reason?: string };
      const result = await this.decisionService.cancelDecision(
        id,
        cancelBody.reason ?? 'Cancelled by user',
      );
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Decision not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Search & Statistics ──────────────────────────────────────────────────

  /** GET /decisions */
  async listDecisions(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = searchQuery.safeParse(query);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const { page, limit } = parsed.data;
      const result = await this.decisionService.listDecisions(page, limit);
      if (!result.success) {
        return c.json(
          { success: false, error: { code: 'LIST_ERROR', message: result.error ?? 'List failed' } },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /decisions/search */
  async searchDecisions(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = searchQuery.safeParse(query);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: { errors: JSON.stringify(parsed.error.flatten()) },
            },
          },
          400,
        );
      }

      const { q, category, status, page, limit } = parsed.data;
      const result = await this.decisionService.searchDecisions({
        query: q,
        categories: category ? [category] : undefined,
        statuses: status ? [status] : undefined,
        page,
        limit,
      });
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'SEARCH_ERROR', message: result.error ?? 'Search failed' },
          },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Statistics ──────────────────────────────────────────────────────────

  /** GET /decisions/stats */
  async getStatistics(c: Context): Promise<Response> {
    try {
      const result = await this.decisionService.getStats();
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'STATS_ERROR', message: result.error ?? 'Stats failed' },
          },
          500,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────

  /** GET /health */
  health(c: Context): Response {
    return c.json({ status: 'healthy', service: 'decision' });
  }
}
