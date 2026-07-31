// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Audit Events
// Structured audit logging with correlation IDs for all identity operations
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export type AuditAction =
  | 'user.registered'
  | 'user.logged_in'
  | 'user.logged_out'
  | 'user.activated'
  | 'user.deactivated'
  | 'user.archived'
  | 'user.profile_updated'
  | 'user.preferences_updated'
  | 'user.settings_updated'
  | 'user.role_changed'
  | 'user.email_changed'
  | 'user.email_verified'
  | 'user.password_changed'
  | 'user.password_reset_requested'
  | 'user.deleted'
  | 'user.session_refreshed'
  | 'user.mfa_enabled'
  | 'user.mfa_disabled'
  | 'auth.token_refreshed'
  | 'auth.token_revoked'
  | 'auth.authorization_check'
  | 'auth.authorization_denied';

export interface AuditEntry {
  /** Unique event identifier */
  id: string;
  /** Correlation ID for tracing across services */
  correlationId: string;
  /** What action was performed */
  action: AuditAction;
  /** Who performed the action */
  actorId: string;
  /** Who the action was performed on */
  targetId?: string;
  /** When it happened */
  timestamp: Date;
  /** Additional context */
  details?: Record<string, unknown>;
  /** Source IP if applicable */
  ipAddress?: string;
  /** User agent if applicable */
  userAgent?: string;
  /** Whether the action succeeded */
  success: boolean;
}

export class IdentityAuditor {
  private readonly serviceName = 'identity';

  /** Record an audit event with structured logging */
  record(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
    const auditEntry: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    logger.info('Audit event', {
      audit: true,
      service: this.serviceName,
      ...auditEntry,
    });
  }

  /** Convenience: record a user registration */
  recordRegistration(
    actorId: string,
    email: string,
    correlationId: string,
    success: boolean,
  ): void {
    this.record({
      action: 'user.registered',
      actorId,
      targetId: actorId,
      correlationId,
      details: { email },
      success,
    });
  }

  /** Convenience: record a login attempt */
  recordLogin(actorId: string, method: string, correlationId: string, success: boolean): void {
    this.record({
      action: success ? 'user.logged_in' : 'user.logged_in',
      actorId,
      correlationId,
      details: { method, result: success ? 'success' : 'failure' },
      success,
    });
  }

  /** Convenience: record a profile update */
  recordProfileUpdate(actorId: string, changedFields: string[], correlationId: string): void {
    this.record({
      action: 'user.profile_updated',
      actorId,
      targetId: actorId,
      correlationId,
      details: { changedFields },
      success: true,
    });
  }

  /** Convenience: record a role change */
  recordRoleChange(
    actorId: string,
    targetId: string,
    oldRole: string,
    newRole: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'user.role_changed',
      actorId,
      targetId,
      correlationId,
      details: { oldRole, newRole },
      success: true,
    });
  }

  /** Convenience: record an authorization denial */
  recordAuthorizationDenied(
    actorId: string,
    action: string,
    subject: string,
    correlationId: string,
  ): void {
    this.record({
      action: 'auth.authorization_denied',
      actorId,
      correlationId,
      details: { action, subject },
      success: false,
    });
  }
}
