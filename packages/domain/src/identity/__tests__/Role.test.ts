// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Role Value Object
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { Role } from '../value-objects/Role.js';

describe('Role', () => {
  describe('creation', () => {
    it('creates role from valid string', () => {
      const role = Role.from('admin');
      expect(role.role).toBe('admin');
    });

    it('defaults to user for unknown roles', () => {
      const role = Role.from('unknown_role');
      expect(role.role).toBe('user');
    });

    it('creates static instances', () => {
      expect(Role.ADMIN.role).toBe('admin');
      expect(Role.USER.role).toBe('user');
      expect(Role.GUEST.role).toBe('guest');
    });
  });

  describe('hierarchy', () => {
    it('admin has highest level', () => {
      expect(Role.ADMIN.level).toBeGreaterThan(Role.USER.level);
    });

    it('guest has lowest level', () => {
      expect(Role.GUEST.level).toBe(0);
    });

    it('checks hierarchy via isAtLeast', () => {
      expect(Role.ADMIN.isAtLeast('moderator')).toBe(true);
      expect(Role.USER.isAtLeast('admin')).toBe(false);
    });
  });

  describe('permissions', () => {
    it('admin can manage everything', () => {
      expect(Role.ADMIN.can('canManageUsers')).toBe(true);
      expect(Role.ADMIN.can('canManageBilling')).toBe(true);
    });

    it('user cannot manage billing', () => {
      expect(Role.USER.can('canManageBilling')).toBe(false);
    });

    it('moderator can manage users', () => {
      expect(Role.MODERATOR.can('canManageUsers')).toBe(true);
    });

    it('guest has no permissions', () => {
      expect(Role.GUEST.can('canManageUsers')).toBe(false);
      expect(Role.GUEST.can('canManageContent')).toBe(false);
    });
  });

  describe('serialization', () => {
    it('toString returns role string', () => {
      expect(Role.ADMIN.toString()).toBe('admin');
    });

    it('toJSON returns role string', () => {
      expect(Role.PREMIUM.toJSON()).toBe('premium');
    });
  });
});
