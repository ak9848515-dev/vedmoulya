// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Environment manager unit tests
// Implements BLP-001/D01 — configuration validation
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Environment,
  EnvironmentError,
  env,
  isStrongSecret,
  defineStandardEnvVars,
} from '../index.js';

describe('EnvironmentError', () => {
  it('builds a message from missing and invalid lists', () => {
    const err = new EnvironmentError(['A', 'B'], ['C']);
    expect(err.message).toContain('2 missing');
    expect(err.message).toContain('1 invalid');
    expect(err.message).toContain('missing: A, B');
    expect(err.message).toContain('invalid: C');
    expect(err.name).toBe('EnvironmentError');
    expect(err.missing).toEqual(['A', 'B']);
    expect(err.invalid).toEqual(['C']);
  });

  it('handles empty lists', () => {
    const err = new EnvironmentError([], []);
    expect(err.message).toBe('Environment validation failed: 0 missing, 0 invalid');
  });
});

describe('Environment', () => {
  afterEach(() => {
    delete process.env.TEST_REQUIRED;
    delete process.env.TEST_OPTIONAL;
    delete process.env.TEST_PORT;
    delete process.env.TEST_BOOL;
  });

  it('define captures env values, defaults, and validation callbacks', () => {
    process.env.TEST_REQUIRED = 'hello';
    const e = new Environment();
    e.define([
      { key: 'TEST_REQUIRED', description: 'd', required: true },
      { key: 'TEST_OPTIONAL', description: 'd', required: false, default: 'fallback' },
    ]);
    expect(e.get('TEST_REQUIRED')).toBe('hello');
    expect(e.get('TEST_OPTIONAL')).toBe('fallback');
  });

  it('validate throws when a required variable is missing or empty', () => {
    const e = new Environment();
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    expect(() => e.validate()).toThrow(EnvironmentError);
    process.env.TEST_REQUIRED = '';
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    expect(() => e.validate()).toThrow(EnvironmentError);
  });

  it('validate throws when a value fails its validation callback', () => {
    process.env.TEST_OPTIONAL = 'nope';
    const e = new Environment();
    e.define([
      {
        key: 'TEST_OPTIONAL',
        description: 'd',
        required: false,
        validate: (v) => v === 'yes',
      },
    ]);
    expect(() => e.validate()).toThrow(EnvironmentError);
  });

  it('validate succeeds and marks the environment as validated', () => {
    process.env.TEST_REQUIRED = 'hello';
    const e = new Environment();
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    expect(e.isValidated()).toBe(false);
    e.validate();
    expect(e.isValidated()).toBe(true);
  });

  it('require returns the value or throws when missing', () => {
    process.env.TEST_REQUIRED = 'hello';
    const e = new Environment();
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    expect(e.require('TEST_REQUIRED')).toBe('hello');
    expect(() => e.require('MISSING_KEY')).toThrow(EnvironmentError);
  });

  it('number returns a parsed number, fallback, or undefined', () => {
    process.env.TEST_PORT = '8080';
    const e = new Environment();
    e.define([{ key: 'TEST_PORT', description: 'd', required: false }]);
    expect(e.number('TEST_PORT')).toBe(8080);
    expect(e.number('MISSING_KEY', 42)).toBe(42);
    expect(e.number('MISSING_KEY')).toBeUndefined();
  });

  it('boolean parses true/false strings and falls back', () => {
    process.env.TEST_BOOL = 'true';
    const e = new Environment();
    e.define([{ key: 'TEST_BOOL', description: 'd', required: false }]);
    expect(e.boolean('TEST_BOOL')).toBe(true);
    process.env.TEST_BOOL = '0';
    e.define([{ key: 'TEST_BOOL', description: 'd', required: false }]);
    expect(e.boolean('TEST_BOOL')).toBe(false);
    expect(e.boolean('MISSING_KEY', true)).toBe(true);
    process.env.TEST_BOOL = 'maybe';
    e.define([{ key: 'TEST_BOOL', description: 'd', required: false }]);
    expect(e.boolean('TEST_BOOL')).toBeUndefined();
  });

  it('all returns only defined values', () => {
    process.env.TEST_REQUIRED = 'hello';
    const e = new Environment();
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    expect(e.all()).toEqual({ TEST_REQUIRED: 'hello' });
  });

  it('clear resets entries and validation state', () => {
    process.env.TEST_REQUIRED = 'hello';
    const e = new Environment();
    e.define([{ key: 'TEST_REQUIRED', description: 'd', required: true }]);
    e.validate();
    e.clear();
    expect(e.isValidated()).toBe(false);
    expect(e.get('TEST_REQUIRED')).toBeUndefined();
  });
});

describe('isStrongSecret', () => {
  it('accepts a 32+ char random secret', () => {
    expect(isStrongSecret('a'.repeat(32))).toBe(true);
  });
  it('rejects short secrets', () => {
    expect(isStrongSecret('short')).toBe(false);
  });
  it('rejects placeholder values', () => {
    expect(isStrongSecret('development-secret'.padEnd(32, 'x'))).toBe(false);
    expect(isStrongSecret('change-me-'.padEnd(32, 'x'))).toBe(false);
  });

  it('accepts a long value that merely contains the word secret', () => {
    expect(isStrongSecret('secret'.padEnd(32, 'x'))).toBe(true);
  });
});

describe('defineStandardEnvVars', () => {
  it('registers the standard variables on the manager', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.API_PORT;
    delete process.env.API_HOST;
    delete process.env.APP_NAME;
    const e = new Environment();
    defineStandardEnvVars(e);
    expect(e.get('NODE_ENV')).toBeDefined();
    expect(e.get('AUTH_JWT_SECRET')).toBeDefined();
    expect(e.get('LOG_LEVEL')).toBe('debug');
    expect(e.get('API_PORT')).toBe('3000');
    expect(e.get('API_HOST')).toBe('0.0.0.0');
    expect(e.get('APP_NAME')).toBe('vedmoulya');
  });

  it('validates NODE_ENV against the known set', () => {
    const e = new Environment();
    defineStandardEnvVars(e);
    process.env.NODE_ENV = 'not-real';
    e.define([{ key: 'NODE_ENV', description: 'd', required: false, default: 'development' }]);
    expect(() => e.validate()).not.toThrow();
  });

  it('is used by the shared env singleton', () => {
    expect(env).toBeInstanceOf(Environment);
    expect(typeof env.define).toBe('function');
  });
});
