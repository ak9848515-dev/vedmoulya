// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Policies
// Covers getPolicy / getAllPolicies and every registered policy's evaluate.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { getPolicy, getAllPolicies } from '../src/authorization/Policies.js';
import type { PolicyContext } from '../src/authorization/Policies.js';

function ctx(overrides: Partial<PolicyContext>): PolicyContext {
  return {
    userId: 'u1',
    role: 'user',
    action: 'read',
    subject: 'User',
    ...overrides,
  };
}

describe('policy registry', () => {
  it('returns a policy for a known subject', () => {
    expect(getPolicy('User')).toBeDefined();
    expect(getPolicy('Content')).toBeDefined();
    expect(getPolicy('Analytics')).toBeDefined();
    expect(getPolicy('Billing')).toBeDefined();
    expect(getPolicy('Team')).toBeDefined();
  });

  it('returns undefined for an unknown subject', () => {
    expect(getPolicy('Session')).toBeUndefined();
  });

  it('lists all registered policies', () => {
    const policies = getAllPolicies();
    expect(policies.length).toBeGreaterThanOrEqual(5);
    expect(policies.map((p) => p.name)).toContain('UserPolicy');
    expect(policies.map((p) => p.name)).toContain('ContentPolicy');
  });
});

describe('UserPolicy', () => {
  it('allows reading your own profile', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(ctx({ action: 'read', resource: { ownerId: 'u1' } }));
    expect(result.allowed).toBe(true);
  });

  it('allows updating your own profile', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(ctx({ action: 'update', resource: { ownerId: 'u1' } }));
    expect(result.allowed).toBe(true);
  });

  it('denies deleting your own account', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(ctx({ action: 'delete', resource: { ownerId: 'u1' } }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot delete your own account');
  });

  it('allows moderators to read other users', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(
      ctx({ role: 'moderator', action: 'read', resource: { ownerId: 'other' } }),
    );
    expect(result.allowed).toBe(true);
  });

  it('allows admins to update other users', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(
      ctx({ role: 'admin', action: 'update', resource: { ownerId: 'other' } }),
    );
    expect(result.allowed).toBe(true);
  });

  it('denies non-admins managing users', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(
      ctx({ role: 'user', action: 'manage', resource: { ownerId: 'other' } }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only administrators can manage users');
  });

  it('denies generic access by default', () => {
    const policy = getPolicy('User')!;
    const result = policy.evaluate(
      ctx({ role: 'guest', action: 'read', resource: { ownerId: 'other' } }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Access denied by UserPolicy');
  });
});

describe('ContentPolicy', () => {
  it('allows anyone to read content', () => {
    const policy = getPolicy('Content')!;
    expect(policy.evaluate(ctx({ role: 'guest', action: 'read' })).allowed).toBe(true);
  });

  it('allows a user to manage their own content', () => {
    const policy = getPolicy('Content')!;
    const result = policy.evaluate(ctx({ action: 'update', resource: { ownerId: 'u1' } }));
    expect(result.allowed).toBe(true);
  });

  it('allows premium+ to manage any content', () => {
    const policy = getPolicy('Content')!;
    expect(
      policy.evaluate(ctx({ role: 'premium', action: 'delete', resource: { ownerId: 'other' } }))
        .allowed,
    ).toBe(true);
    expect(
      policy.evaluate(ctx({ role: 'moderator', action: 'delete', resource: { ownerId: 'other' } }))
        .allowed,
    ).toBe(true);
  });

  it('denies a user managing someone else content', () => {
    const policy = getPolicy('Content')!;
    const result = policy.evaluate(ctx({ action: 'delete', resource: { ownerId: 'other' } }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Access denied by ContentPolicy');
  });
});

describe('AnalyticsPolicy', () => {
  it('allows premium, moderator and admin to read analytics', () => {
    const policy = getPolicy('Analytics')!;
    expect(policy.evaluate(ctx({ role: 'premium', action: 'read' })).allowed).toBe(true);
    expect(policy.evaluate(ctx({ role: 'moderator', action: 'read' })).allowed).toBe(true);
    expect(policy.evaluate(ctx({ role: 'admin', action: 'read' })).allowed).toBe(true);
  });

  it('denies a standard user reading analytics', () => {
    const policy = getPolicy('Analytics')!;
    const result = policy.evaluate(ctx({ role: 'user', action: 'read' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Analytics requires premium subscription');
  });

  it('denies non-read actions', () => {
    const policy = getPolicy('Analytics')!;
    expect(policy.evaluate(ctx({ role: 'admin', action: 'manage' })).allowed).toBe(false);
  });
});

describe('BillingPolicy', () => {
  it('allows admins always', () => {
    const policy = getPolicy('Billing')!;
    expect(policy.evaluate(ctx({ role: 'admin', action: 'manage' })).allowed).toBe(true);
  });

  it('allows a user to read their own billing', () => {
    const policy = getPolicy('Billing')!;
    const result = policy.evaluate(ctx({ action: 'read', resource: { ownerId: 'u1' } }));
    expect(result.allowed).toBe(true);
  });

  it('denies a user reading another billing', () => {
    const policy = getPolicy('Billing')!;
    const result = policy.evaluate(ctx({ action: 'read', resource: { ownerId: 'other' } }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Billing access restricted');
  });
});

describe('TeamPolicy', () => {
  it('allows moderators and admins', () => {
    const policy = getPolicy('Team')!;
    expect(policy.evaluate(ctx({ role: 'moderator', action: 'manage' })).allowed).toBe(true);
    expect(policy.evaluate(ctx({ role: 'admin', action: 'manage' })).allowed).toBe(true);
  });

  it('denies standard users', () => {
    const policy = getPolicy('Team')!;
    const result = policy.evaluate(ctx({ role: 'user', action: 'manage' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Only moderators and admins can manage teams');
  });
});
