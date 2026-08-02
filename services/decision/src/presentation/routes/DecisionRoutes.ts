// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision HTTP Routes
// Hono router for all decision engine REST API endpoints
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { DecisionApplicationService } from '@vedmoulya/services';
import { DecisionController } from '../controllers/DecisionController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

/** Create the decision router with all endpoints */
export function createDecisionRouter(decisionService: DecisionApplicationService): Hono {
  const controller = new DecisionController(decisionService);
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

  // ── Decision CRUD ─────────────────────────────────────────────────────────
  router.post('/decisions', (c) => controller.createDecision(c));
  router.get('/decisions', (c) => controller.listDecisions(c));

  // Search & Statistics (registered before /decisions/:id so the static
  // segments win over the parameterized route)
  router.get('/decisions/search', (c) => controller.searchDecisions(c));
  router.get('/decisions/stats', (c) => controller.getStatistics(c));

  router.get('/decisions/:id', (c) => controller.getDecision(c));
  router.patch('/decisions/:id', (c) => controller.updateDecision(c));
  router.delete('/decisions/:id', (c) => controller.deleteDecision(c));

  // ── Lifecycle ────────────────────────────────────────────────────────────
  router.post('/decisions/:id/analyze', (c) => controller.startAnalysis(c));
  router.post('/decisions/:id/evaluate', (c) => controller.startEvaluation(c));
  router.post('/decisions/:id/options', (c) => controller.addOption(c));
  router.post('/decisions/:id/options/:optionId/score', (c) => controller.scoreOption(c));
  router.post('/decisions/:id/options/:optionId/risk', (c) => controller.assessRisk(c));
  router.post('/decisions/:id/options/:optionId/opportunity', (c) =>
    controller.assessOpportunity(c),
  );
  router.get('/decisions/:id/rankings', (c) => controller.rankOptions(c));
  router.get('/decisions/:id/recommend', (c) => controller.recommend(c));
  router.post('/decisions/:id/decide', (c) => controller.decide(c));
  router.post('/decisions/:id/complete', (c) => controller.completeDecision(c));
  router.post('/decisions/:id/archive', (c) => controller.archiveDecision(c));
  router.post('/decisions/:id/cancel', (c) => controller.cancelDecision(c));
  router.get('/decisions/:id/compare/:optionA/:optionB', (c) => controller.compareOptions(c));

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (c) => controller.health(c));

  return router;
}

/** Decision routes configuration metadata for documentation */
export const decisionRouteConfig = {
  basePath: '/api/v1/decision',
  tags: ['Decision Intelligence Engine'],
  description:
    'Decision Engine API — create, analyze, evaluate, score, rank, decide, and complete decisions with full lifecycle management',
} as const;
