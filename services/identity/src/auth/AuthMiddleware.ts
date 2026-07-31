// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication Middleware
// Hono middleware for verifying access tokens and attaching session info
// ──────────────────────────────────────────────────────────────────

import type { Context, Next } from 'hono';
import type { AccessTokenPayload } from './TokenService.js';

// Extend Hono's context variable map for type-safe session access
declare module 'hono' {
  interface ContextVariableMap {
    session?: AccessTokenPayload;
  }
}

/** Middleware that requires a valid access token */
export function requireAuth(
  verifyToken: (token: string) => Promise<AccessTokenPayload | null>,
): (c: Context, next: Next) => Promise<Response | undefined> {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { success: false, error: { code: 'NO_TOKEN', message: 'Authentication required' } },
        401,
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return c.json(
        {
          success: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid or expired access token' },
        },
        401,
      );
    }

    // Attach session to context for downstream handlers
    c.set('session', payload);

    await next();
    return;
  };
}

/** Middleware that optionally attaches session if a valid token is present */
export function optionalAuth(
  verifyToken: (token: string) => Promise<AccessTokenPayload | null>,
): (c: Context, next: Next) => Promise<Response | undefined> {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const authHeader = c.req.header('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (payload) {
        c.set('session', payload);
      }
    }

    await next();
    return;
  };
}
