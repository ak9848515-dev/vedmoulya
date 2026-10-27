// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace page render test (2026-10-26 integrity repair)
//
// Proves at the DOM level that the screen shows the counts the gateway actually
// returned, that install controls are disabled (no install API exists), and
// that an empty snapshot renders an honest empty state instead of demo assets.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  marketplace: undefined as unknown,
  isLoading: false,
  isError: false,
  error: undefined as unknown,
  refetch: vi.fn(),
}));

vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) => {
    const state = { user: { userId: 'u1' }, sessionReady: true };
    return selector ? selector(state) : state;
  },
  useAuthHydrated: () => true,
}));

vi.mock('../../../stores/navigation-store.js', () => ({
  useNavigationStore: () => ({
    setActiveSection: vi.fn(),
    setBreadcrumbs: vi.fn(),
  }),
}));

vi.mock('../../ai/_components/AIContextBar.js', () => ({
  AIContextBar: () => React.createElement('div', { 'data-testid': 'ai-context-bar' }),
}));

vi.mock('../../../lib/api-client.js', () => ({
  useMarketplace: () => ({
    data: mocks.marketplace,
    isLoading: mocks.isLoading,
    isError: mocks.isError,
    error: mocks.error,
    refetch: mocks.refetch,
  }),
}));

import MarketplacePage from '../page.js';

function asset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'a1',
    name: 'Prompt Pack: Executive',
    type: 'prompt_pack',
    version: '2.1.0',
    isInstalled: false,
    isActive: false,
    ...overrides,
  };
}

/** Text of the stat card that carries `label` (first match: the stat grid is
 *  rendered above the tab panels, which reuse some of the same labels). */
function statText(label: string): string {
  const [labelEl] = screen.getAllByText(label);
  return labelEl?.parentElement?.textContent ?? '';
}

describe('Marketplace page — backend-derived rendering', () => {
  beforeEach(() => {
    mocks.isLoading = false;
    mocks.isError = false;
    mocks.error = undefined;
  });

  it('shows the counts the gateway returned, not the old fixed numbers', () => {
    mocks.marketplace = {
      success: true,
      data: {
        catalog: {
          totalAssets: 2,
          featured: [asset({ id: 'a1', isInstalled: true })],
          popular: [
            asset({ id: 'a2', name: 'Workflow: Weekly Review', type: 'workflow_template' }),
          ],
          recent: [],
          categories: [],
        },
        installedAssets: [asset({ id: 'a1', isInstalled: true, isActive: true })],
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
      },
    };

    render(React.createElement(MarketplacePage));

    expect(statText('Installed Assets')).toContain('1');
    expect(statText('Installed Assets')).not.toContain('12');
    expect(statText('AI Providers')).toContain('1');
    expect(statText('Updates')).toContain('1');
    expect(statText('Templates')).toContain('1');
    expect(statText('Compatibility')).toContain('1/1');

    // The update badge is derived, and pluralized from the real count.
    expect(screen.getByText('1 update available')).toBeInTheDocument();
    // Real catalog rows are rendered.
    expect(screen.getByText('Prompt Pack: Executive')).toBeInTheDocument();
    expect(screen.getByText('Workflow: Weekly Review')).toBeInTheDocument();
  });

  it('renders install as unavailable instead of simulating an install', () => {
    mocks.marketplace = {
      success: true,
      data: {
        catalog: { totalAssets: 1, featured: [asset()], popular: [], recent: [], categories: [] },
        installedAssets: [],
        availableUpdates: [],
        providers: [],
        compatibility: {
          overall: 'unknown',
          platformVersion: null,
          checks: [],
          issues: [],
          warnings: [],
        },
      },
    };

    render(React.createElement(MarketplacePage));

    const installButtons = screen.getAllByRole('button', { name: /install unavailable/i });
    expect(installButtons.length).toBe(1);
    expect(installButtons[0]).toBeDisabled();
    expect(screen.getByText(/no marketplace install\/uninstall mutation/i)).toBeInTheDocument();
  });

  it('states that the catalog is empty when the backend returns nothing', () => {
    mocks.marketplace = {
      success: true,
      data: {
        catalog: { totalAssets: 0, featured: [], popular: [], recent: [], categories: [] },
        installedAssets: [],
        availableUpdates: [],
        providers: [],
        compatibility: {
          overall: 'unknown',
          platformVersion: null,
          checks: [],
          issues: [],
          warnings: [],
        },
      },
    };

    render(React.createElement(MarketplacePage));

    expect(screen.getByText('The catalog is empty.')).toBeInTheDocument();
    expect(screen.queryByText('Prompt Pack: Executive')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /install unavailable/i })).not.toBeInTheDocument();
  });

  it('surfaces a gateway rejection instead of showing zeros as success', () => {
    mocks.marketplace = { success: false, error: { message: 'Marketplace service unavailable' } };

    render(React.createElement(MarketplacePage));

    expect(screen.getByText('Marketplace data is unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Marketplace service unavailable')).toBeInTheDocument();
  });

  it('surfaces a transport error with a retry action', () => {
    mocks.isError = true;
    mocks.error = new Error('network down');
    mocks.marketplace = undefined;

    render(React.createElement(MarketplacePage));

    expect(screen.getByText('The marketplace snapshot could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
