// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authorization: Policy Definitions
// Resource-specific authorization policies with custom rules
// ──────────────────────────────────────────────────────────────────

import type { UserRole } from '@vedmoulya/domain';
import type { Action, Subject } from './Abilities.js';

export interface PolicyContext {
  userId: string;
  role: UserRole;
  action: Action;
  resource?: Record<string, unknown>;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export interface Policy {
  name: string;
  description: string;
  evaluate: (context: PolicyContext) => PolicyResult;
}

// ── Policy Registry ────────────────────────────────────────────────────────

const policies = new Map<Subject, Policy>();

// ── User Policy ────────────────────────────────────────────────────────────

policies.set('User', {
  name: 'UserPolicy',
  description: 'Controls access to user resources',
  evaluate: (ctx) => {
    // Users can always read their own profile
    if (ctx.action === 'read' && ctx.resource?.ownerId === ctx.userId) {
      return { allowed: true };
    }

    // Users can update their own profile
    if (ctx.action === 'update' && ctx.resource?.ownerId === ctx.userId) {
      return { allowed: true };
    }

    // Users cannot delete themselves
    if (ctx.action === 'delete' && ctx.resource?.ownerId === ctx.userId) {
      return {
        allowed: false,
        reason: 'Cannot delete your own account via this endpoint. Use account deletion flow.',
      };
    }

    // Only admins and moderators can manage other users
    if (ctx.role === 'admin' || ctx.role === 'moderator') {
      if (['read', 'update'].includes(ctx.action)) {
        return { allowed: true };
      }
    }

    if (ctx.action === 'manage' && ctx.role !== 'admin') {
      return { allowed: false, reason: 'Only administrators can manage users' };
    }

    return { allowed: false, reason: 'Access denied by UserPolicy' };
  },
});

// ── Content Policy ─────────────────────────────────────────────────────────

policies.set('Content', {
  name: 'ContentPolicy',
  description: 'Controls access to content resources',
  evaluate: (ctx) => {
    // Anyone can read public content
    if (ctx.action === 'read') {
      return { allowed: true };
    }

    // Users can manage their own content
    if (['create', 'update', 'delete'].includes(ctx.action)) {
      if (ctx.resource?.ownerId === ctx.userId) {
        return { allowed: true };
      }
      // Premium and above can manage any content
      if (['premium', 'moderator', 'admin'].includes(ctx.role)) {
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'Access denied by ContentPolicy' };
  },
});

// ── Analytics Policy ───────────────────────────────────────────────────────

policies.set('Analytics', {
  name: 'AnalyticsPolicy',
  description: 'Controls access to analytics data',
  evaluate: (ctx) => {
    if (ctx.action === 'read') {
      if (['premium', 'moderator', 'admin'].includes(ctx.role)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'Analytics requires premium subscription' };
    }
    return { allowed: false, reason: 'Access denied by AnalyticsPolicy' };
  },
});

// ── Billing Policy ─────────────────────────────────────────────────────────

policies.set('Billing', {
  name: 'BillingPolicy',
  description: 'Controls access to billing data',
  evaluate: (ctx) => {
    if (ctx.role === 'admin') {
      return { allowed: true };
    }
    // Users can read their own billing
    if (ctx.action === 'read' && ctx.resource?.ownerId === ctx.userId) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Billing access restricted' };
  },
});

// ── Team Policy ────────────────────────────────────────────────────────────

policies.set('Team', {
  name: 'TeamPolicy',
  description: 'Controls access to team management',
  evaluate: (ctx) => {
    if (['moderator', 'admin'].includes(ctx.role)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only moderators and admins can manage teams' };
  },
});

// ── Get Policy ─────────────────────────────────────────────────────────────

/** Get the policy for a given subject */
export function getPolicy(subject: Subject): Policy | undefined {
  return policies.get(subject);
}

/** Get all registered policies */
export function getAllPolicies(): Policy[] {
  return Array.from(policies.values());
}
