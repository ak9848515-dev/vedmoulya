// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Compatibility Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceCompatibilityService } from '../MarketplaceCompatibilityService.js';

describe('MarketplaceCompatibilityService', () => {
  it('checkAssetCompatibility returns compatible for no requirements', () => {
    const svc = new MarketplaceCompatibilityService();
    const result = svc.checkAssetCompatibility([]);
    expect(result.overall).toBe('compatible');
    expect(result.checks.length).toBe(1);
  });

  it('checkAssetCompatibility passes matching platform version', () => {
    const svc = new MarketplaceCompatibilityService('1.0.0');
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '1.0.0', optional: false },
    ]);
    expect(result.overall).toBe('compatible');
    expect(result.checks[0].status).toBe('passed');
  });

  it('checkAssetCompatibility warns for partial platform match', () => {
    const svc = new MarketplaceCompatibilityService('1.0.0');
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '1.1.0', optional: false },
    ]);
    expect(result.overall).toBe('partial');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('checkAssetCompatibility fails incompatible platform', () => {
    const svc = new MarketplaceCompatibilityService('1.0.0');
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '2.0.0', optional: false },
    ]);
    expect(result.overall).toBe('incompatible');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('checkAssetCompatibility passes optional requirements', () => {
    const svc = new MarketplaceCompatibilityService('1.0.0');
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '1.0.0', optional: false },
      { name: 'redis', version: '6.0', optional: true },
    ]);
    expect(result.overall).toBe('compatible');
    expect(result.checks.length).toBe(2);
  });

  it('checkUpdateCompatibility handles major version upgrade', () => {
    const svc = new MarketplaceCompatibilityService();
    const result = svc.checkUpdateCompatibility('1.0.0', '2.0.0');
    expect(result.overall).toBe('partial');
    expect(result.warnings.some((w) => w.includes('Breaking'))).toBe(true);
  });

  it('checkUpdateCompatibility handles minor upgrade', () => {
    const svc = new MarketplaceCompatibilityService();
    const result = svc.checkUpdateCompatibility('1.0.0', '1.1.0');
    expect(result.overall).toBe('compatible');
  });

  it('checkUpdateCompatibility handles patch upgrade', () => {
    const svc = new MarketplaceCompatibilityService();
    const result = svc.checkUpdateCompatibility('1.0.0', '1.0.1');
    expect(result.overall).toBe('compatible');
  });

  it('checkUpdateCompatibility fails invalid downgrade', () => {
    const svc = new MarketplaceCompatibilityService();
    const result = svc.checkUpdateCompatibility('2.0.0', '1.0.0');
    expect(result.overall).toBe('incompatible');
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('getCompatibilitySummary returns compatible baseline', () => {
    const svc = new MarketplaceCompatibilityService('1.5.0');
    const summary = svc.getCompatibilitySummary();
    expect(summary.overall).toBe('compatible');
    expect(summary.platformVersion).toBe('1.5.0');
  });

  it('higher platform version is compatible', () => {
    const svc = new MarketplaceCompatibilityService('2.0.0');
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '1.0.0', optional: false },
    ]);
    expect(result.overall).toBe('compatible');
  });

  it('checkVersionCompatibility falls to incompatible for unrelated minor versions', () => {
    const svc = new MarketplaceCompatibilityService('1.0.0');
    // version 1.0.0 vs req 1.3.0: platParts[1] (0) !== reqParts[1] - 1 (2), so falls to 'incompatible'
    const result = svc.checkAssetCompatibility([
      { name: 'platform', version: '1.3.0', optional: false },
    ]);
    expect(result.overall).toBe('incompatible');
  });
});
