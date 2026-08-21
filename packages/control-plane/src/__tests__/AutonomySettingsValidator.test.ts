import { describe, expect, it } from 'vitest';
import { AutonomySettingsValidator } from '../domain/AutonomySettingsValidator.js';

describe('AutonomySettingsValidator (SPRINT-031)', () => {
  const base = {
    ownerId: 'u1',
    autonomyLevel: 2,
    updatedBy: 'u1',
    userConfirmed: true,
  };

  it('accepts an explicit, confirmed, valid settings shape', () => {
    const result = new AutonomySettingsValidator().validate({
      ...base,
      maxDailyCostUsd: 5,
      privateOnly: false,
      allowedCategories: ['AUTOMATION', 'TASK'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.settings.autonomyLevel).toBe(2);
      expect(result.settings.userConfirmed).toBe(true);
      expect(result.settings.allowedCategories).toEqual(['AUTOMATION', 'TASK']);
      expect(result.settings.privateOnly).toBe(false);
    }
  });

  it('REFUSES without explicit user confirmation (silence is never consent)', () => {
    const result = new AutonomySettingsValidator().validate({ ...base, userConfirmed: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/explicit user confirmation/);
  });

  it('REFUSES out-of-range autonomy levels', () => {
    for (const level of [-1, 6, 1.5, Number.NaN]) {
      const result = new AutonomySettingsValidator().validate({ ...base, autonomyLevel: level });
      expect(result.success).toBe(false);
    }
  });

  it('REFUSES negative or non-finite cost caps', () => {
    const result = new AutonomySettingsValidator().validate({ ...base, maxDailyCostUsd: -1 });
    expect(result.success).toBe(false);
    const nan = new AutonomySettingsValidator().validate({ ...base, maxTaskCostUsd: Number.NaN });
    expect(nan.success).toBe(false);
  });

  it('REFUSES a provider that is both allowed and prohibited (no ambiguity)', () => {
    const result = new AutonomySettingsValidator().validate({
      ...base,
      allowedProviders: ['openai'],
      prohibitedProviders: ['openai'],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/both allowed and prohibited/);
  });

  it('REFUSES malformed quiet hours', () => {
    const bad = new AutonomySettingsValidator().validate({
      ...base,
      quietHours: { start: '25:99', end: '10:00' },
    });
    expect(bad.success).toBe(false);
    const good = new AutonomySettingsValidator().validate({
      ...base,
      quietHours: { start: '22:00', end: '06:30' },
    });
    expect(good.success).toBe(true);
  });

  it('defaults to the most restrictive posture when fields are omitted', () => {
    const result = new AutonomySettingsValidator().validate({
      ownerId: 'u1',
      autonomyLevel: 0,
      updatedBy: 'u1',
      userConfirmed: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.settings.maxDailyCostUsd).toBe(0);
      expect(result.settings.privateOnly).toBe(true);
      expect(result.settings.notificationPreference).toBe('briefing-only');
    }
  });
});
