// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory HTTP Routes
// Hono router for all memory engine REST API endpoints
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { MemoryApplicationService } from '@vedmoulya/services';
import { MemoryController } from '../controllers/MemoryController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

/** Create the memory router with all endpoints */
export function createMemoryRouter(memoryService: MemoryApplicationService): Hono {
  const controller = new MemoryController(memoryService);
  const router = new Hono();

  // ── Global Middleware ────────────────────────────────────────────────────
  router.use('*', cors());
  router.use('*', logger());
  router.use('*', errorMiddleware);

  // ── Memory CRUD ─────────────────────────────────────────────────────────
  router.post('/memories', (c) => controller.captureMemory(c));
  router.get('/memories/:id', (c) => controller.recallMemory(c));
  router.patch('/memories/:id', (c) => controller.updateMemory(c));
  router.delete('/memories/:id', (c) => controller.forgetMemory(c));

  // ── Memory Lifecycle ────────────────────────────────────────────────────
  router.post('/memories/:id/strengthen', (c) => controller.strengthenMemory(c));
  router.post('/memories/:id/weaken', (c) => controller.weakenMemory(c));
  router.post('/memories/:id/archive', (c) => controller.archiveMemory(c));
  router.post('/memories/:id/restore', (c) => controller.restoreMemory(c));
  router.get('/memories/:id/timeline', (c) => controller.getTimeline(c));

  // ── Advanced Operations ─────────────────────────────────────────────────
  router.post('/memories/merge', (c) => controller.mergeMemories(c));

  // ── Search & Statistics ─────────────────────────────────────────────────
  router.get('/search', (c) => controller.search(c));
  router.get('/stats', (c) => controller.getStatistics(c));

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (c) => controller.health(c));

  return router;
}

/** Memory routes configuration metadata for documentation */
export const memoryRouteConfig = {
  basePath: '/api/v1/memory',
  tags: ['Memory Engine'],
  description: 'Memory Engine API — capture, recall, strengthen, timeline, search, and retention',
} as const;
