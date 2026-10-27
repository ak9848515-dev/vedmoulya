// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace view derivation tests (integrity repair 2026-10-26)
//
// These tests exist to catch the specific regressions found in the audit:
//   • fixed stat values (12 installed / 3 providers / 2 updates / 8 templates /
//     100% compatible) instead of backend-derived counts
//   • a hardcoded INITIAL_ASSETS array used as UI data
//   • install/uninstall flipping React local state with no persisted mutation
//   • a compatibility percentage invented without any compatibility checks
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  MARKETPLACE_INSTALL_AVAILABLE,
  MARKETPLACE_INSTALL_UNAVAILABLE_REASON,
  compatibilityLabel,
  deriveMarketplaceView,
  updatesBadgeText,
} from '../marketplace-view.js';

function asset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    name: 'Prompt Pack: Executive',
    type: 'prompt_pack',
    category: 'prompts',
    version: '2.1.0',
    rating: 4.6,
    isInstalled: false,
    isActive: false,
    ...overrides,
  };
}

function snapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msnap_u1',
    userId: 'u1',
    generatedAt: '2026-10-26T00:00:00.000Z',
    catalog: { totalAssets: 0, featured: [], popular: [], recent: [], categories: [] },
    installedAssets: [],
    availableUpdates: [],
    providers: [],
    compatibility: {
      overall: 'unknown',
      platformVersion: '1.0.0',
      checks: [],
      issues: [],
      warnings: [],
    },
    ...overrides,
  };
}

