// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Controller
// HTTP controller handling all memory engine API operations
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Context } from 'hono';
import { BaseController } from '@vedmoulya/core';
import type { MemoryApplicationService } from '@vedmoulya/services';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';
import {
  captureMemorySchema,
  updateMemorySchema,
  searchQuery,
  recallQuery,
} from '../validation/MemorySchemas.js';

export class MemoryController extends BaseController {
  private readonly memoryService: MemoryApplicationService;

  constructor(memoryService: MemoryApplicationService) {
    super('memory');
    this.memoryService = memoryService;
  }

  // ── Memory CRUD ─────────────────────────────────────────────────────────

  /** POST /memories */
  async captureMemory(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = captureMemorySchema.safeParse(body);

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

      const result = await this.memoryService.captureMemory(parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'CAPTURE_ERROR', message: result.error ?? 'Capture failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /memories/:id */
  async recallMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const query = c.req.query();
      const parsed = recallQuery.safeParse(query);
      const strengthen = parsed.success ? parsed.data.strengthen : true;
      const result = await this.memoryService.recallMemory(id, strengthen);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** PATCH /memories/:id */
  async updateMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateMemorySchema.safeParse(body);

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

      const result = await this.memoryService.updateMemory(id, parsed.data);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** DELETE /memories/:id */
  async forgetMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.forgetMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: { message: 'Memory forgotten' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Memory Lifecycle ────────────────────────────────────────────────────

  /** POST /memories/:id/strengthen */
  async strengthenMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.strengthenMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /memories/:id/weaken */
  async weakenMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.weakenMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /memories/:id/archive */
  async archiveMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.archiveMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /memories/:id/restore */
  async restoreMemory(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.restoreMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Advanced Operations ─────────────────────────────────────────────────

  /** POST /memories/merge */
  async mergeMemories(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const sourceIds = body.sourceIds as string[] | undefined;
      const targetId = body.targetId as string | undefined;

      if (!sourceIds || sourceIds.length === 0 || !targetId || !sourceIds[0]) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'sourceIds (array) and targetId are required',
            },
          },
          400,
        );
      }

      const result = await this.memoryService.mergeMemories(sourceIds[0], targetId);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'MERGE_ERROR', message: result.error ?? 'Merge failed' },
          },
          400,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Timeline ────────────────────────────────────────────────────────────

  /** GET /memories/:id/timeline */
  async getTimeline(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') ?? '';
      const result = await this.memoryService.getMemory(id);
      if (!result.success) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: result.error ?? 'Memory not found' },
          },
          404,
        );
      }
      return c.json({ success: true, data: result.data });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────

  /** GET /search */
  async search(c: Context): Promise<Response> {
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

      const { q, category, state, page, limit } = parsed.data;
      const result = await this.memoryService.searchMemories({
        query: q,
        categories: category ? [category] : undefined,
        states: state ? [state] : undefined,
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

  /** GET /stats */
  async getStatistics(c: Context): Promise<Response> {
    try {
      const result = await this.memoryService.getStats();
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
    return c.json({ status: 'healthy', service: 'memory' });
  }
}
