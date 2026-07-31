// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: User Entity
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { User } from '../entities/User.js';
import { Email } from '../value-objects/Email.js';
import { UserProfile } from '../value-objects/UserProfile.js';
import { Role } from '../value-objects/Role.js';

describe('User', () => {
  const validEmail = Email.create('test@example.com');
  const validProfile = new UserProfile({ displayName: 'Test User' });

  describe('creation', () => {
    it('creates a user with defaults', () => {
      const user = User.create({
        id: 'user-1' as any,
        email: validEmail,
        profile: validProfile,
      });

      expect(user.id).toBe('user-1');
      expect(user.email.toString()).toBe('test@example.com');
      expect(user.role.role).toBe('user');
      expect(user.entityStatus).toBe('active');
    });

    it('emits created event', () => {
      const user = User.create({
        id: 'user-2' as any,
        email: validEmail,
        profile: validProfile,
      });

      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('identity.user.created');
    });
  });

  describe('role management', () => {
    it('changes role and emits event', () => {
      const user = User.create({
        id: 'user-3' as any,
        email: validEmail,
        profile: validProfile,
      });
      user.pullEvents(); // clear creation event

      user.changeRole('admin');
      expect(user.role.role).toBe('admin');

      const events = user.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('identity.user.roles.updated');
    });
  });

  describe('lifecycle', () => {
    it('activates pending user', () => {
      const user = User.create({
        id: 'user-4' as any,
        email: validEmail,
        profile: validProfile,
      });
      user.pullEvents();

      user.activate();
      expect(user.status.isActive).toBe(true);
    });

    it('deactivates active user', () => {
      const user = User.create({
        id: 'user-5' as any,
        email: validEmail,
        profile: validProfile,
      });
      user.pullEvents();
      user.activate();
      user.pullEvents();

      user.deactivate('Suspicious activity');
      expect(user.status.isSuspended).toBe(true);
      expect(user.status.reason).toBe('Suspicious activity');
    });

    it('archives user', () => {
      const user = User.create({
        id: 'user-6' as any,
        email: validEmail,
        profile: validProfile,
      });
      user.pullEvents();

      user.archive();
      expect(user.entityStatus).toBe('archived');
      expect(user.status.isDeleted).toBe(true);
    });
  });
});
