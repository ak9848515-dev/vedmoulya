// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication HTTP Routes
// Hono router for auth endpoints
// ──────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthService } from './AuthService.js';
import { mapErrorToResponse } from '../presentation/middleware/ErrorMapper.js';
import { updateProfileSchema } from '../presentation/validation/IdentitySchemas.js';

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

  // ── Email Verification (SPRINT-045) ──────────────────────────────────
  // POST /verify-email — consume the token from the emailed link. Token
  // validity is proven by possession (only the hash is stored), so these
  // endpoints are intentionally unauthenticated. Failures return 400 with a
  // distinct code — the UI maps them to user-facing copy.
  const verifyEmailSchema = z.object({ token: z.string().min(20) });
  router.post('/verify-email', async (c) => {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = verifyEmailSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
          400,
        );
      }
      const result = await authService.verifyEmail(parsed.data.token);
      if (!result.success) {
        return c.json(
          { success: false, error: { code: 'VERIFY_FAILED', message: result.error } },
          400,
        );
      }
      return c.json({ success: true, data: { verified: true } }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  // POST /resend-verification — always succeeds (no account enumeration):
  // unknown emails and already-verified accounts are indistinguishable from
  // a genuine resend.
  const resendVerificationSchema = z.object({ email: z.string().email() });
  router.post('/resend-verification', async (c) => {
    try {
      const body: Record<string, unknown> = await c.req.json();
      const parsed = resendVerificationSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
          400,
        );
      }
      await authService.resendVerificationEmail(parsed.data.email);
      return c.json({ success: true, data: { sent: true } }, 200);
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
      const origin = new URL(c.req.url).origin;
      const url = authService.getGoogleAuthUrl(state, origin);
      return c.json({ success: true, data: { url, state } }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  router.get('/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');

    // Browser navigation from Google (Accept: text/html) must get an HTML page
    // that completes the OAuth flow client-side.  Programmatic fetch requests
    // (Accept: application/json) get the existing JSON envelope.
    const accept = c.req.header('accept') ?? '';
    const isBrowserNavigation = accept.includes('text/html');

    if (!code) {
      if (isBrowserNavigation) {
        return c.html(
          '<html><body><script>window.location.replace("/login?error=missing_code")</script></body></html>',
          400,
        );
      }
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_CODE', message: 'No authorization code provided' },
        },
        400,
      );
    }

    if (isBrowserNavigation) {
      // Serve an HTML page that completes the OAuth exchange client-side
      // so the session is stored in the browser and the user lands on /.
      const escapedCode = code.replace(/[&<>"']/g, '');
      const escapedState = (state ?? '').replace(/[&<>"']/g, '');
      return c.html(
        `<!DOCTYPE html><html><head><meta charset='utf-8'><title>Signing in…</title></head><body>` +
          `<script>` +
          `(function(){` +
          `try{window.sessionStorage.setItem('vedmoulya-oauth-pending',` +
          `JSON.stringify({state:'${escapedState}',next:'/'}))}catch(e){}` +
          `fetch('/api/v1/identity/auth/google/callback?code=${escapedCode}&state=${escapedState}',` +
          `{headers:{'Accept':'application/json'}})` +
          `.then(function(r){return r.json()})` +
          `.then(function(d){` +
          `if(d.success&&d.data&&d.data.tokens){` +
          `var t=d.data.tokens;` +
          `try{` +
          `var s=JSON.parse(localStorage.getItem('vedmoulya-auth')||'{}');` +
          `s.state={accessToken:t.accessToken,refreshToken:t.refreshToken,` +
          `expiresAt:t.expiresAt,user:{userId:d.data.userId,email:d.data.email,` +
          `role:d.data.role,displayName:d.data.displayName,` +
          `profileComplete:d.data.profileComplete}};` +
          `localStorage.setItem('vedmoulya-auth',JSON.stringify(s))}catch(e){}` +
          `window.location.replace('/')` +
          `}else{window.location.replace('/login?error=google_failed')}` +
          `}).catch(function(){window.location.replace('/login?error=network')})` +
          `})();` +
          `</script><p>Signing you in…</p></body></html>`,
        200,
        { 'Content-Type': 'text/html; charset=utf-8' },
      );
    }

    // Programmatic (fetch / JSON) — existing behavior for client-side exchangeGoogleCode
    try {
      const origin = new URL(c.req.url).origin;
      const result = await authService.signInWithGoogle(code, origin);

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

  // ── Self-service Profile (SPRINT-041B — first-login profile setup) ────
  // Both routes are JWT-authenticated and derive the userId from the verified
  // token (payload.sub) — a caller can never target another user, so there is
  // no IDOR surface. These compose the EXISTING AuthService + repository; the
  // separate /users/:id/profile REST surface stays unexposed (it has no auth
  // middleware and is not mounted by the web app).
  router.get('/me', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json(
          { success: false, error: { code: 'NO_TOKEN', message: 'No access token provided' } },
          401,
        );
      }
      const payload = await authService.verifySession(authHeader.slice(7));
      if (!payload) {
        return c.json(
          {
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
          },
          401,
        );
      }
      const profile = await authService.getProfile(payload.sub);
      return c.json({ success: true, data: profile }, 200);
    } catch (error) {
      return mapErrorToResponse(error, c);
    }
  });

  router.patch('/me/profile', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json(
          { success: false, error: { code: 'NO_TOKEN', message: 'No access token provided' } },
          401,
        );
      }
      const payload = await authService.verifySession(authHeader.slice(7));
      if (!payload) {
        return c.json(
          {
            success: false,
            error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
          },
          401,
        );
      }

      const body: Record<string, unknown> = await c.req.json();
      const parsed = updateProfileSchema.safeParse(body);
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

      const profile = await authService.updateProfile(payload.sub, parsed.data);
      return c.json({ success: true, data: profile }, 200);
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
