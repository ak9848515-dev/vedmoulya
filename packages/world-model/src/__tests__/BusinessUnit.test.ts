// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — BusinessUnit tests (SPRINT-032)
// Configurable business units — NEVER hard-coded businesses, NEVER assumed
// profitable. Units are configuration: identity, purpose, target customer,
// offerings, workflows, opportunities, costs, revenue, KPIs, automation
// level, AI capabilities, human responsibilities, approval requirements.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { BusinessUnitValidator } from '../domain/BusinessUnit.js';
import { InMemoryWorldStores } from '../infrastructure/InMemoryWorldStores.js';

const validator = new BusinessUnitValidator();

describe('BusinessUnitValidator', () => {
  it('builds a valid configurable unit with bounded lists', () => {
    const result = validator.validate({
      ownerId: 'u1',
      name: 'Content / YouTube',
      purpose: 'Produce and publish educational content.',
      targetCustomer: 'Self-learners',
      offerings: ['YouTube automation', 'scripting', 'SEO'],
      automationLevel: 3,
      aiCapabilities: ['TEXT_GENERATION', 'VIDEO_EDITING', 'TEXT_TO_SPEECH'],
      humanResponsibilities: ['final review', 'publishing approval'],
      approvalRequirements: ['external publication'],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stableKey).toContain('content-youtube');
    expect(result.data.offerings).toContain('YouTube automation');
    expect(result.data.automationLevel).toBe(3);
    expect(result.data.status).toBe('ACTIVE');
  });

  it('clamps automation level to 0..5 (fail-closed default 0)', () => {
    const high = validator.validate({ ownerId: 'u1', name: 'x', purpose: 'p', automationLevel: 9 });
    expect(high.success && high.data.automationLevel).toBe(5);
    const low = validator.validate({ ownerId: 'u1', name: 'x', purpose: 'p', automationLevel: -2 });
    expect(low.success && low.data.automationLevel).toBe(0);
    const unset = validator.validate({ ownerId: 'u1', name: 'x', purpose: 'p' });
    expect(unset.success && unset.data.automationLevel).toBe(0);
  });

  it('refuses missing names / purposes and over-sized lists', () => {
    expect(validator.validate({ ownerId: 'u1', name: '', purpose: 'p' }).success).toBe(false);
    expect(validator.validate({ ownerId: 'u1', name: 'x', purpose: '' }).success).toBe(false);
    expect(
      validator.validate({
        ownerId: 'u1',
        name: 'x',
        purpose: 'p',
        offerings: Array.from({ length: 30 }, (_, i) => `o-${i}`),
      }).success,
    ).toBe(false);
  });

  it('refuses over-long names / purposes and over-sized KPI/approval lists', () => {
    expect(validator.validate({ ownerId: 'u1', name: 'x'.repeat(81), purpose: 'p' }).success).toBe(
      false,
    );
    expect(validator.validate({ ownerId: 'u1', name: 'x', purpose: 'p'.repeat(501) }).success).toBe(
      false,
    );
    expect(
      validator.validate({
        ownerId: 'u1',
        name: 'x',
        purpose: 'p',
        kpis: Array.from({ length: 21 }, (_, i) => `k-${i}`),
      }).success,
    ).toBe(false);
    expect(
      validator.validate({
        ownerId: 'u1',
        name: 'x',
        purpose: 'p',
        aiCapabilities: Array.from({ length: 31 }, (_, i) => `ai-${i}`),
      }).success,
    ).toBe(false);
    expect(
      validator.validate({
        ownerId: 'u1',
        name: 'x',
        purpose: 'p',
        humanResponsibilities: Array.from({ length: 31 }, (_, i) => `h-${i}`),
      }).success,
    ).toBe(false);
    expect(
      validator.validate({
        ownerId: 'u1',
        name: 'x',
        purpose: 'p',
        approvalRequirements: Array.from({ length: 21 }, (_, i) => `a-${i}`),
      }).success,
    ).toBe(false);
  });
});

describe('InMemoryWorldStores.businessUnits', () => {
  it('is owner-scoped and idempotent by stable key', () => {
    const stores = new InMemoryWorldStores();
    const unit = validator.validate({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Deliver AI automation.',
    });
    if (!unit.success) return;
    stores.businessUnits.save(unit.data);
    const dup = validator.validate({
      ownerId: 'u1',
      name: 'AI solutions',
      purpose: 'Updated.',
    });
    if (!dup.success) return;
    const existing = stores.businessUnits.getByKey('u1', dup.data.stableKey);
    expect(existing?.id).toBe(unit.data.id);
    expect(stores.businessUnits.list('u2')).toHaveLength(0);
  });
});
