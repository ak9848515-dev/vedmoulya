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
import {
  type VerificationEmailSender,
  createVerificationEmailSender,
  resolveAppOrigin,
} from './VerificationEmailSender.js';
import {
  type VerificationTokenStore,
  createVerificationTokenStore,
} from '../infrastructure/persistence/VerificationTokenStore.js';
import {
  createVerificationToken,
  hashVerificationToken,
  buildVerificationLink,
} from './VerificationToken.js';

export interface AuthSession {
  userId: string;
  email: string;
  role: string;
  /** Display name (name is mandatory at registration). */
  displayName: string;
  /** First-login profile completion — server-derived from the stored profile
   *  (SPRINT-041B). The client treats this as authoritative; a NEW user is
   *  incomplete until they save age/gender/purpose/primaryGoal. */
  profileComplete: boolean;
  tokens: TokenPair;
}

/** Self-service profile read model returned by GET /me and PATCH /me/profile. */
export interface ProfileView {
  userId: string;
  email: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
  /** First-login profile completion — derived from the stored profile. */
  profileComplete: boolean;
}

/** Accepted self-service profile updates (PATCH /me/profile). */
export interface ProfileUpdateInput {
  displayName?: string;
  givenName?: string;
  familyName?: string;
  age?: number;
  gender?: string;
  purpose?: string;
  primaryGoal?: string;
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
  /** True when the account requires email verification before it can sign in
   *  (production/staging — where the domain rule blocks unverified logins and
   *  no session is issued). Development/test auto-verifies and never sets it. */
  verificationRequired?: boolean;
}

export interface VerifyEmailResult {
  success: boolean;
  error?: 'invalid' | 'expired' | 'already-verified';
}

export interface AuthServiceOptions {
  verificationTokenStore?: VerificationTokenStore;
  emailSender?: VerificationEmailSender;
}

export class AuthService extends BaseService {
  private readonly repository: IdentityRepository;
  private readonly domainService: IdentityDomainService;
  private readonly passwordService: PasswordService;
  private readonly tokenService: TokenService;
  private readonly googleProvider: GoogleProvider;
  private readonly eventPublisher: IdentityEventPublisher;
  private readonly verificationTokenStore: VerificationTokenStore;
  private readonly emailSender: VerificationEmailSender;

