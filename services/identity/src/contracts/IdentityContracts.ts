// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Service Contracts
// Formal query, command, event, and request definitions per ENG-002
// Implements BLD-004 Service Contracts
// ──────────────────────────────────────────────────────────────────

import type { UserId } from '@vedmoulya/domain';
import type { IdentityInformation } from '@vedmoulya/information';

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Queries
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface GetUserQuery {
  type: 'GetUser';
  userId: UserId;
}

export interface GetUserByEmailQuery {
  type: 'GetUserByEmail';
  email: string;
}

export interface ListUsersQuery {
  type: 'ListUsers';
  page: number;
  limit: number;
  filters?: {
    status?: string;
    role?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  };
}

export interface GetUserSessionQuery {
  type: 'GetUserSession';
  sessionToken: string;
}

export interface CheckPermissionQuery {
  type: 'CheckPermission';
  userId: UserId;
  action: string;
  subject: string;
  resourceId?: string;
}

export type IdentityQuery =
  GetUserQuery | GetUserByEmailQuery | ListUsersQuery | GetUserSessionQuery | CheckPermissionQuery;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Commands
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface RegisterUserCommand {
  type: 'RegisterUser';
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  passwordHash: string;
}

export interface UpdateProfileCommand {
  type: 'UpdateProfile';
  userId: UserId;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
}

export interface UpdatePreferencesCommand {
  type: 'UpdatePreferences';
  userId: UserId;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface UpdateSettingsCommand {
  type: 'UpdateSettings';
  userId: UserId;
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number;
  profileVisibility?: 'public' | 'private' | 'connections';
}

export interface ActivateUserCommand {
  type: 'ActivateUser';
  userId: UserId;
}

export interface DeactivateUserCommand {
  type: 'DeactivateUser';
  userId: UserId;
  reason?: string;
}

export interface ArchiveUserCommand {
  type: 'ArchiveUser';
  userId: UserId;
}

export interface SignInCommand {
  type: 'SignIn';
  email: string;
  password: string;
}

export interface SignOutCommand {
  type: 'SignOut';
  userId: UserId;
  sessionToken?: string;
}

export interface RefreshTokenCommand {
  type: 'RefreshToken';
  refreshToken: string;
}

export interface ChangeRoleCommand {
  type: 'ChangeRole';
  userId: UserId;
  newRole: string;
  changedBy: UserId;
}

export type IdentityCommand =
  | RegisterUserCommand
  | UpdateProfileCommand
  | UpdatePreferencesCommand
  | UpdateSettingsCommand
  | ActivateUserCommand
  | DeactivateUserCommand
  | ArchiveUserCommand
  | SignInCommand
  | SignOutCommand
  | RefreshTokenCommand
  | ChangeRoleCommand;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Events
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export interface UserCreatedEvent {
  type: 'identity.user.created';
  userId: UserId;
  email: string;
  timestamp: Date;
  correlationId: string;
}

export interface UserActivatedEvent {
  type: 'identity.user.activated';
  userId: UserId;
  timestamp: Date;
  correlationId: string;
}

export interface UserDeactivatedEvent {
  type: 'identity.user.deactivated';
  userId: UserId;
  reason?: string;
  timestamp: Date;
  correlationId: string;
}

export interface UserArchivedEvent {
  type: 'identity.user.archived';
  userId: UserId;
  timestamp: Date;
  correlationId: string;
}

export interface UserLoggedInEvent {
  type: 'identity.user.logged_in';
  userId: UserId;
  timestamp: Date;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserLoggedOutEvent {
  type: 'identity.user.logged_out';
  userId: UserId;
  timestamp: Date;
  correlationId: string;
}

export interface UserProfileUpdatedEvent {
  type: 'identity.user.profile.updated';
  userId: UserId;
  changedFields: string[];
  timestamp: Date;
  correlationId: string;
}

export interface UserRoleChangedEvent {
  type: 'identity.user.roles.updated';
  userId: UserId;
  oldRole: string;
  newRole: string;
  changedBy: UserId;
  timestamp: Date;
  correlationId: string;
}

export type IdentityContractEvent =
  | UserCreatedEvent
  | UserActivatedEvent
  | UserDeactivatedEvent
  | UserArchivedEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | UserProfileUpdatedEvent
  | UserRoleChangedEvent;

// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
// Service Contract — Unified message wrapper
// ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──

export type IdentityMessage = IdentityQuery | IdentityCommand | IdentityContractEvent;

export interface IdentityContractResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  /** Correlation ID for tracing */
  correlationId: string;
  /** Information model metadata if applicable */
  information?: IdentityInformation;
}
