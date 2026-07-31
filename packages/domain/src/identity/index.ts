// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Domain Layer
// Exports: entities, value objects, events, services, repository,
//          factory, and business rules
// ──────────────────────────────────────────────────────────────────

// ── Entities ──────────────────────────────────────────────────────────────
export { User } from './entities/User.js';

// ── Value Objects ─────────────────────────────────────────────────────────
export type { UserId } from './value-objects/UserId.js';
export { createUserId, generateUserId } from './value-objects/UserId.js';
export { Email } from './value-objects/Email.js';
export { UserProfile } from './value-objects/UserProfile.js';
export type { UserProfileProps } from './value-objects/UserProfile.js';
export { UserPreferences } from './value-objects/UserPreferences.js';
export type { UserPreferencesProps } from './value-objects/UserPreferences.js';
export { IdentityStatus } from './value-objects/IdentityStatus.js';
export type { IdentityState } from './value-objects/IdentityStatus.js';
export { IdentitySettings } from './value-objects/IdentitySettings.js';
export type { IdentitySettingsProps } from './value-objects/IdentitySettings.js';
export { Password } from './value-objects/Password.js';
export type { PasswordStrength } from './value-objects/Password.js';
export { Role } from './value-objects/Role.js';
export type { UserRole, RolePermissions } from './value-objects/Role.js';

// ── Domain Events ─────────────────────────────────────────────────────────
export type { IdentityEvent, IdentityEventType } from './events/IdentityEvent.js';
export { createIdentityEvent } from './events/IdentityEvent.js';

// ── Repository ────────────────────────────────────────────────────────────
export type { IdentityRepository } from './repository/IdentityRepository.js';

// ── Domain Services ───────────────────────────────────────────────────────
export { IdentityDomainService } from './services/IdentityDomainService.js';
export type {
  DuplicateCheckResult,
  PasswordChangeResult,
} from './services/IdentityDomainService.js';

// ── Factory ───────────────────────────────────────────────────────────────
export { UserFactory } from './factory/UserFactory.js';
export type {
  CreateUserCommand,
  CreateUserResult,
  UserReconstructionParams,
} from './factory/UserFactory.js';

// ── Business Rules ────────────────────────────────────────────────────────
export {
  displayNameRule,
  passwordRule,
  canAuthenticateRule,
  emailChangeRule,
  accountDeletionRule,
  validate,
} from './rules/IdentityRules.js';
export type { RuleResult, Rule } from './rules/IdentityRules.js';
