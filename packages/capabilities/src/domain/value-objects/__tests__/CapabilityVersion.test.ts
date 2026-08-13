import { describe, expect, it } from 'vitest';
import { CapabilityVersion } from '../CapabilityVersion.js';

describe('CapabilityVersion', () => {
  it('starts at 1.0.0', () => {
    expect(CapabilityVersion.initial().toString()).toBe('1.0.0');
  });

  it('parses from string', () => {
    expect(CapabilityVersion.fromString('2.3.4').toString()).toBe('2.3.4');
  });

  it('parses partial versions defensively', () => {
    expect(CapabilityVersion.fromString('2').toString()).toBe('2.0.0');
    expect(CapabilityVersion.fromString('2.1').toString()).toBe('2.1.0');
  });

  it('bumps major and resets minor/patch', () => {
    const v = CapabilityVersion.fromString('1.2.3').bumpMajor();
    expect(v.toString()).toBe('2.0.0');
  });

  it('bumps minor and resets patch', () => {
    const v = CapabilityVersion.fromString('1.2.3').bumpMinor();
    expect(v.toString()).toBe('1.3.0');
  });

  it('bumps patch', () => {
    const v = CapabilityVersion.fromString('1.2.3').bumpPatch();
    expect(v.toString()).toBe('1.2.4');
  });

  it('compares equality', () => {
    expect(CapabilityVersion.fromString('1.0.0').equals(CapabilityVersion.initial())).toBe(true);
    expect(CapabilityVersion.initial().equals(CapabilityVersion.fromString('1.0.1'))).toBe(false);
  });
});
