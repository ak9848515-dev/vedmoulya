// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication HTTP Routes
// Hono router for auth endpoints
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthService } from './AuthService.js';
import { mapErrorToResponse } from '../presentation/middleware/ErrorMapper.js';

// ── Request Schemas ────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().min(2).max(100),
  givenName: z.string().max(100).optional(),
  familyName: z.string().max(100).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Create the auth router with all authentication endpoints */
export function createAuthRouter(authService: AuthService): Hono {
  const router = new Hono();

  // ── Email/Password Sign-In ────────────────────────────────────────────
  router.post('/sign-in', async (c) => {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = signInSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }

      const result = await authService.signInWithEmail(parsed.data.email, parsed.data.password);

      if (!result.success) {
        return c.json(
          { success: false, error: { code: 'AUTH_FAILED' as const, message: result.error } },
          401,
        );
      }

      return c.json({ success: true, data: result.session }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Sign-Up / Registration ───────────────────────────────────────────
  router.post('/sign-up', async (c) => {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = signUpSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input',
              details: parsed.error.flatten(),
            },
          },
          400,
        );
      }

      const result = await authService.signUp(parsed.data);

      if (!result.success) {
        const status: 400 | 409 = result.error === 'Email already registered' ? 409 : 400;
        return c.json(
          {
            success: false,
            error: { code: 'REGISTRATION_FAILED' as const, message: result.error },
          },
          status,
        );
      }

      return c.json({ success: true, data: result.session }, 201);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Sign-Out ─────────────────────────────────────────────────────────
  router.post('/sign-out', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ success: true, data: { message: 'Signed out' } }, 200);
      }

      const token = authHeader.slice(7);
      const payload = await authService.verifySession(token);

      if (payload) {
        await authService.signOut(payload.sub);
      }

      return c.json({ success: true, data: { message: 'Signed out' } }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Token Refresh ────────────────────────────────────────────────────
  router.post('/refresh', async (c) => {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = refreshSchema.safeParse(body);

      if (!parsed.success) {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
          400,
        );
      }

      const result = await authService.refreshSession(parsed.data.refreshToken);

      if (!result) {
        return c.json(
          {
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid or expired refresh token' },
          },
          401,
        );
      }

      return c.json({ success: true, data: result.tokens }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Google OAuth ─────────────────────────────────────────────────────
  router.get('/google/url', (c) => {
    try {
      const state = crypto.randomUUID();
      const url = authService.getGoogleAuthUrl(state);
      return c.json({ success: true, data: { url, state } }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  router.get('/google/callback', async (c) => {
    try {
      const code = c.req.query('code');
      if (!code) {
        return c.json(
          {
            success: false,
            error: { code: 'MISSING_CODE', message: 'No authorization code provided' },
          },
          400,
        );
      }

      const result = await authService.signInWithGoogle(code);

      if (!result.success) {
        return c.json(
          { success: false, error: { code: 'GOOGLE_AUTH_FAILED', message: result.error } },
          401,
        );
      }

      return c.json({ success: true, data: result.session }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Session Verification ─────────────────────────────────────────────
  router.get('/session', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json(
          { success: false, error: { code: 'NO_TOKEN', message: 'No access token provided' } },
          401,
        );
      }

      const token = authHeader.slice(7);
      const payload = await authService.verifySession(token);

      if (!payload) {
        return c.json(
          {
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
          },
          401,
        );
      }

      return c.json(
        {
          success: true,
          data: {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
          },
        },
        200,
      );
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // ── Health ───────────────────────────────────────────────────────────
  router.get('/health', (c) => {
    return c.json({ status: 'healthy', service: 'auth' }, 200);
  });

  return router;
}

/** Auth routes configuration metadata */
export const authRouteConfig = {
  basePath: '/api/v1/identity/auth',
  tags: ['Authentication'],
  description: 'Authentication endpoints for sign-in, sign-up, OAuth, and token management',
} as const;
