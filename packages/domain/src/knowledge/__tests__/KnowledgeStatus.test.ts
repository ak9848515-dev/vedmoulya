import { describe, it, expect } from 'vitest';
import { KnowledgeStatus } from '../value-objects/KnowledgeStatus.js';

describe('KnowledgeStatus', () => {
  describe('factory methods', () => {
    it('creates draft status', () => {
      const status = KnowledgeStatus.draft();
      expect(status.state).toBe('draft');
      expect(status.isDraft).toBe(true);
      expect(status.isActive).toBe(false);
    });

    it('creates active status', () => {
      const status = KnowledgeStatus.active();
      expect(status.state).toBe('active');
      expect(status.isActive).toBe(true);
    });

    it('creates paused status with optional reason', () => {
      const status = KnowledgeStatus.paused('Under review');
      expect(status.state).toBe('paused');
      expect(status.isPaused).toBe(true);
      expect(status.reason).toBe('Under review');
    });

    it('creates paused status without reason', () => {
      const status = KnowledgeStatus.paused();
      expect(status.state).toBe('paused');
      expect(status.reason).toBeUndefined();
    });

    it('creates completed status', () => {
      const status = KnowledgeStatus.completed();
      expect(status.state).toBe('completed');
      expect(status.isCompleted).toBe(true);
    });

    it('creates archived status with reason', () => {
      const status = KnowledgeStatus.archived('No longer relevant');
      expect(status.state).toBe('archived');
      expect(status.isArchived).toBe(true);
      expect(status.reason).toBe('No longer relevant');
    });

    it('creates invalidated status', () => {
      const status = KnowledgeStatus.invalidated('Data conflict');
      expect(status.state).toBe('invalidated');
      expect(status.isInvalidated).toBe(true);
    });
  });

  describe('fromState parsing', () => {
    it('parses valid state strings', () => {
      expect(KnowledgeStatus.fromState('draft').state).toBe('draft');
      expect(KnowledgeStatus.fromState('active').state).toBe('active');
      expect(KnowledgeStatus.fromState('completed').state).toBe('completed');
    });

    it('throws for invalid state strings', () => {
      expect(() => KnowledgeStatus.fromState('nonexistent')).toThrow('Invalid knowledge state');
      expect(() => KnowledgeStatus.fromState('')).toThrow('Invalid knowledge state');
    });

    it('parses with reason', () => {
      const status = KnowledgeStatus.fromState('archived', 'Old data');
      expect(status.state).toBe('archived');
      expect(status.reason).toBe('Old data');
    });
  });

  describe('state transitions', () => {
    it('draft can transition to active and archived', () => {
      const draft = KnowledgeStatus.draft();
      expect(draft.canTransitionTo('active')).toBe(true);
      expect(draft.canTransitionTo('archived')).toBe(true);
      expect(draft.canTransitionTo('completed')).toBe(false);
      expect(draft.canTransitionTo('paused')).toBe(false);
    });

    it('active can transition to paused, completed, and archived', () => {
      const active = KnowledgeStatus.active();
      expect(active.canTransitionTo('paused')).toBe(true);
      expect(active.canTransitionTo('completed')).toBe(true);
      expect(active.canTransitionTo('archived')).toBe(true);
      expect(active.canTransitionTo('draft')).toBe(false);
    });

    it('paused can transition to active and archived', () => {
      const paused = KnowledgeStatus.paused();
      expect(paused.canTransitionTo('active')).toBe(true);
      expect(paused.canTransitionTo('archived')).toBe(true);
      expect(paused.canTransitionTo('completed')).toBe(false);
    });

    it('completed can only transition to archived', () => {
      const completed = KnowledgeStatus.completed();
      expect(completed.canTransitionTo('archived')).toBe(true);
      expect(completed.canTransitionTo('active')).toBe(false);
      expect(completed.canTransitionTo('draft')).toBe(false);
    });

    it('archived cannot transition to any state', () => {
      const archived = KnowledgeStatus.archived();
      expect(archived.canTransitionTo('draft')).toBe(false);
      expect(archived.canTransitionTo('active')).toBe(false);
      expect(archived.canTransitionTo('completed')).toBe(false);
      expect(archived.canTransitionTo('archived')).toBe(false);
    });

    it('invalidated can only transition to archived', () => {
      const invalidated = KnowledgeStatus.invalidated();
      expect(invalidated.canTransitionTo('archived')).toBe(true);
      expect(invalidated.canTransitionTo('active')).toBe(false);
    });
  });

  describe('comparison', () => {
    it('equals returns true for same state', () => {
      expect(KnowledgeStatus.draft().equals(KnowledgeStatus.draft())).toBe(true);
      expect(KnowledgeStatus.active().equals(KnowledgeStatus.active())).toBe(true);
    });

    it('equals returns false for different states', () => {
      expect(KnowledgeStatus.draft().equals(KnowledgeStatus.active())).toBe(false);
    });

    it('equals ignores reason', () => {
      const a = KnowledgeStatus.archived('Reason A');
      const b = KnowledgeStatus.archived('Reason B');
      expect(a.equals(b)).toBe(true);
    });
  });

  describe('toString', () => {
    it('returns state without reason', () => {
      expect(KnowledgeStatus.draft().toString()).toBe('draft');
    });

    it('includes reason when present', () => {
      expect(KnowledgeStatus.paused('Review').toString()).toBe('paused (Review)');
    });
  });
});
