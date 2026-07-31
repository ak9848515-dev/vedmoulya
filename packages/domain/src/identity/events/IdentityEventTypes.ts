// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Domain Event Type Definitions
// Strongly-typed data payloads for each identity event type
// ──────────────────────────────────────────────────────────────────

import type { UserProfileProps } from '../value-objects/UserProfile.js';
import type { UserPreferencesProps } from '../value-objects/UserPreferences.js';
import type { IdentitySettingsProps } from '../value-objects/IdentitySettings.js';

export interface UserCreatedData {
  email: string;
}

export interface UserProfileUpdatedData {
  profile: UserProfileProps;
}

export interface UserPreferencesUpdatedData {
  preferences: UserPreferencesProps;
}

export interface UserEmailChangedData {
  oldEmail: string;
  newEmail: string;
}

export interface UserEmailVerifiedData {
  verifiedAt: string;
}

export interface UserSettingsUpdatedData {
  settings: IdentitySettingsProps;
}

export interface UserActivatedData {
  activatedAt: string;
}

export interface UserDeactivatedData {
  reason?: string;
}

export interface UserArchivedData {
  archivedAt: string;
}

export interface UserPasswordChangedData {
  changedAt: string;
}

export interface UserPasswordResetRequestedData {
  resetMethod: string;
  requestedAt: string;
}

export interface UserRolesUpdatedData {
  added: string[];
  removed: string[];
}

export interface UserPermissionsUpdatedData {
  added: string[];
  removed: string[];
}

export interface UserMfaEnabledData {
  method: string;
  enabledAt: string;
}

export interface UserMfaDisabledData {
  disabledAt: string;
}

export interface UserSessionRevokedData {
  sessionId: string;
  reason?: string;
}

export interface UserTwoFactorChallengedData {
  challengeType: string;
  challengedAt: string;
}

export interface UserLoggedInData {
  method: string;
  ip?: string;
  userAgent?: string;
}

export interface UserLoggedOutData {
  sessionId?: string;
}
