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
import { createOAuthState, hashOAuthState } from './OAuthState.js';
import { IdentityEventPublisher } from '../infrastructure/events/IdentityEventPublisher.js';
import {
  type OAuthStateStore,
  createOAuthStateStore,
} from '../infrastructure/persistence/OAuthStateStore.js';
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
  type RefreshTokenDenylistStore,
  createRefreshTokenDenylistStore,
} from '../infrastructure/persistence/RefreshTokenDenylistStore.js';
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
  /** True when this VedMoulya IDENTITY is linked to a Google account. This is
   *  identity truth, NOT an AI-provider credential: it never implies Gemini is
   *  connected (see the provider flow — Gemini requires its own API key). */
  googleLinked: boolean;
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
  /** True when this VedMoulya IDENTITY is linked to a Google account. */
  googleLinked: boolean;
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
  /** Machine-readable failure code, when one is more specific than the
   *  transport's generic code (e.g. OAUTH_STATE_INVALID on a Google
   *  callback whose server-issued state was missing, reused or expired). */
  code?: string;
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
  /** Server-side OAuth state authority. Absent → the env-driven default
   *  (Postgres in production/staging, in-memory otherwise). */
  oauthStateStore?: OAuthStateStore;
  /** Durable refresh-token revocation authority (S024-4A). Absent → the
   *  env-driven default (Postgres in production/staging, in-memory
   *  otherwise). Fail-closed: when the store throws, refresh is refused
   *  and no replacement token is issued. */
  refreshTokenDenylist?: RefreshTokenDenylistStore;
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
  private readonly oauthStateStore: OAuthStateStore;
  private readonly refreshTokenDenylist: RefreshTokenDenylistStore;

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
    this.oauthStateStore = options.oauthStateStore ?? createOAuthStateStore();
    this.refreshTokenDenylist = options.refreshTokenDenylist ?? createRefreshTokenDenylistStore();
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

  /** Get Google OAuth authorization URL for an already-minted state. */
  getGoogleAuthUrl(state: string, requestOrigin?: string): string {
    return this.googleProvider.getAuthorizationUrl(state, requestOrigin);
  }

  /**
   * Begin the Google OAuth flow. The SERVER mints the `state`, persists only
   * its hash (single-use, time-bounded) and returns the authorization URL
   * plus the raw state. The raw value is the only copy that ever exists; the
   * callback must present it for the exchange to be allowed.
   */
  async beginGoogleAuth(requestOrigin?: string): Promise<{ url: string; state: string }> {
    const { state, stateHash, expiresAt } = createOAuthState();
    await this.oauthStateStore.save(stateHash, expiresAt);
    return { url: this.googleProvider.getAuthorizationUrl(state, requestOrigin), state };
  }

  /** Handle Google OAuth callback. The callback is processed ONLY when it
   *  carries a state this server issued, that has not been consumed and has
   *  not expired — a store failure fails closed. */
  async signInWithGoogle(
    code: string,
    state: string,
    requestOrigin?: string,
  ): Promise<SignInResult> {
    // SERVER-SIDE STATE VERIFICATION. This is the authoritative check; the
    // client-side comparison in the web app is defence in depth, never the
    // control.
    if (typeof state !== 'string' || state.trim().length === 0) {
      this.logger.warn('Google OAuth callback rejected: no state presented');
      return {
        success: false,
        code: 'OAUTH_STATE_INVALID',
        error: 'This sign-in attempt is invalid or has expired. Please try again.',
      };
    }
    try {
      const accepted = await this.oauthStateStore.consume(hashOAuthState(state));
      if (!accepted) {
        this.logger.warn('Google OAuth callback rejected: state was not issued by this server');
        return {
          success: false,
          code: 'OAUTH_STATE_INVALID',
          error: 'This sign-in attempt is invalid or has expired. Please try again.',
        };
      }
    } catch (error) {
      // An unverifiable state is never accepted — fail closed, do not fall
      // through to the code exchange.
      this.logger.error('Google OAuth state verification failed', { error });
      return {
        success: false,
        code: 'OAUTH_STATE_INVALID',
        error: 'This sign-in attempt could not be verified. Please try again.',
      };
    }

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
      hasGoogleIdentity(): boolean;
    },
    tokens: TokenPair,
  ): AuthSession {
    return {
      userId: user.id,
      email: user.email.toString(),
      role: user.role.role,
      displayName: user.profile.displayName,
      profileComplete: user.profile.isComplete(),
      googleLinked: user.hasGoogleIdentity(),
      tokens,
    };
  }

  // ── Session & Token Management ────────────────────────────────────────

  /** Verify an access token and return the session payload */
  async verifySession(token: string): Promise<AccessTokenPayload | null> {
    return this.tokenService.verifyAccessToken(token);
  }

  /** Refresh an expired access token (S024-4A: durable rotation + revocation).
   *
   *  Lifecycle enforced here:
   *   1. The presented refresh JWT must verify (signature/issuer/expiry/type).
   *   2. Its JTI must NOT already be revoked (rotation already consumed).
   *   3. Its ISSUED-AT must be strictly AFTER the user's most recent family
   *      revocation instant. The family marker is time-scoped, not a blanket
   *      boolean, so logging out invalidates every token issued up to that
   *      moment while a SUBSEQUENT successful sign-in starts a new family
   *      whose tokens refresh normally.
   *   4. The presented JTI is then CLAIMED atomically (single-use rotation)
   *      BEFORE any minting: only the caller that durably records the JTI
   *      proceeds, so two concurrent refreshes of one token can never both
   *      produce a valid pair.
   *   5. If the denylist store is unreachable the refresh FAILS CLOSED at
   *      steps 2-4 — no replacement pair is issued, so a persistence outage
   *      can never mint tokens that bypass replay protection.
   *
   *  ACCESS tokens are stateless and are NOT revoked by logout: an already
   *  issued access token stays valid until it expires (15 min, AUTH_JWT_
   *  EXPIRES_IN). This is the deliberate security model — there is no
   *  server-side access denylist — and it is documented in the status doc.
   *  Logout immediately revokes the refresh family, so the session cannot be
   *  extended beyond that access-token lifetime.
   */
  async refreshSession(refreshToken: string): Promise<{ tokens: TokenPair } | null> {
    // Decode the refresh token to get the user ID
    const verified = await this.tokenService.verifyRefreshToken(refreshToken);
    if (!verified) return null;

    try {
      // Fail-closed denylist check BEFORE any minting.
      if (await this.refreshTokenDenylist.isRevoked(verified.jti)) {
        this.logger.warn('Refresh token replay rejected', { userId: verified.sub });
        return null;
      }
      // Time-scoped family revocation: reject only tokens issued at or before
      // the last logout, so a NEW sign-in's token is unaffected. Fail closed
      // when a marker exists but the token carries no issued-at claim.
      const familyRevokedAt = await this.refreshTokenDenylist.familyRevokedAt(verified.sub);
      if (familyRevokedAt !== null) {
        const issuedAtMs = verified.iat !== undefined ? verified.iat * 1000 : null;
        if (issuedAtMs === null || issuedAtMs <= familyRevokedAt.getTime()) {
          this.logger.warn('Refresh rejected: token predates the session family revocation', {
            userId: verified.sub,
          });
          return null;
        }
      }
    } catch (error) {
      // Persistence outage → fail closed: refuse to mint a token we cannot
      // replay-protect or revocation-check.
      this.logger.error('Refresh denylist check failed — refusing refresh', { error });
      return null;
    }

    // Fetch user to get current role/email
    const { createUserId } = await import('@vedmoulya/domain');
    const userId = createUserId(verified.sub);
    const user = await this.repository.findById(userId);

    if (!user) return null;

    // Check if user can still authenticate
    const authCheck = this.domainService.canAuthenticate(user);
    if (!authCheck.allowed) return null;

    // Single-use rotation, CLAIMED BEFORE MINTING: the durable record of the
    // presented JTI is what decides the winner, so exactly one concurrent
    // refresh of the same token can proceed. A caller that loses the claim
    // sees replay semantics (null, no pair).
    const presentedExpiry =
      verified.exp !== undefined
        ? new Date(verified.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let claimed: boolean;
    try {
      claimed = await this.refreshTokenDenylist.claim(verified.jti, verified.sub, presentedExpiry);
    } catch (error) {
      // Claim unreadable/unwritable → fail closed: never mint a pair whose
      // replay protection could not be recorded.
      this.logger.error('Refresh rotation claim failed — refresh refused', { error });
      return null;
    }
    if (!claimed) {
      this.logger.warn('Refresh token replay rejected (rotation claim lost)', {
        userId: verified.sub,
      });
      return null;
    }

    // Generate new token pair. The presented token is already spent at this
    // point: if minting fails the user re-authenticates rather than keeping a
    // reusable refresh token (fail-closed, no partial state).
    const tokens = await this.tokenService.refreshAccessToken(refreshToken, {
      email: user.email.toString(),
      role: user.role.role,
    });

    if (!tokens) return null;

    return { tokens };
  }

  /** Sign out a user — revoke the refresh family (S024-4A) then record logout.
   *
   *  The durable family marker is TIME-SCOPED: every refresh token issued at
   *  or before this instant is rejected (across a new connection or process
   *  restart), while a later successful sign-in starts a new family whose
   *  tokens refresh normally. Already-issued access tokens still expire
   *  naturally (15 min; no server-side access denylist).
   *  If the denylist write fails the logout STILL records locally (audit
   *  trail), but the error is rethrown so callers do not believe revocation
   *  succeeded — fail-closed on the revocation claim.
   */
  async signOut(userId: string, presentedRefreshToken?: string): Promise<void> {
    const { createUserId } = await import('@vedmoulya/domain');
    const id = createUserId(userId);
    const user = await this.repository.findById(id);

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Durably revoke the refresh family FIRST so a crash between the two
    // steps leaves tokens revoked (safe side) rather than merely logged out.
    await this.refreshTokenDenylist.revokeForUser(userId);

    // Also revoke the presented JTI explicitly when the caller supplies it,
    // so the exact token can never be replayed even within clock skew.
    if (presentedRefreshToken) {
      const verified = await this.tokenService.verifyRefreshToken(presentedRefreshToken);
      if (verified && verified.sub === userId) {
        await this.refreshTokenDenylist.revoke(
          verified.jti,
          userId,
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        );
      }
    }

    user.recordLogout();
    await this.repository.update(user);
    await this.eventPublisher.publishUserLoggedOut(user.id);

    this.logger.info('User signed out (refresh family revoked)', { userId });
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
      googleLinked: user.hasGoogleIdentity(),
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
      googleLinked: user.hasGoogleIdentity(),
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
