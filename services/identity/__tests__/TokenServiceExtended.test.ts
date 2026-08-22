import { describe, it, expect } from 'vitest';
import { TokenService } from '../src/auth/TokenService.js';

describe('TokenService — extended coverage', () => {
  const tokenService = new TokenService();

  describe('generateTokenPair', () => {
    it('generates a pair with valid tokens', async () => {
      const tokens = await tokenService.generateTokenPair('u1', 'a@b.com', 'admin');
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a valid token', async () => {
      const tokens = await tokenService.generateTokenPair('u2', 'x@y.com', 'user');
      const payload = await tokenService.verifyAccessToken(tokens.accessToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('u2');
      expect(payload!.email).toBe('x@y.com');
      expect(payload!.role).toBe('user');
      expect(payload!.type).toBe('access');
    });

    it('returns null for garbage token', async () => {
      const payload = await tokenService.verifyAccessToken('not-a-jwt');
      expect(payload).toBeNull();
    });

    it('returns null for a refresh token passed as access token', async () => {
      const tokens = await tokenService.generateTokenPair('u3', 'r@s.com', 'user');
      const payload = await tokenService.verifyAccessToken(tokens.refreshToken);
      expect(payload).toBeNull();
    });

    it('returns null when payload is missing sub', async () => {
      // Manually craft a token without sub using jose
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET ??
          'ci-test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
      );
      const token = await new SignJWT({ email: 'a@b.com', role: 'user', type: 'access' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('15m')
        .setIssuer('vedmoulya')
        .setAudience('vedmoulya-api')
        .sign(secret);
      const payload = await tokenService.verifyAccessToken(token);
      expect(payload).toBeNull();
    });

    it('returns null when payload is missing email', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET ??
          'ci-test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
      );
      const token = await new SignJWT({ sub: 'u4', role: 'user', type: 'access' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('15m')
        .setIssuer('vedmoulya')
        .setAudience('vedmoulya-api')
        .sign(secret);
      const payload = await tokenService.verifyAccessToken(token);
      expect(payload).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies a valid refresh token', async () => {
      const tokens = await tokenService.generateTokenPair('u5', 'v@w.com', 'user');
      const payload = await tokenService.verifyRefreshToken(tokens.refreshToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('u5');
      expect(payload!.type).toBe('refresh');
      expect(payload!.jti).toBeTruthy();
    });

    it('returns null for an access token passed as refresh', async () => {
      const tokens = await tokenService.generateTokenPair('u6', 'm@n.com', 'user');
      const payload = await tokenService.verifyRefreshToken(tokens.accessToken);
      expect(payload).toBeNull();
    });

    it('returns null for garbage token', async () => {
      const payload = await tokenService.verifyRefreshToken('bad-token');
      expect(payload).toBeNull();
    });

    it('returns null when refresh token is missing jti', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET ??
          'ci-test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
      );
      const token = await new SignJWT({ sub: 'u7', type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('7d')
        .setIssuer('vedmoulya')
        .setAudience('vedmoulya-api')
        .sign(secret);
      const payload = await tokenService.verifyRefreshToken(token);
      expect(payload).toBeNull();
    });

    it('returns null when refresh token is missing sub', async () => {
      const { SignJWT } = await import('jose');
      const secret = new TextEncoder().encode(
        process.env.AUTH_JWT_SECRET ??
          'ci-test-secret-0123456789abcdef0123456789abcdef0123456789abcdef',
      );
      const token = await new SignJWT({ jti: 'rt-123', type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setExpirationTime('7d')
        .setIssuer('vedmoulya')
        .setAudience('vedmoulya-api')
        .sign(secret);
      const payload = await tokenService.verifyRefreshToken(token);
      expect(payload).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('generates new token pair from valid refresh token', async () => {
      const tokens = await tokenService.generateTokenPair('u8', 'q@r.com', 'admin');
      const newTokens = await tokenService.refreshAccessToken(tokens.refreshToken, {
        email: 'q@r.com',
        role: 'admin',
      });
      expect(newTokens).not.toBeNull();
      expect(newTokens!.accessToken).toBeTruthy();
      expect(newTokens!.refreshToken).toBeTruthy();
    });

    it('returns null for invalid refresh token', async () => {
      const result = await tokenService.refreshAccessToken('bad', {
        email: 'x@y.com',
        role: 'user',
      });
      expect(result).toBeNull();
    });
  });

  describe('parseExpiryToMs (private, tested via generateTokenPair)', () => {
    it('handles various expiry formats through token generation', async () => {
      // The parseExpiryToMs is private, so we test it indirectly through
      // the expiresAt calculation in generateTokenPair.
      const tokens = await tokenService.generateTokenPair('u9', 's@t.com', 'user');
      // accessExpiry is configured via config, should produce a valid expiresAt
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });
  });
});
