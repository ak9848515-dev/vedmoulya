// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Controller
// HTTP controller handling all knowledge graph API operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Context } from 'hono';
import { BaseController } from '@vedmoulya/core';
import type { KnowledgeApplicationService } from '@vedmoulya/services';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';
import {
  createGraphSchema,
  createNodeSchema,
  updateNodeSchema,
  createEdgeSchema,
  paginationQuery,
  traverseQuery,
  searchQuery,
  mergeNodesSchema,
  splitNodeSchema,
} from '../validation/KnowledgeSchemas.js';

export class KnowledgeController extends BaseController {
  private readonly knowledgeService: KnowledgeApplicationService;

  constructor(knowledgeService: KnowledgeApplicationService) {
    super('knowledge');
    this.knowledgeService = knowledgeService;
  }

  // ── Graph Endpoints ──────────────────────────────────────────────────────

  /** POST /graphs */
  async createGraph(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createGraphSchema.safeParse(body);

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

      const result = await this.knowledgeService.createGraph(parsed.data);
      return c.json({ success: true, data: result }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /graphs/:id */
  async getGraph(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.getGraph(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /graphs */
  async listGraphs(c: Context): Promise<Response> {
    try {
      const query = c.req.query();
      const parsed = paginationQuery.safeParse(query);
      const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
      const result = await this.knowledgeService.listGraphs({ page, limit });
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** DELETE /graphs/:id */
  async deleteGraph(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      await this.knowledgeService.deleteGraph(id);
      return c.json({ success: true, data: { message: 'Graph deleted' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Node Endpoints ───────────────────────────────────────────────────────

  /** POST /nodes */
  async createNode(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createNodeSchema.safeParse(body);

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

      const result = await this.knowledgeService.createNode(parsed.data);
      return c.json({ success: true, data: result }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /nodes/:id */
  async getNode(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.getNode(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** PATCH /nodes/:id */
  async updateNode(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateNodeSchema.safeParse(body);

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

      const result = await this.knowledgeService.updateNode(id, parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** DELETE /nodes/:id */
  async deleteNode(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      await this.knowledgeService.deleteNode(id);
      return c.json({ success: true, data: { message: 'Node deleted' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /graphs/:graphId/nodes */
  async listNodesByGraph(c: Context): Promise<Response> {
    try {
      const graphId = c.req.param('graphId') as string;
      const query = c.req.query();
      const parsed = paginationQuery.safeParse(query);
      const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };
      const result = await this.knowledgeService.listNodesByGraph(graphId, { page, limit });
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Edge Endpoints ───────────────────────────────────────────────────────

  /** POST /edges */
  async createEdge(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = createEdgeSchema.safeParse(body);

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

      const result = await this.knowledgeService.createEdge(parsed.data);
      return c.json({ success: true, data: result }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /nodes/:id/edges */
  async getNodeEdges(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.getNodeEdges(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** DELETE /edges/:id */
  async deleteEdge(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      await this.knowledgeService.deleteEdge(id);
      return c.json({ success: true, data: { message: 'Edge deleted' } });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Traversal Endpoints ──────────────────────────────────────────────────

  /** GET /nodes/:id/traverse */
  async traverse(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const query = c.req.query();
      const parsed = traverseQuery.safeParse(query);
      const maxDepth = parsed.success ? parsed.data.maxDepth : 5;
      const result = await this.knowledgeService.traverse(id, maxDepth);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /nodes/:id/shortest-path */
  async shortestPath(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const endNodeId = c.req.query('endNodeId');
      if (!endNodeId) {
        return c.json(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'endNodeId query parameter is required' },
          },
          400,
        );
      }
      const result = await this.knowledgeService.findShortestPath(id, endNodeId);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /nodes/:id/related */
  async relatedKnowledge(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.findRelatedKnowledge(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Advanced Operations ──────────────────────────────────────────────────

  /** GET /nodes/:id/impact */
  async analyzeImpact(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.analyzeImpact(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /graphs/:id/cycles */
  async detectCycles(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.detectCycles(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** GET /graphs/:id/statistics */
  async graphStatistics(c: Context): Promise<Response> {
    try {
      const id = c.req.param('id') as string;
      const result = await this.knowledgeService.getGraphStatistics(id);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /nodes/merge */
  async mergeNodes(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = mergeNodesSchema.safeParse(body);

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

      const result = await this.knowledgeService.mergeNodes(parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  /** POST /nodes/split */
  async splitNode(c: Context): Promise<Response> {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = splitNodeSchema.safeParse(body);

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

      const result = await this.knowledgeService.splitNode(parsed.data);
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Search Endpoints ─────────────────────────────────────────────────────

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

      const { q, page, limit } = parsed.data;
      const result = await this.knowledgeService.searchNodes(q, { page, limit });
      return c.json({ success: true, data: result });
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  }

  // ── Health ───────────────────────────────────────────────────────────────

  /** GET /health */
  health(c: Context): Response {
    return c.json({ status: 'healthy', service: 'knowledge' });
  }
}