describe('deriveMarketplaceView — counts come from the snapshot', () => {
  it('reports zeros for an empty snapshot (never the old fixed 12/3/2/8/100%)', () => {
    const view = deriveMarketplaceView({ success: true, data: snapshot() });

    expect(view.availability).toBe('empty');
    expect(view.counts).toEqual({
      installedAssets: 0,
      providers: 0,
      updates: 0,
      catalogAssets: 0,
      templates: 0,
      compatibilityPassed: 0,
      compatibilityTotal: 0,
    });
    expect(view.assets).toEqual([]);
    expect(view.unavailableReason).toBeNull();
  });

  it('derives every count from the assets/providers/updates actually returned', () => {
    const view = deriveMarketplaceView({
      success: true,
      data: snapshot({
        catalog: {
          totalAssets: 3,
          featured: [asset({ id: 'a1', isInstalled: true })],
          popular: [
            asset({ id: 'a2', name: 'Workflow: Weekly Review', type: 'workflow_template' }),
          ],
          recent: [],
          categories: [],
        },
        installedAssets: [
          asset({ id: 'a1', isInstalled: true, isActive: true }),
          asset({
            id: 'a3',
            name: 'Knowledge Pack: TS',
            type: 'knowledge_pack',
            isInstalled: true,
          }),
        ],
        availableUpdates: [
          {
            id: 'v1',
            assetId: 'a1',
            assetName: 'Prompt Pack: Executive',
            version: '2.2.0',
            breaking: false,
          },
        ],
        providers: [
          { id: 'p1', name: 'OpenAI', type: 'ai', status: 'active', apiKeyConfigured: true },
        ],
        compatibility: {
          overall: 'compatible',
          platformVersion: '1.0.0',
          checks: [{ name: 'runtime', status: 'passed' }],
          issues: [],
          warnings: [],
        },
      }),
    });

    expect(view.availability).toBe('ready');
    expect(view.counts.installedAssets).toBe(2);
    expect(view.counts.providers).toBe(1);
    expect(view.counts.updates).toBe(1);
    expect(view.counts.templates).toBe(1);
    expect(view.counts.compatibilityPassed).toBe(1);
    expect(view.counts.compatibilityTotal).toBe(1);
    // a1 (installed) + a2 (popular) + a3 (installed) — deduped by id.
    expect(view.assets.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(view.installedAssets.map((a) => a.id)).toEqual(['a1', 'a3']);
  });

  it('marks an update only when availableUpdates names the asset', () => {
    const view = deriveMarketplaceView({
      success: true,
      data: snapshot({
        catalog: {
          totalAssets: 2,
          featured: [asset({ id: 'a1', version: '1.0.0' }), asset({ id: 'a2', version: '1.0.0' })],
          popular: [],
          recent: [],
          categories: [],
        },
        availableUpdates: [{ id: 'v1', assetId: 'a2', version: '1.1.0', breaking: false }],
      }),
    });

    const a1 = view.assets.find((a) => a.id === 'a1');
    const a2 = view.assets.find((a) => a.id === 'a2');
    expect(a1?.updateAvailable).toBe(false);
    expect(a2?.updateAvailable).toBe(true);
  });

  it('does not invent a compatibility percentage without checks', () => {
    const view = deriveMarketplaceView({
      success: true,
      data: snapshot({
        catalog: {
          totalAssets: 1,
          featured: [asset({ id: 'a1' })],
          popular: [],
          recent: [],
          categories: [],
        },
      }),
    });

    expect(view.counts.compatibilityTotal).toBe(0);
    expect(compatibilityLabel(view.compatibility)).toBe('Not checked');
  });

  it('counts only checks the backend reported as passed', () => {
    const view = deriveMarketplaceView({
      success: true,
      data: snapshot({
        compatibility: {
          overall: 'partial',
          platformVersion: '1.0.0',
          checks: [
            { name: 'runtime', status: 'passed' },
            { name: 'dependency', status: 'failed' },
            { name: 'optional', status: 'skipped' },
          ],
          issues: ['dependency missing'],
          warnings: [],
        },
      }),
    });

    expect(view.compatibility.overall).toBe('partial');
    expect(view.counts.compatibilityPassed).toBe(1);
    expect(view.counts.compatibilityTotal).toBe(3);
    expect(view.compatibility.issues).toEqual(['dependency missing']);
  });
});

describe('deriveMarketplaceView — honest unavailable states', () => {
  it('reports unavailable when the gateway rejects the request', () => {
    const view = deriveMarketplaceView({
      success: false,
      error: { message: 'Marketplace service unavailable' },
    });

    expect(view.availability).toBe('unavailable');
    expect(view.unavailableReason).toBe('Marketplace service unavailable');
    expect(view.counts.installedAssets).toBe(0);
    expect(view.assets).toEqual([]);
  });

  it('reports unavailable when no payload arrived', () => {
    const view = deriveMarketplaceView(undefined);
    expect(view.availability).toBe('unavailable');
    expect(view.unavailableReason).not.toBeNull();
  });

  it('drops malformed asset rows instead of rendering placeholder assets', () => {
    const view = deriveMarketplaceView({
      success: true,
      data: snapshot({
        catalog: {
          totalAssets: 3,
          featured: [asset({ id: 'a1' }), { name: 'no id' }, { id: 'x', type: 'prompt_pack' }],
          popular: [],
          recent: [],
          categories: [],
        },
      }),
    });

    expect(view.assets).toHaveLength(1);
    expect(view.assets[0]?.id).toBe('a1');
  });
});

describe('install/uninstall capability', () => {
  it('is declared unavailable with a reason (no simulated persistence)', () => {
    expect(MARKETPLACE_INSTALL_AVAILABLE).toBe(false);
    expect(MARKETPLACE_INSTALL_UNAVAILABLE_REASON).toMatch(/unavailable/i);
  });
});

describe('updatesBadgeText', () => {
  it('returns null when no update is pending', () => {
    expect(updatesBadgeText(0)).toBeNull();
  });

  it('pluralizes honestly', () => {
    expect(updatesBadgeText(1)).toBe('1 update available');
    expect(updatesBadgeText(3)).toBe('3 updates available');
  });
});

// ── Source-integrity guards ────────────────────────────────────────────────
// These read the real page source so a future edit cannot silently reintroduce
// hardcoded marketplace data or a local-only install toggle.
describe('marketplace page source integrity', () => {
  const pageSource = readFileSync(fileURLToPath(new URL('../page.tsx', import.meta.url)), 'utf8');

  it('does not carry a hardcoded asset list', () => {
    expect(pageSource).not.toContain('INITIAL_ASSETS');
    expect(pageSource).not.toMatch(/status:\s*'(Installed|Available)'/);
  });

  it('does not carry fixed stat values or a fabricated update badge', () => {
    expect(pageSource).not.toMatch(/label:\s*'Installed Assets',\s*value:\s*'12'/);
    expect(pageSource).not.toContain('2 Updates Available');
    expect(pageSource).not.toContain("value: '100%'");
  });

  it('drives the screen from the derived view', () => {
    expect(pageSource).toContain('deriveMarketplaceView');
    expect(pageSource).toContain('marketplaceQuery.data');
    expect(pageSource).toContain('MARKETPLACE_INSTALL_UNAVAILABLE_REASON');
  });

  it('does not toggle install state locally', () => {
    expect(pageSource).not.toContain('setAssets');
    expect(pageSource).not.toContain('handleToggleInstall');
    expect(pageSource).toContain('Install unavailable');
  });
});
