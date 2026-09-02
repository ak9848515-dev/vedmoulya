// ──────────────────────────────────────────────────────────────────
// VedMoulya — User Factory
// Consistent factory for creating User aggregate roots
// ──────────────────────────────────────────────────────────────────

import { User } from '../entities/User.js';
import { Email } from '../value-objects/Email.js';
import { UserProfile } from '../value-objects/UserProfile.js';
import { UserPreferences } from '../value-objects/UserPreferences.js';
import { IdentitySettings } from '../value-objects/IdentitySettings.js';
import { IdentityStatus } from '../value-objects/IdentityStatus.js';
import { Password } from '../value-objects/Password.js';
import { generateUserId, type UserId } from '../value-objects/UserId.js';
import { Role } from '../value-objects/Role.js';
import type { IdentityRepository } from '../repository/IdentityRepository.js';
import type { EntityStatus } from '@vedmoulya/core';

export interface CreateUserCommand {
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  passwordHash: string;
}

export interface CreateUserResult {
  user: User;
  password: Password;
}

/** Reconstruction parameters for creating a User from persisted data */
export interface UserReconstructionParams {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  locale?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyDigest?: boolean;
  reducedMotion?: boolean;
  reducedTransparency?: boolean;
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number;
  loginNotifications?: boolean;
  profileVisibility?: 'public' | 'private' | 'connections';
  showOnlineStatus?: boolean;
  allowDataSharing?: boolean;
  preferredAuthMethod?: 'email' | 'google' | 'any';
  statusState: 'pending' | 'active' | 'suspended' | 'deleted' | 'locked';
  emailVerified: boolean;
  statusReason?: string;
  statusChangedAt?: Date;
  entityStatus: EntityStatus;
  passwordHash?: string;
  role?: string;
  /** Linked Google subject id (null/undefined when the account has no link). */
  googleId?: string | null;
  /** How this account authenticates ('email' password or 'google' OAuth). */
  authProvider?: 'email' | 'google';
  createdAt: Date;
  updatedAt: Date;
}

export class UserFactory {
  private readonly repository: IdentityRepository;

  constructor(repository: IdentityRepository) {
    this.repository = repository;
  }

  /** Create a new user from registration command */
  async createNewUser(command: CreateUserCommand): Promise<CreateUserResult> {
    const existing = await this.repository.findByEmail(Email.create(command.email));
    if (existing) {
      throw new Error('A user with this email already exists');
    }

    const id = generateUserId();
    const email = Email.create(command.email);
    const profile = new UserProfile({
      displayName: command.displayName,
      givenName: command.givenName,
      familyName: command.familyName,
    });
    const preferences = UserPreferences.defaults();
    const settings = IdentitySettings.defaults();
    const password = Password.fromHash(command.passwordHash);

    const user = new User({
      id,
      email,
      profile,
      preferences,
      status: IdentityStatus.pending(),
      settings,
      passwordHash: command.passwordHash,
      role: undefined, // default role assigned by constructor
    });

    // Manually push the created event (bypassing User.create's event)
    const createdEvent = {
      type: 'identity.user.created' as const,
      userId: id,
      timestamp: new Date(),
      data: { email: email.toString() },
    };
    const eventTarget = user as unknown as { _events: Array<Record<string, unknown>> };
    eventTarget._events.push(createdEvent);

    return { user, password };
  }

  /** Reconstruct a User entity from persisted data */
  static reconstructUser(params: UserReconstructionParams): User {
    const id = params.id as UserId;
    const email = Email.from(params.email);
    const profile = new UserProfile({
      displayName: params.displayName,
      givenName: params.givenName,
      familyName: params.familyName,
      avatarUrl: params.avatarUrl,
      bio: params.bio,
      timezone: params.timezone,
      locale: params.locale,
      age: params.age,
      gender: params.gender,
      purpose: params.purpose,
      primaryGoal: params.primaryGoal,
    });
    const preferences = new UserPreferences({
      theme: params.theme ?? 'system',
      language: params.language ?? 'en',
      notificationsEnabled: params.notificationsEnabled ?? true,
      emailNotifications: params.emailNotifications ?? true,
      pushNotifications: params.pushNotifications ?? true,
      weeklyDigest: params.weeklyDigest ?? false,
      reducedMotion: params.reducedMotion ?? false,
      reducedTransparency: params.reducedTransparency ?? false,
    });

    const status = IdentityStatus.from(
      params.statusState,
      params.emailVerified,
      params.statusReason,
      params.statusChangedAt,
    );

    const settings = new IdentitySettings({
      twoFactorEnabled: params.twoFactorEnabled ?? false,
      sessionTimeoutMinutes: params.sessionTimeoutMinutes ?? 60,
      loginNotifications: params.loginNotifications ?? true,
      profileVisibility: params.profileVisibility ?? 'private',
      showOnlineStatus: params.showOnlineStatus ?? true,
      allowDataSharing: params.allowDataSharing ?? false,
      preferredAuthMethod: params.preferredAuthMethod ?? 'any',
    });

    const user = new User({
      id,
      email,
      profile,
      preferences,
      status,
      settings,
      passwordHash: params.passwordHash,
      role: params.role ? Role.from(params.role) : undefined,
      entityStatus: params.entityStatus,
      googleId: params.googleId ?? null,
      authProvider: params.authProvider,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    });

    return user;
  }
}
