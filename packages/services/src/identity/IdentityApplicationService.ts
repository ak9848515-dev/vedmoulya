// ──────────────────────────────────────────────────────────────────
// VedMoulya — Identity Application Service
// Orchestrates identity use cases with domain and infrastructure
// ──────────────────────────────────────────────────────────────────

import type { IdentityRepository, IdentitySettingsProps } from '@vedmoulya/domain';
import {
  UserFactory,
  Email,
  IdentityDomainService,
  createUserId,
  Password,
} from '@vedmoulya/domain';
import { UserMapper } from './UserMapper.js';
import type { UserDTO, RegisterUserDTO, UpdateProfileDTO, UserListDTO } from './UserDTO.js';
import type { PaginationParams } from '@vedmoulya/core';
import { NotFoundError, ConflictError } from '@vedmoulya/core';
import { BaseService } from '@vedmoulya/core';

export class IdentityApplicationService extends BaseService {
  private readonly repository: IdentityRepository;
  private readonly factory: UserFactory;
  private readonly domainService: IdentityDomainService;

  constructor(repository: IdentityRepository) {
    super('identity');
    this.repository = repository;
    this.factory = new UserFactory(repository);
    this.domainService = new IdentityDomainService(repository);
  }

  /** Register a new user */
  async registerUser(params: {
    email: string;
    displayName: string;
    givenName?: string;
    familyName?: string;
    passwordHash: string;
  }): Promise<RegisterUserDTO> {
    this.logger.info('Registering user', { email: params.email });

    const duplicateCheck = await this.domainService.checkForDuplicates(Email.create(params.email));
    if (duplicateCheck.emailExists) {
      throw new ConflictError(`Email already registered: ${params.email}`);
    }

    const { user } = await this.factory.createNewUser({
      email: params.email,
      displayName: params.displayName,
      givenName: params.givenName,
      familyName: params.familyName,
      passwordHash: params.passwordHash,
    });

    await this.repository.save(user);
    this.logger.info('User registered', { userId: user.id });

    return UserMapper.toRegisterDTO(user);
  }

  /** Get a user by ID */
  async getUserById(id: string): Promise<UserDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    return UserMapper.toDTO(user);
  }

  /** Get a user by email */
  async getUserByEmail(email: string): Promise<UserDTO> {
    const userEmail = Email.create(email);
    const user = await this.repository.findByEmail(userEmail);

    if (!user) {
      throw new NotFoundError('User', email);
    }

    return UserMapper.toDTO(user);
  }

  /** Update user profile */
  async updateProfile(
    id: string,
    profileData: {
      displayName?: string;
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
    },
  ): Promise<UpdateProfileDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    const updatedProfile = user.profile.with(profileData);
    user.updateProfile(updatedProfile);
    await this.repository.update(user);

    return UserMapper.toUpdateProfileDTO(user);
  }

  /** Update user preferences */
  async updatePreferences(
    id: string,
    preferences: {
      theme?: 'light' | 'dark' | 'system';
      language?: string;
      notificationsEnabled?: boolean;
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      weeklyDigest?: boolean;
      reducedMotion?: boolean;
      reducedTransparency?: boolean;
    },
  ): Promise<UserDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    const updatedPreferences = user.preferences.with(preferences);
    user.updatePreferences(updatedPreferences);
    await this.repository.update(user);

    return UserMapper.toDTO(user);
  }

  /** List users with pagination */
  async listUsers(params: PaginationParams): Promise<UserListDTO> {
    const result = await this.repository.list(params);
    return {
      users: result.data.map((u) => UserMapper.toDTO(u)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /** Activate a pending user */
  async activateUser(id: string): Promise<UserDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    user.activate();
    await this.repository.update(user);
    return UserMapper.toDTO(user);
  }

  /** Deactivate/suspend a user */
  async deactivateUser(id: string, reason?: string): Promise<UserDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    user.deactivate(reason);
    await this.repository.update(user);
    return UserMapper.toDTO(user);
  }

  /** Archive a user (soft delete) */
  async archiveUser(id: string): Promise<void> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    user.archive();
    await this.repository.update(user);
  }

  /** Delete a user (hard delete) */
  async deleteUser(id: string): Promise<void> {
    const userId = createUserId(id);
    await this.repository.delete(userId);
  }

  /** Update user settings */
  async updateSettings(id: string, settingsData: Partial<IdentitySettingsProps>): Promise<UserDTO> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    const updatedSettings = user.settings.with(settingsData);
    user.updateSettings(updatedSettings);
    await this.repository.update(user);

    return UserMapper.toDTO(user);
  }

  /** Check if a user can authenticate */
  async checkAuthentication(id: string): Promise<{ allowed: boolean; reason?: string }> {
    const userId = createUserId(id);
    const user = await this.repository.findById(userId);

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    return this.domainService.canAuthenticate(user);
  }

  /** Validate user registration data */
  validateRegistrationData(data: {
    email: string;
    displayName: string;
    password: string;
  }): string[] {
    const errors: string[] = [];

    try {
      Email.create(data.email);
    } catch {
      errors.push('Invalid email address');
    }

    if (!data.displayName || data.displayName.trim().length < 2) {
      errors.push('Display name must be at least 2 characters');
    }

    const passwordError = Password.validate(data.password);
    if (passwordError) {
      errors.push(passwordError);
    }

    return errors;
  }
}
