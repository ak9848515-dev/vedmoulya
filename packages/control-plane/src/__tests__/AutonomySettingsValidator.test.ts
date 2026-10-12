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

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT-031 — remaining validator branches: category/provider allowlist
// shape, automation-permission id shape, and the defaulted cap fields.
// ─────────────────────────────────────────────────────────────────────────────

describe('AutonomySettingsValidator — list and id validation branches', () => {
  const base = {
    ownerId: 'u1',
    autonomyLevel: 2,
    updatedBy: 'u1',
    userConfirmed: true,
  };

  it('REFUSES malformed allowed/prohibited categories', () => {
    const bad = new AutonomySettingsValidator().validate({
      ...base,
      allowedCategories: ['lowercase'],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/allowedCategories contains an invalid category/);

    const prohibitedBad = new AutonomySettingsValidator().validate({
      ...base,
      prohibitedCategories: ['A'],
    });
    expect(prohibitedBad.success).toBe(false);
    if (!prohibitedBad.success) {
      expect(prohibitedBad.error).toMatch(/prohibitedCategories contains an invalid category/);
    }
  });

  it('REFUSES malformed provider ids in either list', () => {
    const bad = new AutonomySettingsValidator().validate({
      ...base,
      allowedProviders: ['OpenAI'],
    });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error).toMatch(/allowedProviders contains an invalid provider id/);

    const prohibitedBad = new AutonomySettingsValidator().validate({
      ...base,
      prohibitedProviders: ['has spaces'],
    });
    expect(prohibitedBad.success).toBe(false);
    if (!prohibitedBad.success) {
      expect(prohibitedBad.error).toMatch(/prohibitedProviders contains an invalid provider id/);
    }
  });

  it('REFUSES malformed automation-permission ids', () => {
    const result = new AutonomySettingsValidator().validate({
      ...base,
      automationPermissions: ['valid-wf-1', 'bad id!'],
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error).toMatch(/automationPermissions contains an invalid id/);
  });

  it('accepts valid automation-permission ids and caps the retained shape', () => {
    const result = new AutonomySettingsValidator().validate({
      ...base,
      automationPermissions: ['wf-1', 'wf_2', 'wf3'],
      maxDailyCostUsd: 0,
      maxTaskCostUsd: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.settings.automationPermissions).toEqual(['wf-1', 'wf_2', 'wf3']);
      expect(result.settings.maxDailyCostUsd).toBe(0);
    }
  });
});
