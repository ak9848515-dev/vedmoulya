import { describe, expect, it } from 'vitest';
import { ProviderLifecycleStatus } from '../ProviderLifecycleStatus.js';

describe('ProviderLifecycleStatus', () => {
  it('starts new providers in draft', () => {
    expect(ProviderLifecycleStatus.draft().value).toBe('draft');
  });

  it('walks the lifecycle: draft → testing → active → maintenance → deprecated → archived', () => {
    const draft = ProviderLifecycleStatus.draft();
    expect(draft.canTransitionTo('testing')).toBe(true);
    expect(draft.canTransitionTo('active')).toBe(false);

    const testing = ProviderLifecycleStatus.fromStatus('testing');
    expect(testing.canTransitionTo('active')).toBe(true);

    const active = ProviderLifecycleStatus.fromStatus('active');
    expect(active.canTransitionTo('maintenance')).toBe(true);
    expect(active.canTransitionTo('deprecated')).toBe(true);

    const maintenance = ProviderLifecycleStatus.fromStatus('maintenance');
    expect(maintenance.canTransitionTo('active')).toBe(true);

    const deprecated = ProviderLifecycleStatus.fromStatus('deprecated');
    expect(deprecated.canTransitionTo('archived')).toBe(true);
    expect(deprecated.canTransitionTo('active')).toBe(true);

    const archived = ProviderLifecycleStatus.fromStatus('archived');
    expect(archived.allowedTransitions).toHaveLength(0);
  });

  it('archived is terminal and deprecated can revive to active', () => {
    const archived = ProviderLifecycleStatus.fromStatus('archived');
    expect(archived.isArchived()).toBe(true);
    expect(archived.canTransitionTo('active')).toBe(false);
    expect(archived.canTransitionTo('draft')).toBe(false);
  });

  it('active and maintenance count as operational', () => {
    expect(ProviderLifecycleStatus.fromStatus('active').isActive()).toBe(true);
    expect(ProviderLifecycleStatus.fromStatus('maintenance').isActive()).toBe(true);
    expect(ProviderLifecycleStatus.fromStatus('draft').isActive()).toBe(false);
    expect(ProviderLifecycleStatus.fromStatus('archived').isActive()).toBe(false);
  });

  it('sorts by progression order', () => {
    expect(ProviderLifecycleStatus.draft().progression).toBeLessThan(
      ProviderLifecycleStatus.fromStatus('testing').progression,
    );
    expect(ProviderLifecycleStatus.fromStatus('archived').progression).toBe(5);
  });

  it('compares equality and stringifies', () => {
    const a = ProviderLifecycleStatus.fromStatus('active');
    const b = ProviderLifecycleStatus.fromStatus('active');
    const c = ProviderLifecycleStatus.fromStatus('testing');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.toString()).toBe('active');
  });
});
