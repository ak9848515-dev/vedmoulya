import { describe, expect, it } from 'vitest';
import { ProviderVersion } from '../ProviderVersion.js';

describe('ProviderVersion', () => {
  it('starts at 1.0.0', () => {
    expect(ProviderVersion.initial().toString()).toBe('1.0.0');
  });

  it('parses from strings with safe fallbacks', () => {
    expect(ProviderVersion.fromString('2.3.4').toString()).toBe('2.3.4');
    expect(ProviderVersion.fromString('2').toString()).toBe('2.0.0');
    expect(ProviderVersion.fromString('').toString()).toBe('1.0.0');
    expect(ProviderVersion.fromString('abc').toString()).toBe('1.0.0');
  });

  it('bumps major, minor, and patch', () => {
    const v = ProviderVersion.fromString('1.2.3');
    expect(v.bumpMajor().toString()).toBe('2.0.0');
    expect(v.bumpMinor().toString()).toBe('1.3.0');
    expect(v.bumpPatch().toString()).toBe('1.2.4');
  });

  it('minor bump resets patch, major bump resets both', () => {
    const minor = ProviderVersion.fromString('1.2.3').bumpMinor();
    expect(minor.toString()).toBe('1.3.0');
    const major = ProviderVersion.fromString('1.2.3').bumpMajor();
    expect(major.toString()).toBe('2.0.0');
  });

  it('compares equality', () => {
    expect(ProviderVersion.fromString('1.0.0').equals(ProviderVersion.initial())).toBe(true);
    expect(ProviderVersion.fromString('1.0.1').equals(ProviderVersion.initial())).toBe(false);
  });
});