  constructor(
    repository: IdentityRepository,
    eventPublisher: IdentityEventPublisher,
    options: AuthServiceOptions = {},
  ) {
    super('auth');
    this.repository = repository;
    this.domainService = new IdentityDomainService(repository);
    this.passwordService = new PasswordService();
    this.tokenService = new TokenService();
    this.googleProvider = new GoogleProvider();
    this.eventPublisher = eventPublisher;
    this.verificationTokenStore = options.verificationTokenStore ?? createVerificationTokenStore();
    this.emailSender = options.emailSender ?? createVerificationEmailSender();
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
        session: this.buildSession(user, tokens),
      };
    } catch (error) {
      this.logger.error('Email sign-in failed', { error });
      return { success: false, error: 'Authentication failed' };
    }
  }

  // ── Google OAuth Sign-In ──────────────────────────────────────────────

  /** Get Google OAuth authorization URL */
  getGoogleAuthUrl(state: string, requestOrigin?: string): string {
    return this.googleProvider.getAuthorizationUrl(state, requestOrigin);
  }

  /** Handle Google OAuth callback */
  async signInWithGoogle(code: string, requestOrigin?: string): Promise<SignInResult> {
    try {
      const result = await this.googleProvider.handleCallback(code, requestOrigin);

      if (!result.success || !result.profile) {
        return { success: false, error: result.error ?? 'Google authentication failed' };
      }

      const { id: googleId, email, givenName, familyName, name, verifiedEmail } = result.profile;

      // SECURITY — account-takeover protection: only a Google-VERIFIED email
      // may establish or link a VedMoulya identity. Google attests ownership
      // of verified addresses; an unverified one must never link into (or
      // claim) an existing account.
      if (!verifiedEmail) {
        return {
          success: false,
          error:
            'Google did not verify this email address. Verify the email with your Google account, or sign in with your email and password.',
        };
      }

      // PART 14 — identity resolution order: a Google identity ALWAYS
      // resolves to the same account via its stored google_id (stable even
      // if the profile email changes on the Google side); otherwise the
      // verified email resolves the same identity.
      let user = await this.repository.findByGoogleId(googleId);
      if (!user) {
        user = await this.repository.findByEmail(Email.create(email));
      }

      if (!user) {
        // PATH B — Google-first signup: auto-register from the verified
        // Google profile (missing profile details are collected in
        // onboarding, never by forcing the signup form).
        const factory = new UserFactory(this.repository);
        const { user: newUser } = await factory.createNewUser({
          email,
          displayName: name,
          givenName,
          familyName,
          passwordHash: '', // Google users don't need password
        });

        newUser.verifyEmail();
        newUser.linkGoogleIdentity(googleId);
        await this.repository.save(newUser);
        user = newUser;

        this.logger.info('New user registered via Google', { email });
      } else {
        // ACCOUNT LINKING — duplicate prevention: an existing account with
        // the same verified email is the SAME identity. Enrich it with the
        // Google profile where fields are missing instead of creating a
        // second user:
        //   - PATH A (email/password signup → Google completion): the
        //     password credential is preserved; Google's verified-email proof
        //     authorizes the link.
        //   - A Google-provisioned account (no password) gains any missing
        //     profile fields.
        const profile = user.profile;
        if (
          !profile.displayName.trim() ||
          !profile.givenName?.trim() ||
          !profile.familyName?.trim()
        ) {
          user.updateProfile(
            profile.with({
              displayName: profile.displayName.trim() ? profile.displayName : name,
              givenName: profile.givenName?.trim() ? profile.givenName : givenName,
              familyName: profile.familyName?.trim() ? profile.familyName : familyName,
            }),
          );
        }
        if (!user.status.emailVerified) {
          user.verifyEmail();
          this.logger.info('Email verified via Google identity link', { userId: user.id });
        }
        // Persist the Google link (idempotent; refuses a DIFFERENT second
        // Google identity — domain-enforced takeover protection).
        user.linkGoogleIdentity(googleId);
        this.logger.info('Google identity linked to existing account', { userId: user.id });
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
        session: this.buildSession(user, tokens),
      };
    } catch (error) {
      this.logger.error('Google sign-in failed', { error });
      return { success: false, error: 'Google authentication failed' };
    }
  }

  /** Build the session DTO shared by sign-in / sign-up / Google flows. The
   *  profile-completion flag is server-derived from the stored profile — a new
   *  user is incomplete until the first-login profile is saved. */
  private buildSession(
    user: {
      id: string;
      email: { toString(): string };
      role: { role: string };
      profile: { displayName: string; isComplete(): boolean };
    },
    tokens: TokenPair,
  ): AuthSession {
    return {
      userId: user.id,
      email: user.email.toString(),
      role: user.role.role,
      displayName: user.profile.displayName,
      profileComplete: user.profile.isComplete(),
      tokens,
    };
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

  /** Read the authenticated user's own profile (server-authoritative source of
   *  first-login completion). Caller must be the JWT-authenticated session; the
   *  userId is derived from the token, never from client input. */
  async getProfile(userId: string): Promise<ProfileView> {
    const { createUserId } = await import('@vedmoulya/domain');
    const id = createUserId(userId);
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', userId);
    return {
      userId: user.id,
      email: user.email.toString(),
      displayName: user.profile.displayName,
      givenName: user.profile.givenName,
      familyName: user.profile.familyName,
      age: user.profile.age,
      gender: user.profile.gender,
      purpose: user.profile.purpose,
      primaryGoal: user.profile.primaryGoal,
      profileComplete: user.profile.isComplete(),
    };
  }

  /** Update the authenticated user's own profile through the EXISTING domain
   *  entity + repository (no second repository, no direct DB writes). The
   *  userId comes from the verified token — cross-user updates are impossible
   *  by construction. */
  async updateProfile(userId: string, data: ProfileUpdateInput): Promise<ProfileView> {
    const { createUserId } = await import('@vedmoulya/domain');
    const id = createUserId(userId);
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', userId);

    const updatedProfile = user.profile.with(data);
    user.updateProfile(updatedProfile);
    await this.repository.update(user);

    return {
      userId: user.id,
      email: user.email.toString(),
      displayName: updatedProfile.displayName,
      givenName: updatedProfile.givenName,
      familyName: updatedProfile.familyName,
      age: updatedProfile.age,
      gender: updatedProfile.gender,
      purpose: updatedProfile.purpose,
      primaryGoal: updatedProfile.primaryGoal,
      profileComplete: updatedProfile.isComplete(),
    };
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

      // Explicitly widened (string) — the web build's tsconfig types
      // NODE_ENV as a literal union without 'staging', which would make the
      // comparison below look unintentional.
      const env: string = process.env.NODE_ENV ?? 'development';
      const requiresVerification = env === 'production' || env === 'staging';
      if (!requiresVerification) {
        // Development/test only — verify at registration so a local user can
        // sign in without an email round trip (mirrors the Google sign-in
        // path's newUser.verifyEmail()). Production NEVER inherits this.
        user.verifyEmail();
      }

      await this.repository.save(user);
      await this.eventPublisher.publishUserCreated(user.id, user.email.toString());

      if (requiresVerification) {
        // Production: issue a verification token, send the email, and do NOT
        // return a session — the domain rule blocks unverified sign-ins, so a
        // session would be unusable after the first refresh. The user verifies
        // via the emailed link, then signs in.
        await this.issueAndSendVerification(user);
        this.logger.info('User signed up — email verification required', { userId: user.id });
        return {
          success: true,
          verificationRequired: true,
        };
      }

      // Generate tokens
      const tokens = await this.tokenService.generateTokenPair(
        user.id,
        user.email.toString(),
        user.role.role,
      );

      this.logger.info('User signed up', { userId: user.id });

      return {
        success: true,
        session: this.buildSession(user, tokens),
      };
    } catch (error) {
      this.logger.error('Sign-up failed', { error });
      return { success: false, error: 'Registration failed' };
    }
  }

  /**
   * Verify an email-verification token (the link the user opened).
   * Security: only the SHA-256 hash is stored/looked up; expired and
   * already-consumed tokens are rejected (one-time use + replay rejection);
   * an unknown token fails identically to an invalid one (no oracle).
   */
  async verifyEmail(token: string): Promise<VerifyEmailResult> {
    try {
      const record = await this.verificationTokenStore.findByHash(hashVerificationToken(token));
      if (!record) {
        return { success: false, error: 'invalid' };
      }
      if (record.consumedAt) {
        return { success: false, error: 'already-verified' };
      }
      if (record.expiresAt.getTime() < Date.now()) {
        return { success: false, error: 'expired' };
      }

      const { createUserId } = await import('@vedmoulya/domain');
      const user = await this.repository.findById(createUserId(record.userId));
      if (!user) {
        return { success: false, error: 'invalid' };
      }
      if (user.status.emailVerified) {
        // The user is already verified — consume the stale token and report
        // success (idempotent UX; no fabrication of a new verification).
        await this.verificationTokenStore.markConsumed(record.id);
        return { success: true };
      }

      user.verifyEmail();
      await this.repository.update(user);
      await this.verificationTokenStore.markConsumed(record.id);
      await this.eventPublisher.publishUserEmailVerified(user.id);

      this.logger.info('User email verified', { userId: user.id });
      return { success: true };
    } catch (error) {
      this.logger.error('Email verification failed', { error });
      return { success: false, error: 'invalid' };
    }
  }

  /**
   * Re-send the verification email. Always returns success (no account
   * enumeration): an unknown email, an already-verified account, or a
   * development-mode account are all indistinguishable from a successful send.
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean }> {
    try {
      const env: string = process.env.NODE_ENV ?? 'development';
      const requiresVerification = env === 'production' || env === 'staging';
      const user = await this.repository.findByEmail(Email.create(email));
      if (requiresVerification && user && !user.status.emailVerified) {
        await this.issueAndSendVerification(user);
      }
      return { success: true };
    } catch (error) {
      // Never leak delivery failure to the caller — the generic success keeps
      // the endpoint enumeration-free; the operator sees the error in logs.
      this.logger.error('Verification resend failed', { error });
      return { success: true };
    }
  }

  /** Issue a fresh verification token for a user and email the link. */
  private async issueAndSendVerification(user: {
    id: string;
    email: { toString(): string };
    profile: { displayName: string };
  }): Promise<void> {
    const { token, tokenHash, expiresAt } = createVerificationToken();
    await this.verificationTokenStore.revokeForUser(user.id);
    await this.verificationTokenStore.save(user.id, tokenHash, expiresAt);
    await this.emailSender.sendVerificationEmail({
      to: user.email.toString(),
      displayName: user.profile.displayName,
      verificationLink: buildVerificationLink(resolveAppOrigin(), token),
    });
  }
}
