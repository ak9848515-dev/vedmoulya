// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Domain: User Entity (Aggregate Root)
// Implements ENG-001/ENG-002 Identity Bounded Context
// User is the authoritative source of who the user is
// ──────────────────────────────────────────────────────────────────

import type { UserId } from '../value-objects/UserId.js';
import type { Email } from '../value-objects/Email.js';
import { UserProfile } from '../value-objects/UserProfile.js';
import { UserPreferences } from '../value-objects/UserPreferences.js';
import { IdentityStatus } from '../value-objects/IdentityStatus.js';
import { IdentitySettings } from '../value-objects/IdentitySettings.js';
import type { IdentityEvent } from '../events/IdentityEvent.js';
import type { EntityStatus } from '@vedmoulya/core';
import { Role, type UserRole } from '../value-objects/Role.js';

/**
 * User aggregate root — central identity entity.
 * Every other bounded context references the user by UserId.
 */
export class User {
  private readonly _id: UserId;
  private _profile: UserProfile;
  private _preferences: UserPreferences;
  private _status: IdentityStatus;
  private _settings: IdentitySettings;
  private _email: Email;
  private _role: Role;
  private _entityStatus: EntityStatus;
  private readonly _createdAt: Date;
  private _updatedAt: Date;
  private readonly _events: IdentityEvent[] = [];
  private readonly _passwordHash: string;
  private _googleId: string | null;
  private _authProvider: 'email' | 'google';

  constructor(props: {
    id: UserId;
    email: Email;
    profile: UserProfile;
    preferences: UserPreferences;
    status: IdentityStatus;
    settings: IdentitySettings;
    role?: Role;
    passwordHash?: string;
    entityStatus?: EntityStatus;
    createdAt?: Date;
    updatedAt?: Date;
    googleId?: string | null;
    authProvider?: 'email' | 'google';
  }) {
    this._id = props.id;
    this._email = props.email;
    this._profile = props.profile;
    this._preferences = props.preferences;
    this._status = props.status;
    this._settings = props.settings;
    this._role = props.role ?? Role.USER;
    this._passwordHash = props.passwordHash ?? '';
    this._entityStatus = props.entityStatus ?? 'active';
    this._createdAt = props.createdAt ?? new Date();
    this._updatedAt = props.updatedAt ?? new Date();
    this._googleId = props.googleId ?? null;
    this._authProvider = props.authProvider ?? (props.googleId ? 'google' : 'email');
  }

  // ── Getters ─────────────────────────────────────────────────────────────

  get id(): UserId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get profile(): UserProfile {
    return this._profile;
  }
  get preferences(): UserPreferences {
    return this._preferences;
  }
  get status(): IdentityStatus {
    return this._status;
  }
  get settings(): IdentitySettings {
    return this._settings;
  }
  get role(): Role {
    return this._role;
  }
  get entityStatus(): EntityStatus {
    return this._entityStatus;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  /** The linked Google subject id (null when the account has no Google link). */
  get googleId(): string | null {
    return this._googleId;
  }
  /** How this account authenticates: 'email' (password) or 'google' (OAuth). */
  get authProvider(): 'email' | 'google' {
    return this._authProvider;
  }
  /** True when a Google identity is linked to this account. */
  hasGoogleIdentity(): boolean {
    return this._googleId !== null;
  }

  /** Drain and return all pending domain events */
  pullEvents(): IdentityEvent[] {
    const events = [...this._events];
    this._events.length = 0;
    return events;
  }

  // ── Behaviour ───────────────────────────────────────────────────────────

  /** Update the user's profile information */
  updateProfile(profile: UserProfile): void {
    this._profile = profile;
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.profile.updated',
      userId: this._id,
      timestamp: new Date(),
      data: { profile },
    });
  }

  /** Update the user's preferences */
  updatePreferences(preferences: UserPreferences): void {
    this._preferences = preferences;
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.preferences.updated',
      userId: this._id,
      timestamp: new Date(),
      data: { preferences },
    });
  }

  /** Change the user's email address */
  changeEmail(newEmail: Email): void {
    const oldEmail = this._email;
    this._email = newEmail;
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.email.changed',
      userId: this._id,
      timestamp: new Date(),
      data: { oldEmail: oldEmail.toString(), newEmail: newEmail.toString() },
    });
  }

  /** Update identity settings */
  updateSettings(settings: IdentitySettings): void {
    this._settings = settings;
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.settings.updated',
      userId: this._id,
      timestamp: new Date(),
      data: { settings },
    });
  }

  /** Activate the user account */
  activate(): void {
    if (!this._status.isPending) return;
    this._status = IdentityStatus.active();
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.activated',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  /** Deactivate/suspend the user account */
  deactivate(reason?: string): void {
    if (!this._status.isActive) return;
    this._status = IdentityStatus.suspended(reason ?? 'Manual deactivation');
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.deactivated',
      userId: this._id,
      timestamp: new Date(),
      data: { reason },
    });
  }

  /** Soft-delete the user account */
  archive(): void {
    this._entityStatus = 'archived';
    this._status = IdentityStatus.deleted();
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.archived',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  /** Mark email as verified */
  verifyEmail(): void {
    this._status = this._status.withEmailVerified();
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.email.verified',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  /** Record a login event */
  recordLogin(): void {
    this._events.push({
      type: 'identity.user.logged_in',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  /**
   * Securely link a Google identity to this account (account linking).
   * The caller (AuthService) owns the ownership proof: linking happens ONLY
   * after Google has verified the profile email and the account is not
   * already linked to a DIFFERENT Google subject. Idempotent for re-linking
   * the same identity; refuses a second, different Google identity.
   */
  linkGoogleIdentity(googleId: string): void {
    if (this._googleId === googleId) return;
    if (this._googleId !== null) {
      throw new Error('Account is already linked to a different Google identity');
    }
    this._googleId = googleId;
    this._authProvider = 'google';
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.google.linked',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  /** Update the user's role */
  changeRole(newRole: UserRole): void {
    const oldRole = this._role.role;
    this._role = new Role(newRole);
    this._updatedAt = new Date();
    this._events.push({
      type: 'identity.user.roles.updated',
      userId: this._id,
      timestamp: new Date(),
      data: { oldRole, newRole },
    });
  }

  /** Record a logout event */
  recordLogout(): void {
    this._events.push({
      type: 'identity.user.logged_out',
      userId: this._id,
      timestamp: new Date(),
      data: {},
    });
  }

  // ── Factory ─────────────────────────────────────────────────────────────

  /** Create a new pending user (post-registration) */
  static create(props: {
    id: UserId;
    email: Email;
    profile: UserProfile;
    preferences?: UserPreferences;
    settings?: IdentitySettings;
  }): User {
    const user = new User({
      id: props.id,
      email: props.email,
      profile: props.profile,
      preferences: props.preferences ?? UserPreferences.defaults(),
      status: IdentityStatus.pending(),
      settings: props.settings ?? IdentitySettings.defaults(),
    });

    user._events.push({
      type: 'identity.user.created',
      userId: props.id,
      timestamp: new Date(),
      data: { email: props.email.toString() },
    });

    return user;
  }
}
