// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/identity
// Identity Service — Infrastructure, Domain, Application, Presentation
// Implements BLD-004 Identity Platform
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'identity' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export { users } from './schema/users.js';
export type { UserRow, NewUserRow } from './schema/users.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresIdentityRepository } from './infrastructure/persistence/PostgresIdentityRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Cache ─────────────────────────────────────────────────
export { UserCache } from './infrastructure/cache/UserCache.js';

// ── Infrastructure — Events ────────────────────────────────────────────────
export { IdentityEventPublisher } from './infrastructure/events/IdentityEventPublisher.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export { registerIdentityServices, identityModule } from './infrastructure/di/IdentityModule.js';

// ── Authentication ─────────────────────────────────────────────────────────
export { AuthService } from './auth/AuthService.js';
export { TokenService } from './auth/TokenService.js';
export type { AccessTokenPayload, RefreshTokenPayload, TokenPair } from './auth/TokenService.js';
export { PasswordService } from './auth/PasswordService.js';
export { GoogleProvider } from './auth/GoogleProvider.js';
export type { GoogleUserProfile, GoogleAuthResult } from './auth/GoogleProvider.js';
export { requireAuth, optionalAuth } from './auth/AuthMiddleware.js';
export { createAuthRouter, authRouteConfig } from './auth/AuthRoutes.js';

// ── Authorization ─────────────────────────────────────────────────────────
export { AuthorizationService } from './authorization/AuthorizationService.js';
export type { AuthorizeParams, AuthorizationResult } from './authorization/AuthorizationService.js';
export { defineAbilitiesFor } from './authorization/Abilities.js';
export type { Action, Subject, AppAbility, AbilityContext } from './authorization/Abilities.js';
export { requireAbility, requireOwnership } from './authorization/AuthorizationMiddleware.js';
export { OwnershipGuard } from './authorization/OwnershipGuard.js';
export type { OwnedResource } from './authorization/OwnershipGuard.js';
export { getPolicy, getAllPolicies } from './authorization/Policies.js';
export type { Policy, PolicyContext, PolicyResult } from './authorization/Policies.js';

// ── Presentation — Routes ──────────────────────────────────────────────────
export { createIdentityRouter, identityRouteConfig } from './presentation/routes/IdentityRoutes.js';
export { IdentityController } from './presentation/controllers/IdentityController.js';

// ── Presentation — tRPC ────────────────────────────────────────────────────
export { createIdentityTrpcRouter } from './presentation/trpc/IdentityRouter.js';

// ── Service Contracts ──────────────────────────────────────────────────────
export type {
  IdentityQuery,
  IdentityCommand,
  IdentityContractEvent,
  IdentityMessage,
  IdentityContractResult,
  GetUserQuery,
  GetUserByEmailQuery,
  ListUsersQuery,
  RegisterUserCommand,
  UpdateProfileCommand,
  UpdatePreferencesCommand,
  UpdateSettingsCommand,
  ActivateUserCommand,
  DeactivateUserCommand,
  ArchiveUserCommand,
  SignInCommand,
  SignOutCommand,
  RefreshTokenCommand,
  ChangeRoleCommand,
  UserCreatedEvent,
  UserActivatedEvent,
  UserDeactivatedEvent,
  UserArchivedEvent,
  UserLoggedInEvent,
  UserLoggedOutEvent,
  UserProfileUpdatedEvent,
  UserRoleChangedEvent,
} from './contracts/IdentityContracts.js';

// ── Observability — Metrics ────────────────────────────────────────────────
export { IdentityMetrics } from './observability/IdentityMetrics.js';

// ── Observability — Audit ──────────────────────────────────────────────────
export { IdentityAuditor } from './observability/IdentityAudit.js';
export type { AuditAction, AuditEntry } from './observability/IdentityAudit.js';

// ── Observability — Tracing ────────────────────────────────────────────────
export { IdentityTracer } from './observability/IdentityTracing.js';

// ── Presentation — OpenAPI ─────────────────────────────────────────────────
export { identityOpenApiSchema } from './presentation/openapi/IdentityOpenAPI.js';
