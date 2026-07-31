// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Auth Middleware
// Real JWT authentication for tRPC procedures (HS256 via jose)
// Matches services/identity TokenService conventions: issuer 'vedmoulya',
// audience 'vedmoulya-api', type claim 'access'
// BLD-016C — Real Authentication
// ─────────────────────────────────────────────────────────────────────────────

import { jwtVerify } from 'jose';
import { config } from '@vedmoulya/core';
import { TRPCError } from '@trpc/server';
import type { TRPCContext } from '../router.js';

// ── Session Types ───────────────────────────────────────────────────────────

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
}

const ANONYMOUS_CONTEXT: TRPCContext = { userId: 'anonymous', email: '', role: 'guest' };

// ── Token Verification ──────────────────────────────────────────────────────

/**
 * Verify a Bearer access token and return the session, or null if invalid.
 * Uses the same shared secret (config.auth.jwtSecret), issuer and audience
 * as the identity service's TokenService so tokens issued there verify here.
 */
export async function verifyAccessToken(token: string): Promise<AuthSession | null> {
  try {
    const secret = new TextEncoder().encode(config.auth.jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'vedmoulya',
      audience: 'vedmoulya-api',
    });

    if (payload.type !== 'access') return null;
    if (!payload.sub || !payload.email) return null;

    return {
      userId: payload.sub,
      email: payload.email as string,
      role: (payload.role as string | undefined) ?? 'user',
    };
  } catch {
    return null;
  }
}

// ── Context Building ────────────────────────────────────────────────────────

/**
 * Build a tRPC context from request headers. Never throws — returns an
 * anonymous context when no valid token is present, so public procedures
 * (e.g. health) keep working. Protected procedures enforce authentication
 * via `isAuthenticated` in the RouterRegistry auth middleware.
 */
export async function createAuthContext(headers: Headers): Promise<TRPCContext> {
  const authHeader = headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return ANONYMOUS_CONTEXT;

  const session = await verifyAccessToken(authHeader.slice(7));
  if (!session) return ANONYMOUS_CONTEXT;

  return session;
}

/**
 * Require a valid session, throwing UNAUTHORIZED otherwise.
 * Used inside tRPC middleware (RouterRegistry) to protect procedures.
 */
export function isAuthenticated(ctx: TRPCContext): void {
  if (!ctx.userId || ctx.userId === 'anonymous') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Provide a valid Bearer access token.',
    });
  }
}

/**
 * Strict variant: parse + verify the Authorization header and return a
 * TRPCContext, throwing UNAUTHORIZED when the token is missing or invalid.
 * Suitable for route handlers or call sites that must fail closed.
 */
export async function authenticateRequest(headers: Headers): Promise<TRPCContext> {
  const authHeader = headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Provide a valid Bearer access token.',
    });
  }

  const session = await verifyAccessToken(authHeader.slice(7));
  if (!session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired access token.',
    });
  }

  return session;
}

// ── Authorization (IDOR guard) ───────────────────────────────────────────────

/**
 * Enforce that a procedure input scoped by `userId` targets the authenticated
 * session's own userId. Prevents Insecure Direct Object Reference (IDOR)
 * attacks where a caller supplies another user's id in the procedure input.
 *
 * Throws FORBIDDEN when the input userId does not match the session. Inputs
 * without a userId field (e.g. health, global search) pass through unchanged.
 */
export function assertUserIdMatchesSession(ctx: TRPCContext, input: unknown): void {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return;

  const inputUserId = (input as { userId?: unknown }).userId;
  if (typeof inputUserId === 'string' && inputUserId !== ctx.userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not authorized to access this resource.',
    });
  }
}
