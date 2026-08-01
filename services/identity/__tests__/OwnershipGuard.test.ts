// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: OwnershipGuard
// Covers verify, check, filterOwned, and verifyAll.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AuthorizationError } from '@vedmoulya/core';
import { OwnershipGuard } from '../src/authorization/OwnershipGuard.js';

describe('OwnershipGuard', () => {
  const resource = { id: 'res-1', ownerId: 'user-1' };

  describe('verify', () => {
    it('does not throw when the user owns the resource', () => {
      expect(() => OwnershipGuard.verify('user-1', resource, 'Post')).not.toThrow();
    });

    it('throws AuthorizationError when the user does not own it', () => {
      expect(() => OwnershipGuard.verify('user-2', resource, 'Post')).toThrow(AuthorizationError);
      expect(() => OwnershipGuard.verify('user-2', resource, 'Post')).toThrow(
        'You do not own this Post',
      );
    });
  });

  describe('check', () => {
    it('returns true for a matching owner', () => {
      expect(OwnershipGuard.check('user-1', 'user-1')).toBe(true);
    });

    it('returns false for a non-matching owner', () => {
      expect(OwnershipGuard.check('user-1', 'user-2')).toBe(false);
    });
  });

  describe('filterOwned', () => {
    it('returns only resources owned by the user', () => {
      const resources = [
        { id: 'a', ownerId: 'user-1' },
        { id: 'b', ownerId: 'user-2' },
        { id: 'c', ownerId: 'user-1' },
      ];
      const owned = OwnershipGuard.filterOwned('user-1', resources);
      expect(owned).toHaveLength(2);
      expect(owned.map((r) => r.id)).toEqual(['a', 'c']);
    });

    it('returns an empty array when nothing is owned', () => {
      const owned = OwnershipGuard.filterOwned('user-1', [{ id: 'x', ownerId: 'other' }]);
      expect(owned).toEqual([]);
    });
  });

  describe('verifyAll', () => {
    it('does not throw when the user owns all resources', () => {
      const resources = [
        { id: 'a', ownerId: 'user-1' },
        { id: 'b', ownerId: 'user-1' },
      ];
      expect(() => OwnershipGuard.verifyAll('user-1', resources, 'Post')).not.toThrow();
    });

    it('throws with the resource id when one is not owned', () => {
      const resources = [
        { id: 'a', ownerId: 'user-1' },
        { id: 'b', ownerId: 'user-2' },
      ];
      expect(() => OwnershipGuard.verifyAll('user-1', resources, 'Post')).toThrow(
        'You do not own Post: b',
      );
    });
  });
});
