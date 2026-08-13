import { describe, expect, it } from 'vitest';
import { CapabilityStatus } from '../CapabilityStatus.js';

describe('CapabilityStatus lifecycle', () => {
  it('follows design → draft → testing → active → deprecated → archived', () => {
    const design = CapabilityStatus.design();
    expect(design.canTransitionTo('draft')).toBe(true);
    expect(design.canTransitionTo('active')).toBe(false);

    const draft = CapabilityStatus.create('draft');
    expect(draft.canTransitionTo('testing')).toBe(true);
    expect(draft.canTransitionTo('archived')).toBe(false);
  });

  it('allows draft → design and testing → draft (backward steps)', () => {
    expect(CapabilityStatus.create('draft').canTransitionTo('design')).toBe(true);
    expect(CapabilityStatus.create('testing').canTransitionTo('draft')).toBe(true);
  });

  it('allows active → deprecated and deprecated → active (revival)', () => {
    expect(CapabilityStatus.create('active').canTransitionTo('deprecated')).toBe(true);
    expect(CapabilityStatus.create('deprecated').canTransitionTo('active')).toBe(true);
    expect(CapabilityStatus.create('deprecated').canTransitionTo('archived')).toBe(true);
  });

  it('archived is terminal', () => {
    const archived = CapabilityStatus.create('archived');
    expect(archived.allowedTransitions).toHaveLength(0);
  });

  it('rejects invalid transitions', () => {
    const active = CapabilityStatus.create('active');
    expect(active.canTransitionTo('archived')).toBe(false);
    expect(active.canTransitionTo('design')).toBe(false);
  });

  it('isActive and isArchived helpers', () => {
    expect(CapabilityStatus.create('active').isActive()).toBe(true);
    expect(CapabilityStatus.create('active').isArchived()).toBe(false);
    expect(CapabilityStatus.create('archived').isArchived()).toBe(true);
  });

  it('progression orders statuses', () => {
    expect(CapabilityStatus.design().progression).toBe(0);
    expect(CapabilityStatus.create('active').progression).toBe(3);
    expect(CapabilityStatus.create('archived').progression).toBe(5);
  });
});
