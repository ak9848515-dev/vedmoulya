import { describe, it, expect } from 'vitest';
import { LicenseEngine } from '../domain/LicenseEngine.js';
import { FIXED_NOW } from './fixtures.js';

const clock = { now: () => FIXED_NOW };
const engine = new LicenseEngine(clock);

describe('LicenseEngine', () => {
  it('MIT → permissive with attribution', () => {
    const license = engine.assess({ softwareLicense: 'MIT', verifiedAt: FIXED_NOW });
    expect(license.software.verdict).toBe('PERMISSIVE');
    expect(license.software.commercialUseRestricted).toBe(false);
    expect(license.software.attributionRequired).toBe(true);
    expect(license.verdict).toBe('PERMISSIVE');
  });

  it('Apache-2.0 → permissive', () => {
    expect(engine.assess({ softwareLicense: 'Apache-2.0' }).software.verdict).toBe('PERMISSIVE');
  });

  it('fuzzy detection tolerates "MIT License" / "GPL-3.0-or-later"', () => {
    expect(engine.familyOf('MIT License')).toBe('PERMISSIVE');
    expect(engine.familyOf('GPL-3.0-or-later')).toBe('STRONG_COPYLEFT');
  });

  it('GPL → restrictive (redistribution restricted)', () => {
    const license = engine.assess({ softwareLicense: 'GPL-3.0' });
    expect(license.software.verdict).toBe('RESTRICTIVE');
    expect(license.software.redistributionRestricted).toBe(true);
  });

  it('non-commercial license → COMMERCIAL_RESTRICTED — never auto-approved for a commercial factory', () => {
    const license = engine.assess({ softwareLicense: 'CC-BY-NC-4.0' });
    expect(license.software.verdict).toBe('COMMERCIAL_RESTRICTED');
    expect(license.software.commercialUseRestricted).toBe(true);
  });

  it('unknown/missing license → LICENSE_UNKNOWN (first-class, never assumed free)', () => {
    const none = engine.assess({});
    expect(none.software.verdict).toBe('LICENSE_UNKNOWN');
    expect(none.software.present).toBe(false);
    expect(engine.familyOf('whatever-unknown-license')).toBe('UNKNOWN');
  });

  it('model license is evaluated SEPARATELY from software license', () => {
    const license = engine.assess({ softwareLicense: 'MIT', modelLicense: 'CC-BY-NC-4.0' });
    expect(license.software.verdict).toBe('PERMISSIVE');
    expect(license.model?.verdict).toBe('COMMERCIAL_RESTRICTED');
    // Overall verdict is the most restrictive of the two.
    expect(license.verdict).toBe('COMMERCIAL_RESTRICTED');
  });

  it('proprietary license → COMMERCIAL_RESTRICTED', () => {
    const license = engine.assess({ softwareLicense: 'Proprietary EULA' });
    expect(license.software.verdict).toBe('COMMERCIAL_RESTRICTED');
  });
});
