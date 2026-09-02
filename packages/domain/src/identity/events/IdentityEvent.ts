// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Domain Events
// All domain events emitted by the Identity bounded context
// ──────────────────────────────────────────────────────────────────

import type { UserId } from '../value-objects/UserId.js';

export type IdentityEventType =
  | 'identity.user.created'
  | 'identity.user.activated'
  | 'identity.user.deactivated'
  | 'identity.user.archived'
  | 'identity.user.profile.updated'
  | 'identity.user.preferences.updated'
  | 'identity.user.email.changed'
  | 'identity.user.email.verified'
  | 'identity.user.google.linked'
  | 'identity.user.settings.updated'
  | 'identity.user.logged_in'
  | 'identity.user.logged_out'
  | 'identity.user.password.changed'
  | 'identity.user.password.reset_requested'
  | 'identity.user.roles.updated'
  | 'identity.user.permissions.updated'
  | 'identity.user.mfa_enabled'
  | 'identity.user.mfa_disabled'
  | 'identity.user.session.revoked'
  | 'identity.user.two_factor.challenged';

export interface IdentityEvent {
  type: IdentityEventType;
  userId: UserId;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ── Event Factory Helpers ─────────────────────────────────────────────────

export function createIdentityEvent(
  type: IdentityEventType,
  userId: UserId,
  data: Record<string, unknown> = {},
): IdentityEvent {
  return { type, userId, timestamp: new Date(), data };
}
