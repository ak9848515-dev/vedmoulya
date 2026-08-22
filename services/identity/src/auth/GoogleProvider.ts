// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication: Google OAuth2 Provider
// Handles Google sign-in, token exchange, and profile fetching
// ──────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';

export interface GoogleUserProfile {
  id: string;
  email: string;
  verifiedEmail: boolean;
  name: string;
  givenName: string;
  familyName: string;
  picture: string;
  locale: string;
}

export interface GoogleAuthResult {
  success: boolean;
  profile?: GoogleUserProfile;
  error?: string;
}

export class GoogleProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI ?? '';
  }

  /** Get the Google OAuth2 authorization URL.
   *  @param requestOrigin  When GOOGLE_REDIRECT_URI is not set, the origin
   *  (scheme + host) from the incoming request is used to build the callback
   *  URL dynamically — so production and development both get the correct
   *  redirect URI without requiring an explicit env var. */
  getAuthorizationUrl(state: string, requestOrigin?: string): string {
    const redirectUri =
      this.redirectUri ||
      (requestOrigin
        ? `${requestOrigin}/api/v1/identity/auth/google/callback`
        : 'http://localhost:3000/api/v1/identity/auth/google/callback');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchange an authorization code for tokens and fetch user profile.
   *  @param requestOrigin  Used to derive the redirect URI when GOOGLE_REDIRECT_URI is unset. */
  async handleCallback(code: string, requestOrigin?: string): Promise<GoogleAuthResult> {
    try {
      const redirectUri =
        this.redirectUri ||
        (requestOrigin
          ? `${requestOrigin}/api/v1/identity/auth/google/callback`
          : 'http://localhost:3000/api/v1/identity/auth/google/callback');
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        logger.error('Google token exchange failed', {
          status: tokenResponse.status,
          error: errorBody,
        });
        return { success: false, error: 'Failed to exchange authorization code' };
      }

      const tokens: Record<string, unknown> = (await tokenResponse.json()) as Record<
        string,
        unknown
      >;
      const accessToken = tokens.access_token as string;

      if (!accessToken) {
        return { success: false, error: 'No access token received' };
      }

      // Fetch user profile with the access token
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        return { success: false, error: 'Failed to fetch user profile' };
      }

      const profile: Record<string, unknown> = (await profileResponse.json()) as Record<
        string,
        unknown
      >;

      logger.info('Google auth successful', { email: profile.email as string });

      return {
        success: true,
        profile: {
          id: profile.id as string,
          email: profile.email as string,
          verifiedEmail: profile.verified_email as boolean,
          name: profile.name as string,
          givenName: profile.given_name as string,
          familyName: profile.family_name as string,
          picture: profile.picture as string,
          locale: profile.locale as string,
        },
      };
    } catch (error) {
      logger.error('Google auth error', { error });
      return { success: false, error: 'Google authentication failed' };
    }
  }

  /** Refresh an expired Google access token */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) return null;

      const data: Record<string, unknown> = (await response.json()) as Record<string, unknown>;
      return {
        accessToken: data.access_token as string,
        expiresIn: data.expires_in as number,
      };
    } catch {
      return null;
    }
  }
}
