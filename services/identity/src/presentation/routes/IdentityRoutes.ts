// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity HTTP Routes
// Hono router for all identity REST API endpoints
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { IdentityApplicationService } from '@vedmoulya/services';
import { IdentityController } from '../controllers/IdentityController.js';
import { errorMiddleware } from '../middleware/ErrorMapper.js';

/** Create the identity router with all endpoints */
export function createIdentityRouter(identityService: IdentityApplicationService): Hono {
  const controller = new IdentityController(identityService);
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

  // ── User Registration & Validation ──────────────────────────────────────
  router.post('/users', (c) => controller.registerUser(c));
  router.post('/users/validate', (c) => controller.validateRegistration(c));

  // ── User Lookup ─────────────────────────────────────────────────────────
  router.get('/users', (c) => controller.listUsers(c));
  // NOTE: /email/:email must come BEFORE /:id to avoid Hono matching 'email' as the :id param
  router.get('/users/email/:email', (c) => controller.getUserByEmail(c));
  router.get('/users/:id', (c) => controller.getUserById(c));

  // ── User Profile & Preferences ──────────────────────────────────────────
  router.patch('/users/:id/profile', (c) => controller.updateProfile(c));
  router.patch('/users/:id/preferences', (c) => controller.updatePreferences(c));
  router.patch('/users/:id/settings', (c) => controller.updateSettings(c));

  // ── User Lifecycle ──────────────────────────────────────────────────────
  router.post('/users/:id/activate', (c) => controller.activateUser(c));
  router.post('/users/:id/deactivate', (c) => controller.deactivateUser(c));
  router.delete('/users/:id', (c) => controller.deleteUser(c));

  // ── Authentication Check ────────────────────────────────────────────────
  router.get('/users/:id/auth-check', (c) => controller.checkAuthentication(c));

  // ── Health ──────────────────────────────────────────────────────────────
  router.get('/health', (c) => c.json({ status: 'healthy', service: 'identity' }));

  return router;
}

/** Identity routes configuration metadata for documentation */
export const identityRouteConfig = {
  basePath: '/api/v1/identity',
  tags: ['Identity'],
  description: 'Identity management and user lifecycle API',
} as const;
