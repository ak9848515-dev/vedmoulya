// ──────────────────────────────────────────────────────────────────
// VedMoulya — Authentication: Token Service
// JWT access + refresh token management using jose
// ──────────────────────────────────────────────────────────────────

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { config, logger, generateId } from '@vedmoulya/core';

export interface AccessTokenPayload {
  sub: string; // User ID
  email: string; // User email
  role: string; // User role
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // Token ID (for revocation)
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Access token expiry timestamp
}

export interface VerifiedToken {
  payload: JWTPayload;
  protectedHeader: { alg: string; typ: string };
}

export class TokenService {
  private readonly jwtSecret: Uint8Array;
  private readonly accessExpiry: string;
  private readonly refreshExpiry: string;

  constructor() {
    this.jwtSecret = new TextEncoder().encode(config.auth.jwtSecret);
    this.accessExpiry = config.auth.jwtExpiresIn; // e.g. '15m'
    this.refreshExpiry = config.auth.refreshExpiresIn; // e.g. '7d'
  }

  /** Generate an access + refresh token pair */
  async generateTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({
      sub: userId,
      email,
      role,
      type: 'access',
      iat: now,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(this.accessExpiry)
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(this.jwtSecret);

    const refreshToken = await new SignJWT({
      sub: userId,
      jti: generateId('rt'),
      type: 'refresh',
      iat: now,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(this.refreshExpiry)
      .setIssuer('vedmoulya')
      .setAudience('vedmoulya-api')
      .sign(this.jwtSecret);

    // Compute access token expiry as ISO timestamp
    const expiresAt = Date.now() + this.parseExpiryToMs(this.accessExpiry);

    logger.debug('Token pair generated', { userId });

    return { accessToken, refreshToken, expiresAt };
  }

  /** Verify and decode an access token */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        issuer: 'vedmoulya',
        audience: 'vedmoulya-api',
      });

      if (payload.type !== 'access') return null;
      if (!payload.sub || !payload.email) return null;

      return {
        sub: payload.sub,
        email: payload.email as string,
        role: (payload.role as string | undefined) ?? 'user',
        type: 'access',
      };
    } catch (error) {
      logger.warn('Access token verification failed', { error });
      return null;
    }
  }

  /** Verify and decode a refresh token */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        issuer: 'vedmoulya',
        audience: 'vedmoulya-api',
      });

      if (payload.type !== 'refresh') return null;
      if (!payload.sub || !payload.jti) return null;

      return {
        sub: payload.sub,
        jti: payload.jti,
        type: 'refresh',
      };
    } catch (error) {
      logger.warn('Refresh token verification failed', { error });
      return null;
    }
  }

  /** Refresh a token pair using a valid refresh token */
  async refreshAccessToken(
    refreshToken: string,
    userInfo: { email: string; role: string },
  ): Promise<TokenPair | null> {
    const verified = await this.verifyRefreshToken(refreshToken);
    if (!verified) return null;

    // Generate new token pair
    return this.generateTokenPair(verified.sub, userInfo.email, userInfo.role);
  }

  /** Parse a human-readable expiry string (e.g., '15m', '7d', '1h') to milliseconds */
  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15 minutes

    const value = parseInt(match[1] as string, 10);
    const unit = match[2] as string;

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
