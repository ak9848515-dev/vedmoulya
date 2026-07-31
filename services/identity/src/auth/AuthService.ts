// ──────────────────────────────────────────────────────────────────
// VedMoulya — Core Authentication Service
// Orchestrates sign-in, sign-out, token management, and auth lifecycle
// ──────────────────────────────────────────────────────────────────

import { BaseService, NotFoundError } from '@vedmoulya/core';
import type { IdentityRepository } from '@vedmoulya/domain';
import { Email, IdentityDomainService, UserFactory } from '@vedmoulya/domain';
import { PasswordService } from './PasswordService.js';
import { TokenService, type TokenPair, type AccessTokenPayload } from './TokenService.js';
import { GoogleProvider } from './GoogleProvider.js';
import { IdentityEventPublisher } from '../infrastructure/events/IdentityEventPublisher.js';

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
  tokens: TokenPair;
}

export interface SignInResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export interface SignUpResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

export class AuthService extends BaseService {
  private readonly repository: IdentityRepository;
  private readonly domainService: IdentityDomainService;
  private readonly passwordService: PasswordService;
  private readonly tokenService: TokenService;
  private readonly googleProvider: GoogleProvider;
  private readonly eventPublisher: IdentityEventPublisher;

  constructor(repository: IdentityRepository, eventPublisher: IdentityEventPublisher) {
    super('auth');
    this.repository = repository;
    this.domainService = new IdentityDomainService(repository);
    this.passwordService = new PasswordService();
    this.tokenService = new TokenService();
    this.googleProvider = new GoogleProvider();
    this.eventPublisher = eventPublisher;
  }

  // ── Email/Password Sign-In ────────────────────────────────────────────

  /** Authenticate a user with email and password */
  async signInWithEmail(email: string, password: string): Promise<SignInResult> {
    try {
      const userEmail = Email.create(email);
      const user = await this.repository.findByEmail(userEmail);

      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if user can authenticate
      const authCheck = this.domainService.canAuthenticate(user);
      if (!authCheck.allowed) {
        return { success: false, error: authCheck.reason ?? 'Account cannot authenticate' };
      }

      // Verify password
      const isValid = await this.passwordService.verify(password, user.passwordHash);
      if (!isValid) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokenPair(
        user.id,
        user.email.toString(),
        user.role.role,
      );

      // Record login event
      user.recordLogin();
      await this.repository.update(user);
      await this.eventPublisher.publishUserLoggedIn(user.id);

      this.logger.info('User signed in with email', { userId: user.id });

      return {
        success: true,
        session: {
          userId: user.id,
          email: user.email.toString(),
          role: user.role.role,
          tokens,
        },
      };
    } catch (error) {
      this.logger.error('Email sign-in failed', { error });
      return { success: false, error: 'Authentication failed' };
    }
  }

  // ── Google OAuth Sign-In ──────────────────────────────────────────────

  /** Get Google OAuth authorization URL */
  getGoogleAuthUrl(state: string): string {
    return this.googleProvider.getAuthorizationUrl(state);
  }

  /** Handle Google OAuth callback */
  async signInWithGoogle(code: string): Promise<SignInResult> {
    try {
      const result = await this.googleProvider.handleCallback(code);

      if (!result.success || !result.profile) {
        return { success: false, error: result.error ?? 'Google authentication failed' };
      }

      const { email, givenName, familyName, name } = result.profile;

      // Find or create user
      const userEmail = Email.create(email);
      let user = await this.repository.findByEmail(userEmail);

      if (!user) {
        // Auto-register new Google users
        const factory = new UserFactory(this.repository);
        const { user: newUser } = await factory.createNewUser({
          email,
          displayName: name,
          givenName,
          familyName,
          passwordHash: '', // Google users don't need password
        });

        newUser.verifyEmail();
        await this.repository.save(newUser);
        user = newUser;

        this.logger.info('New user registered via Google', { email });
      }

      // Check authentication status
      const authCheck = this.domainService.canAuthenticate(user);
      if (!authCheck.allowed) {
        return { success: false, error: authCheck.reason ?? 'Account cannot authenticate' };
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokenPair(
        user.id,
        user.email.toString(),
        user.role.role,
      );

      // Record login event
      user.recordLogin();
      await this.repository.update(user);
      await this.eventPublisher.publishUserLoggedIn(user.id);

      this.logger.info('User signed in with Google', { userId: user.id });

      return {
        success: true,
        session: {
          userId: user.id,
          email: user.email.toString(),
          role: user.role.role,
          tokens,
        },
      };
    } catch (error) {
      this.logger.error('Google sign-in failed', { error });
      return { success: false, error: 'Google authentication failed' };
    }
  }

  // ── Session & Token Management ────────────────────────────────────────

  /** Verify an access token and return the session payload */
  async verifySession(token: string): Promise<AccessTokenPayload | null> {
    return this.tokenService.verifyAccessToken(token);
  }

  /** Refresh an expired access token */
  async refreshSession(refreshToken: string): Promise<{ tokens: TokenPair } | null> {
    // Decode the refresh token to get the user ID
    const verified = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!verified) return null;

    // Fetch user to get current role/email
    const { createUserId } = await import('@vedmoulya/domain');
    const userId = createUserId(verified.sub);
    const user = await this.repository.findById(userId);

    if (!user) return null;

    // Check if user can still authenticate
    const authCheck = this.domainService.canAuthenticate(user);
    if (!authCheck.allowed) return null;

    // Generate new token pair
    const tokens = await this.tokenService.refreshAccessToken(refreshToken, {
      email: user.email.toString(),
      role: user.role.role,
    });

    if (!tokens) return null;

    return { tokens };
  }

  /** Sign out a user — revoke session */
  async signOut(userId: string): Promise<void> {
    const { createUserId } = await import('@vedmoulya/domain');
    const id = createUserId(userId);
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    user.recordLogout();
    await this.repository.update(user);
    await this.eventPublisher.publishUserLoggedOut(user.id);

    this.logger.info('User signed out', { userId });
  }

  /** Register a new user with email/password */
  async signUp(params: {
    email: string;
    displayName: string;
    givenName?: string;
    familyName?: string;
    password: string;
  }): Promise<SignUpResult> {
    try {
      // Check for existing user
      const userEmail = Email.create(params.email);
      const existing = await this.repository.findByEmail(userEmail);
      if (existing) {
        return { success: false, error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await this.passwordService.hash(params.password);

      // Create user via factory
      const factory = new UserFactory(this.repository);
      const { user } = await factory.createNewUser({
        email: params.email,
        displayName: params.displayName,
        givenName: params.givenName,
        familyName: params.familyName,
        passwordHash,
      });

      await this.repository.save(user);
      await this.eventPublisher.publishUserCreated(user.id, user.email.toString());

      // Generate tokens
      const tokens = await this.tokenService.generateTokenPair(
        user.id,
        user.email.toString(),
        user.role.role,
      );

      this.logger.info('User signed up', { userId: user.id });

      return {
        success: true,
        session: {
          userId: user.id,
          email: user.email.toString(),
          role: user.role.role,
          tokens,
        },
      };
    } catch (error) {
      this.logger.error('Sign-up failed', { error });
      return { success: false, error: 'Registration failed' };
    }
  }
}
