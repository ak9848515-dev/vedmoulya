// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge HTTP Routes
// Hono router for all knowledge graph REST API endpoints
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { KnowledgeApplicationService } from '@vedmoulya/services';
import { KnowledgeController } from '../controllers/KnowledgeController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

/** Create the knowledge router with all endpoints */
export function createKnowledgeRouter(knowledgeService: KnowledgeApplicationService): Hono {
  const controller = new KnowledgeController(knowledgeService);
  const router = new Hono();

  // ── Global Middleware ────────────────────────────────────────────────────
  // CORS restricted to API_CORS_ORIGIN (comma-separated) when set; permissive
  // '*' default preserves backward compatibility for local development.
  const corsRaw = process.env.API_CORS_ORIGIN?.trim();
  const parsedOrigins = corsRaw
    ? corsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['*'];
  const corsOrigins = parsedOrigins.length > 0 ? parsedOrigins : ['*'];
  router.use('*', cors({ origin: corsOrigins }));
  router.use('*', logger());
  router.use('*', errorMiddleware);

  // ── Graph Management ────────────────────────────────────────────────────
  router.post('/graphs', (c) => controller.createGraph(c));
  router.get('/graphs', (c) => controller.listGraphs(c));
  router.get('/graphs/:id', (c) => controller.getGraph(c));
  router.delete('/graphs/:id', (c) => controller.deleteGraph(c));
  router.get('/graphs/:id/cycles', (c) => controller.detectCycles(c));
  router.get('/graphs/:id/statistics', (c) => controller.graphStatistics(c));
  router.get('/graphs/:graphId/nodes', (c) => controller.listNodesByGraph(c));

  // ── Node Management ─────────────────────────────────────────────────────
  router.post('/nodes', (c) => controller.createNode(c));
  router.get('/nodes/:id', (c) => controller.getNode(c));
  router.patch('/nodes/:id', (c) => controller.updateNode(c));
  router.delete('/nodes/:id', (c) => controller.deleteNode(c));
  router.post('/nodes/merge', (c) => controller.mergeNodes(c));
  router.post('/nodes/split', (c) => controller.splitNode(c));

  // ── Node Traversal & Analysis ──────────────────────────────────────────
  router.get('/nodes/:id/traverse', (c) => controller.traverse(c));
  router.get('/nodes/:id/shortest-path', (c) => controller.shortestPath(c));
  router.get('/nodes/:id/related', (c) => controller.relatedKnowledge(c));
  router.get('/nodes/:id/impact', (c) => controller.analyzeImpact(c));

  // ── Node Edges ──────────────────────────────────────────────────────────
  router.get('/nodes/:id/edges', (c) => controller.getNodeEdges(c));

  // ── Edge Management ────────────────────────────────────────────────────
  router.post('/edges', (c) => controller.createEdge(c));
  router.delete('/edges/:id', (c) => controller.deleteEdge(c));

  // ── Search ──────────────────────────────────────────────────────────────
  router.get('/search', (c) => controller.search(c));

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (c) => controller.health(c));

  return router;
}

/** Knowledge routes configuration metadata for documentation */
export const knowledgeRouteConfig = {
  basePath: '/api/v1/knowledge',
  tags: ['Knowledge Graph'],
  description: 'Knowledge Graph management API — nodes, edges, traversal, search, and analysis',
} as const;
