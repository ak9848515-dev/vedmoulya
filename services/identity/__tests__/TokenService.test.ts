// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Token Service
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { TokenService } from '../src/auth/TokenService.js';

describe('TokenService', () => {
  const tokenService = new TokenService();

  describe('token generation', () => {
    it('generates access and refresh token pair', async () => {
      const tokens = await tokenService.generateTokenPair('user-1', 'test@example.com', 'admin');

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('token verification', () => {
    it('verifies a valid access token', async () => {
      const tokens = await tokenService.generateTokenPair('user-2', 'test2@example.com', 'user');

      const payload = await tokenService.verifyAccessToken(tokens.accessToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-2');
      expect(payload!.email).toBe('test2@example.com');
      expect(payload!.role).toBe('user');
    });

    it('returns null for invalid access token', async () => {
      const payload = await tokenService.verifyAccessToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('refresh token', () => {
    it('verifies a valid refresh token', async () => {
      const tokens = await tokenService.generateTokenPair('user-3', 'test3@example.com', 'user');

      const payload = await tokenService.verifyRefreshToken(tokens.refreshToken);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-3');
      expect(payload!.type).toBe('refresh');
    });
  });
});
