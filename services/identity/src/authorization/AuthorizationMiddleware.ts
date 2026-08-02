// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authorization Middleware
// Hono middleware for route-level authorization with CASL abilities
// ──────────────────────────────────────────────────────────────────

import type { Context, Next } from 'hono';
import type { Action, Subject } from './Abilities.js';
import { defineAbilitiesFor, type AppAbility } from './Abilities.js';
import { AuthorizationService } from './AuthorizationService.js';
import type { UserRole } from '@vedmoulya/domain';

// Extend Hono context variable map for ability access
declare module 'hono' {
  interface ContextVariableMap {
    ability: AppAbility;
  }
}

let authorizationServiceInstance: AuthorizationService | null = null;

/**
 * Lazily construct (and cache) the AuthorizationService on first use.
 * Its BaseService constructor reads @vedmoulya/core config via the logger,
 * so module-scope construction would evaluate configuration at import time
 * (breaking `next build` page-data collection without env vars).
 */
function getAuthorizationService(): AuthorizationService {
  if (authorizationServiceInstance === null) {
    authorizationServiceInstance = new AuthorizationService();
  }
  return authorizationServiceInstance;
}

/** Middleware that checks if the authenticated user can perform an action on a subject */
export function requireAbility(
  action: Action,
  subject: Subject,
): (c: Context, next: Next) => Promise<Response | undefined> {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const session = c.get('session');

    if (!session) {
      return c.json(
        { success: false, error: { code: 'NO_SESSION', message: 'Authentication required' } },
        401,
      );
    }

    const userId = session.sub;
    const role = session.role as UserRole;

    // Build ability and attach to context
    const ability = defineAbilitiesFor({ userId, role });
    c.set('ability', ability);

    // Check authorization
    const result = getAuthorizationService().authorize({
      userId,
      role,
      action,
      subject,
    });

    if (!result.allowed) {
      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: result.reason ?? 'Access denied',
          },
        },
        403,
      );
    }

    await next();
    return;
  };
}

/** Middleware that checks user owns a resource (by comparing session userId with a parameter) */
export function requireOwnership(
  paramName: string = 'id',
): (c: Context, next: Next) => Promise<Response | undefined> {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const session = c.get('session');

    if (!session) {
      return c.json(
        { success: false, error: { code: 'NO_SESSION', message: 'Authentication required' } },
        401,
      );
    }

    const resourceOwnerId = c.req.param(paramName);

    if (!resourceOwnerId) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_PARAM', message: `Resource identifier '${paramName}' not found` },
        },
        400,
      );
    }

    // Check ownership
    const isOwner = getAuthorizationService().checkOwnership(session.sub, resourceOwnerId);
    if (!isOwner) {
      return c.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not own this resource' } },
        403,
      );
    }

    await next();
    return;
  };
}
