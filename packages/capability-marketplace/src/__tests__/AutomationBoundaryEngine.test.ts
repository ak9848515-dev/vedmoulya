// ──────────────────────────────────────────────────────────────────
// VedMoulya — AutomationBoundaryEngine tests
// EPIC-013 §6/§12 — never claim full automation where the
// provider/API does not support it; irreversible actions gate
// automation behind approval.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AutomationBoundaryEngine } from '../domain/AutomationBoundaryEngine.js';
import { candidate } from './fixtures.js';

const engine = new AutomationBoundaryEngine();

describe('AutomationBoundaryEngine — automation boundary', () => {
  it('marks an API-automatable step as FULLY_AUTOMATED', () => {
    const result = engine.assess([candidate()], false);
    expect(result.automation).toBe('FULLY_AUTOMATED');
  });

  it('marks a CONFIGURE candidate as PARTIALLY_AUTOMATED', () => {
    const result = engine.assess(
      [candidate({ classification: 'CONFIGURE', integrationType: 'DIRECT_PROVIDER' })],
      false,
    );
    expect(result.automation).toBe('PARTIALLY_AUTOMATED');
  });

  it('marks an external application step as PARTIALLY_AUTOMATED, never full', () => {
    const result = engine.assess(
      [
        candidate({
          integrationType: 'EXTERNAL_APPLICATION',
          classification: 'EXTERNAL',
          apiAvailable: 'UNKNOWN',
        }),
      ],
      false,
    );
    expect(result.automation).toBe('PARTIALLY_AUTOMATED');
    expect(result.reasons.join(' ')).toMatch(/assume partial\/manual/i);
  });

  it('marks a manual step as MANUAL', () => {
    const result = engine.assess(
      [candidate({ integrationType: 'MANUAL_STEP', classification: 'MANUAL' })],
      false,
    );
    expect(result.automation).toBe('MANUAL');
  });

  it('marks an unknown integration as MANUAL (fail safe)', () => {
    const result = engine.assess(
      [candidate({ integrationType: 'UNKNOWN', classification: 'UNKNOWN' })],
      false,
    );
    expect(result.automation).toBe('MANUAL');
  });

  it('gates an irreversible automatable step behind HUMAN_APPROVAL', () => {
    const result = engine.assess([candidate()], true);
    expect(result.automation).toBe('HUMAN_APPROVAL');
    expect(result.reasons.join(' ')).toMatch(/approval required/i);
  });

  it('marks an irreversible non-automatable step as MANUAL', () => {
    const result = engine.assess(
      [candidate({ integrationType: 'MANUAL_STEP', classification: 'MANUAL' })],
      true,
    );
    expect(result.automation).toBe('MANUAL');
  });

  it('returns MANUAL when there are no candidates at all', () => {
    const result = engine.assess([], false);
    expect(result.automation).toBe('MANUAL');
  });

  it('computes overall automation level + percent', () => {
    const fully = engine.overall([
      { automation: 'FULLY_AUTOMATED' },
      { automation: 'FULLY_AUTOMATED' },
    ]);
    expect(fully.automation).toBe('FULLY_AUTOMATED');
    expect(fully.percent).toBe(100);

    const mixed = engine.overall([{ automation: 'FULLY_AUTOMATED' }, { automation: 'MANUAL' }]);
    expect(mixed.automation).toBe('MANUAL');
    expect(mixed.percent).toBe(50);

    const approval = engine.overall([
      { automation: 'FULLY_AUTOMATED' },
      { automation: 'HUMAN_APPROVAL' },
    ]);
    expect(approval.automation).toBe('HUMAN_APPROVAL');
  });
});
