// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authorization Service
// Provides permission checking, policy enforcement, and ownership verification
// ──────────────────────────────────────────────────────────────────

import { BaseService, AuthorizationError } from '@vedmoulya/core';
import type { UserRole } from '@vedmoulya/domain';
import { defineAbilitiesFor, type Action, type Subject } from './Abilities.js';
import { getPolicy } from './Policies.js';

export interface AuthorizeParams {
  userId: string;
  role: UserRole;
  action: Action;
  subject: Subject;
  /** Optional resource object for condition-based checks (e.g., ownership) */
  resource?: Record<string, unknown>;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export class AuthorizationService extends BaseService {
  constructor() {
    super('authorization');
  }

  /** Check if a user is authorized to perform an action on a subject */
  authorize(params: AuthorizeParams): AuthorizationResult {
    const { userId, role, action, subject, resource } = params;

    const ability = defineAbilitiesFor({ userId, role });

    // Check CASL ability
    if (resource) {
      if (ability.can(action, subject)) {
        return { allowed: true };
      }
    } else {
      if (ability.can(action, subject)) {
        return { allowed: true };
      }
    }

    // Additional policy check
    const policy = getPolicy(subject);
    if (policy) {
      const policyResult = policy.evaluate({
        userId,
        role,
        action,
        resource,
      });
      if (policyResult.allowed) {
        return { allowed: true };
      }
      return policyResult;
    }

    return {
      allowed: false,
      reason: `Access denied: ${role} cannot ${action} ${subject}`,
    };
  }

  /** Assert that a user is authorized — throws if not */
  assertAuthorized(params: AuthorizeParams): void {
    const result = this.authorize(params);

    if (!result.allowed) {
      throw new AuthorizationError(result.reason ?? 'Access denied');
    }
  }

  /** Check if a user owns a specific resource */
  checkOwnership(userId: string, resourceOwnerId: string): boolean {
    return userId === resourceOwnerId;
  }

  /** Assert ownership — throws if not owned */
  assertOwnership(userId: string, resourceOwnerId: string, resourceType: string): void {
    if (!this.checkOwnership(userId, resourceOwnerId)) {
      throw new AuthorizationError(`You do not own this ${resourceType}`);
    }
  }
}
