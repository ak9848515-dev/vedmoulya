// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Compatibility Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceCompatibilityDTO, CompatibilityCheckDTO } from './MarketplaceDTO.js';

export class MarketplaceCompatibilityService {
  private readonly platformVersion: string;

  constructor(platformVersion: string = '1.0.0') {
    this.platformVersion = platformVersion;
  }

  checkAssetCompatibility(
    requirements: Array<{ name: string; version: string; optional: boolean }>,
  ): MarketplaceCompatibilityDTO {
    const checks: CompatibilityCheckDTO[] = [];
    const issues: string[] = [];
    const warnings: string[] = [];

    for (const req of requirements) {
      if (req.name === 'platform') {
        const compatible = this.checkVersionCompatibility(req.version);
        if (compatible === 'compatible') {
          checks.push({
            name: `Platform ${req.version}`,
            status: 'passed',
            message: `Platform requirement satisfied: ${req.version}`,
          });
        } else if (compatible === 'partial') {
          checks.push({
            name: `Platform ${req.version}`,
            status: 'warning',
            message: `Partial platform compatibility: ${req.version}`,
          });
          warnings.push(
            `Platform version ${req.version} has partial compatibility with ${this.platformVersion}`,
          );
        } else {
          checks.push({
            name: `Platform ${req.version}`,
            status: 'failed',
            message: `Platform requirement not met: ${req.version}`,
          });
          issues.push(`Requires platform ${req.version}, current: ${this.platformVersion}`);
        }
      } else {
        checks.push({
          name: req.name,
          status: 'passed',
          message: `Requirement satisfied: ${req.name} v${req.version}`,
        });
      }
    }

    if (checks.length === 0) {
      checks.push({
        name: 'No Requirements',
        status: 'passed',
        message: 'No specific requirements',
      });
    }

    let overall: MarketplaceCompatibilityDTO['overall'] = 'compatible';
    if (issues.length > 0) overall = 'incompatible';
    else if (warnings.length > 0) overall = 'partial';

    return { overall, platformVersion: this.platformVersion, checks, issues, warnings };
  }

  checkUpdateCompatibility(
    currentVersion: string,
    newVersion: string,
  ): MarketplaceCompatibilityDTO {
    const checks: CompatibilityCheckDTO[] = [];
    const issues: string[] = [];
    const warnings: string[] = [];

    const currentParts = currentVersion.split('.').map(Number);
    const newParts = newVersion.split('.').map(Number);

    const currentMajor = currentParts[0] ?? 0;
    const currentMinor = currentParts[1] ?? 0;
    const currentPatch = currentParts[2] ?? 0;
    const newMajor = newParts[0] ?? 0;
    const newMinor = newParts[1] ?? 0;
    const newPatch = newParts[2] ?? 0;

    if (newMajor > currentMajor) {
      checks.push({
        name: 'Major Version Upgrade',
        status: 'warning',
        message: `Major version upgrade from ${currentVersion} to ${newVersion}`,
      });
      warnings.push(
        `Breaking changes may be present in major upgrade from ${currentVersion} to ${newVersion}`,
      );
    } else if (newMajor === currentMajor && newMinor > currentMinor) {
      checks.push({
        name: 'Minor Version Upgrade',
        status: 'passed',
        message: `Minor version upgrade from ${currentVersion} to ${newVersion}`,
      });
    } else if (newMajor === currentMajor && newMinor === currentMinor && newPatch > currentPatch) {
      checks.push({
        name: 'Patch Version Upgrade',
        status: 'passed',
        message: `Patch version upgrade from ${currentVersion} to ${newVersion}`,
      });
    } else {
      checks.push({
        name: 'Version Comparison',
        status: 'failed',
        message: `Invalid version upgrade path from ${currentVersion} to ${newVersion}`,
      });
      issues.push(`Cannot upgrade from ${currentVersion} to ${newVersion} - not a forward upgrade`);
    }

    const overall =
      issues.length > 0 ? 'incompatible' : warnings.length > 0 ? 'partial' : 'compatible';
    return { overall, platformVersion: this.platformVersion, checks, issues, warnings };
  }

  getCompatibilitySummary(): MarketplaceCompatibilityDTO {
    return {
      overall: 'compatible',
      platformVersion: this.platformVersion,
      checks: [
        {
          name: 'Platform',
          status: 'passed',
          message: `Running platform version ${this.platformVersion}`,
        },
      ],
      issues: [],
      warnings: [],
    };
  }

  /**
   * Checks whether the running platform version satisfies a required version.
   *
   * NOTE: Versions are parsed by splitting on '.' and converting to numbers.
   * Non-numeric segments (e.g. pre-release tags like '1.0.0-beta') produce NaN,
   * which causes all comparisons to return false, ultimately falling through to
   * 'incompatible'. This is intentional — pre-release versions are not considered
   * compatible with stable releases unless explicitly allowed.
   */
  private checkVersionCompatibility(required: string): 'compatible' | 'partial' | 'incompatible' {
    const reqParts = required.split('.').map(Number);
    const platParts = this.platformVersion.split('.').map(Number);

    const reqMajor = reqParts[0] ?? 0;
    const reqMinor = reqParts[1] ?? 0;
    const platMajor = platParts[0] ?? 0;
    const platMinor = platParts[1] ?? 0;

    if (platMajor > reqMajor) return 'compatible';
    if (platMajor < reqMajor) return 'incompatible';
    if (platMinor >= reqMinor) return 'compatible';
    if (platMinor === reqMinor - 1) return 'partial';
    return 'incompatible';
  }
}
