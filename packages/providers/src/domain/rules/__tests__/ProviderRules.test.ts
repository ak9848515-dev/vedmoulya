import { describe, expect, it } from 'vitest';
import {
  availabilityRule,
  modelsRule,
  providerFamilyRule,
  providerLifecycleStatusRule,
  providerNameRule,
  validate,
  PROVIDER_FAMILIES,
} from '../ProviderRules.js';

describe('ProviderRules', () => {
  it('requires a non-empty provider name ≤ 80 chars', () => {
    expect(providerNameRule('OpenAI').passed).toBe(true);
    expect(providerNameRule('   ').passed).toBe(false);
    expect(providerNameRule('x'.repeat(81)).passed).toBe(false);
  });

  it('accepts only known provider families', () => {
    for (const family of PROVIDER_FAMILIES) {
      expect(providerFamilyRule(family).passed).toBe(true);
    }
    expect(providerFamilyRule('xai' as 'openai').passed).toBe(false);
  });

  it('accepts only known lifecycle statuses', () => {
    expect(providerLifecycleStatusRule('active').passed).toBe(true);
    expect(providerLifecycleStatusRule('archived').passed).toBe(true);
    expect(providerLifecycleStatusRule('bogus' as 'active').passed).toBe(false);
  });

  it('validates availability within [0, 1]', () => {
    expect(availabilityRule(0.999).passed).toBe(true);
    expect(availabilityRule(0).passed).toBe(true);
    expect(availabilityRule(1).passed).toBe(true);
    expect(availabilityRule(1.5).passed).toBe(false);
    expect(availabilityRule(-0.1).passed).toBe(false);
    expect(availabilityRule(Number.NaN).passed).toBe(false);
  });

  it('requires at least one model', () => {
    expect(modelsRule(1).passed).toBe(true);
    expect(modelsRule(0).passed).toBe(false);
  });

  it('validate returns the first failing rule', () => {
    const result = validate([providerNameRule('OpenAI'), modelsRule(0), availabilityRule(1.5)]);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('model');
  });

  it('validate passes when all rules pass', () => {
    const result = validate([providerNameRule('OpenAI'), modelsRule(2), availabilityRule(0.999)]);
    expect(result.passed).toBe(true);
  });
});
