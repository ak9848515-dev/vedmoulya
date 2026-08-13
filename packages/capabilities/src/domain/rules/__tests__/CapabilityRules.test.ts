import { describe, expect, it } from 'vitest';
import {
  businessModulesRule,
  capabilityCategoryRule,
  capabilityNameRule,
  capabilityStatusRule,
  confidenceRule,
  qualityProfileRule,
  validate,
} from '../CapabilityRules.js';

describe('CapabilityRules', () => {
  it('name rule requires non-empty and ≤80 chars', () => {
    expect(capabilityNameRule('Content Generation').passed).toBe(true);
    expect(capabilityNameRule('   ').passed).toBe(false);
    expect(capabilityNameRule('x'.repeat(81)).passed).toBe(false);
    expect(capabilityNameRule('x'.repeat(80)).passed).toBe(true);
  });

  it('category rule accepts known categories only', () => {
    expect(capabilityCategoryRule('content').passed).toBe(true);
    expect(capabilityCategoryRule('unknown' as 'content').passed).toBe(false);
  });

  it('status rule accepts known lifecycle statuses', () => {
    expect(capabilityStatusRule('active').passed).toBe(true);
    expect(capabilityStatusRule('archived').passed).toBe(true);
    expect(capabilityStatusRule('deployed' as 'active').passed).toBe(false);
  });

  it('business module rule rejects unknown modules', () => {
    expect(businessModulesRule(['content-agency', 'learning']).passed).toBe(true);
    expect(businessModulesRule(['not-a-module' as 'learning']).passed).toBe(false);
  });

  it('confidence must be within [0, 1]', () => {
    expect(confidenceRule(0.5).passed).toBe(true);
    expect(confidenceRule(0).passed).toBe(true);
    expect(confidenceRule(1).passed).toBe(true);
    expect(confidenceRule(1.1).passed).toBe(false);
    expect(confidenceRule(-0.1).passed).toBe(false);
  });

  it('quality profile requires minimum ≤ target within [0, 1]', () => {
    expect(qualityProfileRule(0.9, 0.7).passed).toBe(true);
    expect(qualityProfileRule(0.9, 0.95).passed).toBe(false);
    expect(qualityProfileRule(1.2, 0.7).passed).toBe(false);
    expect(qualityProfileRule(0.9, -0.1).passed).toBe(false);
  });

  it('validate returns the first failing rule', () => {
    const result = validate([
      { passed: true },
      { passed: false, message: 'first failure' },
      { passed: false, message: 'second failure' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.message).toBe('first failure');
  });

  it('validate passes when all rules pass', () => {
    const result = validate([{ passed: true }, { passed: true }]);
    expect(result.passed).toBe(true);
  });
});
