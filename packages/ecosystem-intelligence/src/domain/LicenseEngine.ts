// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// LicenseEngine — EPIC-015
//
// License intelligence. The SOFTWARE license (code) is evaluated
// SEPARATELY from the MODEL license (weights/training data). When the
// license cannot be established the verdict is LICENSE_UNKNOWN — such
// resources are never auto-approved for a commercial VedMoulya factory.
// ──────────────────────────────────────────────────────────────────

import type { LicenseIntelligence, LicenseUsageVerdict } from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

type LicenseFamily =
  'PERMISSIVE' | 'WEAK_COPYLEFT' | 'STRONG_COPYLEFT' | 'NON_COMMERCIAL' | 'PROPRIETARY';

const LICENSE_FAMILIES: Readonly<Record<string, LicenseFamily>> = {
  MIT: 'PERMISSIVE',
  'MIT-0': 'PERMISSIVE',
  'Apache-2.0': 'PERMISSIVE',
  'BSD-2-Clause': 'PERMISSIVE',
  'BSD-3-Clause': 'PERMISSIVE',
  ISC: 'PERMISSIVE',
  Zlib: 'PERMISSIVE',
  Unlicense: 'PERMISSIVE',
  'CC0-1.0': 'PERMISSIVE',
  'MPL-2.0': 'WEAK_COPYLEFT',
  'LGPL-2.1': 'WEAK_COPYLEFT',
  'LGPL-3.0': 'WEAK_COPYLEFT',
  'GPL-2.0': 'STRONG_COPYLEFT',
  'GPL-3.0': 'STRONG_COPYLEFT',
  'AGPL-3.0': 'STRONG_COPYLEFT',
  'CC-BY-NC-4.0': 'NON_COMMERCIAL',
  'CC-BY-NC-SA-4.0': 'NON_COMMERCIAL',
};

export class LicenseEngine {
  constructor(private readonly clock: ClockPort) {}

  /** Detect the family from a license identifier (case-insensitive, tolerant). */
  familyOf(license: string | undefined): LicenseFamily | 'UNKNOWN' {
    if (!license || license.trim() === '') return 'UNKNOWN';
    const key = license.trim().toLowerCase();
    const exact = Object.keys(LICENSE_FAMILIES).find((l) => l.toLowerCase() === key);
    // eslint-disable-next-line security/detect-object-injection -- Constant-record lookup: LICENSE_FAMILIES is a closed module-scope record; the key comes from Object.keys over that same record (never user-controlled input).
    if (exact) return LICENSE_FAMILIES[exact] as LicenseFamily;
    // Tolerate "MIT License", "Apache License 2.0", "GPL-3.0-or-later", …
    const normalized = key
      .replace(/ license$/i, '')
      .replace(/-or-later|-only$/i, '')
      .replace(/^apache /, 'Apache-');
    const fuzzy = Object.keys(LICENSE_FAMILIES).find((l) => normalized.includes(l.toLowerCase()));
    // eslint-disable-next-line security/detect-object-injection -- Constant-record lookup: same closed union as above.
    if (fuzzy) return LICENSE_FAMILIES[fuzzy] as LicenseFamily;
    if (/proprietary|commercial|eula|all rights reserved/i.test(key)) return 'PROPRIETARY';
    return 'UNKNOWN';
  }

  assess(opts: {
    softwareLicense?: string;
    modelLicense?: string;
    verifiedAt?: string;
  }): LicenseIntelligence {
    const software = this.assessLicense(opts.softwareLicense);
    const model =
      opts.modelLicense !== undefined ? this.assessLicense(opts.modelLicense) : undefined;

    const verdict = this.combine(software.verdict, model?.verdict);
    return {
      license: opts.softwareLicense,
      software,
      model,
      verdict,
      verifiedAt: opts.verifiedAt ?? this.clock.now(),
    };
  }

  private assessLicense(license: string | undefined): LicenseIntelligence['software'] {
    const family = this.familyOf(license);
    switch (family) {
      case 'PERMISSIVE':
        return {
          present: true,
          type: license,
          commercialUseRestricted: false,
          redistributionRestricted: false,
          attributionRequired:
            license === 'MIT' ||
            license === 'ISC' ||
            license === 'BSD-2-Clause' ||
            license === 'BSD-3-Clause',
          verdict: 'PERMISSIVE',
        };
      case 'WEAK_COPYLEFT':
        return {
          present: true,
          type: license,
          commercialUseRestricted: false,
          redistributionRestricted: true,
          attributionRequired: true,
          verdict: 'RESTRICTIVE',
        };
      case 'STRONG_COPYLEFT':
        return {
          present: true,
          type: license,
          commercialUseRestricted: false,
          redistributionRestricted: true,
          attributionRequired: true,
          verdict: 'RESTRICTIVE',
        };
      case 'NON_COMMERCIAL':
        return {
          present: true,
          type: license,
          commercialUseRestricted: true,
          redistributionRestricted: true,
          attributionRequired: true,
          verdict: 'COMMERCIAL_RESTRICTED',
        };
      case 'PROPRIETARY':
        return {
          present: true,
          type: license,
          commercialUseRestricted: true,
          redistributionRestricted: true,
          attributionRequired: false,
          verdict: 'COMMERCIAL_RESTRICTED',
        };
      default:
        return {
          present: false,
          type: undefined,
          commercialUseRestricted: false,
          redistributionRestricted: false,
          attributionRequired: false,
          verdict: 'LICENSE_UNKNOWN',
        };
    }
  }

  /** The overall verdict is the most restrictive of the two. */
  private combine(
    software: LicenseUsageVerdict,
    model: LicenseUsageVerdict | undefined,
  ): LicenseUsageVerdict {
    const rank: Record<LicenseUsageVerdict, number> = {
      PERMISSIVE: 0,
      RESTRICTIVE: 1,
      COMMERCIAL_RESTRICTED: 2,
      LICENSE_UNKNOWN: 3,
    };
    if (!model) return software;
    // eslint-disable-next-line security/detect-object-injection -- Constant-record lookup: rank is keyed by the LicenseUsageVerdict closed union (never user-controlled).
    if (rank[software] >= rank[model]) return software;
    return model;
  }
}
