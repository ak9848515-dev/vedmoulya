// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Authorization Service
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AuthorizationService } from '../src/authorization/AuthorizationService.js';

describe('AuthorizationService', () => {
  const authz = new AuthorizationService();

  describe('role-based authorization', () => {
    it('allows admin to manage all', () => {
      const result = authz.authorize({
        userId: 'admin-1',
        role: 'admin',
        action: 'manage',
        subject: 'all',
      });
      expect(result.allowed).toBe(true);
    });

    it('denies user from managing billing', () => {
      const result = authz.authorize({
        userId: 'user-1',
        role: 'user',
        action: 'manage',
        subject: 'Billing',
      });
      expect(result.allowed).toBe(false);
    });

    it('allows user to read own content', () => {
      const result = authz.authorize({
        userId: 'user-1',
        role: 'user',
        action: 'read',
        subject: 'Content',
      });
      expect(result.allowed).toBe(true);
    });

    it('denies guest from managing content', () => {
      const result = authz.authorize({
        userId: 'guest-1',
        role: 'guest',
        action: 'manage',
        subject: 'Content',
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe('ownership', () => {
    it('verifies matching owner IDs', () => {
      expect(authz.checkOwnership('user-1', 'user-1')).toBe(true);
    });

    it('rejects non-matching owner IDs', () => {
      expect(authz.checkOwnership('user-1', 'user-2')).toBe(false);
    });
  });

  describe('assertions', () => {
    it('throws on denied authorization', () => {
      expect(() =>
        authz.assertAuthorized({
          userId: 'user-1',
          role: 'user',
          action: 'manage',
          subject: 'Billing',
        }),
      ).toThrow();
    });

    it('passes on allowed authorization', () => {
      expect(() =>
        authz.assertAuthorized({
          userId: 'admin-1',
          role: 'admin',
          action: 'manage',
          subject: 'all',
        }),
      ).not.toThrow();
    });
  });
});
