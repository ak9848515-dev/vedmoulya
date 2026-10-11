import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isAtLeast,
  isPiiType,
  calculateCompleteness,
  calculateTimeliness,
  LifecycleTransitionError,
  PII_INFORMATION_TYPES,
  DEFAULT_RETENTION_DAYS,
} from '../index.js';

describe('@vedmoulya/information — lifecycle & classification', () => {
  it('allows only declared lifecycle transitions', () => {
    expect(canTransition('captured', 'active')).toBe(true);
    expect(canTransition('active', 'archived')).toBe(true);
    expect(canTransition('purged', 'active')).toBe(false);
    expect(canTransition('captured', 'purged')).toBe(false);
  });

  it('orders classification restrictiveness', () => {
    expect(isAtLeast('confidential', 'sensitive')).toBe(true);
    expect(isAtLeast('public', 'internal')).toBe(false);
  });

  it('identifies PII information types', () => {
    expect(isPiiType('user_credentials')).toBe(true);
    expect(isPiiType('user_settings')).toBe(false);
    expect(PII_INFORMATION_TYPES).toContain('consent_record');
  });
});

describe('@vedmoulya/information — quality metrics', () => {
  it('treats an empty required-field list as complete', () => {
    expect(calculateCompleteness({}, [])).toBe(100);
  });

  it('scores filled required fields proportionally', () => {
    expect(calculateCompleteness({ a: 1, b: '', c: null, d: 4 }, ['a', 'b', 'c', 'd'])).toBe(50);
  });

  it('calculateTimeliness returns elapsed ms', () => {
    const past = new Date(Date.now() - 1000);
    expect(calculateTimeliness(past)).toBeGreaterThanOrEqual(1000);
  });
});

describe('@vedmoulya/information — governance constants & errors', () => {
  it('assigns a retention policy to every information type', () => {
    expect(DEFAULT_RETENTION_DAYS.consent_record).toBe(3650);
    expect(DEFAULT_RETENTION_DAYS.authentication_log).toBe(90);
  });

  it('LifecycleTransitionError carries from/to details', () => {
    const err = new LifecycleTransitionError('purged', 'active');
    expect(err.message).toContain("Cannot transition from 'purged' to 'active'");
  });
});
