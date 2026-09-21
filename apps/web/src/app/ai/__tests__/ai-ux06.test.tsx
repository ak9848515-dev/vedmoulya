// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — UX-06 AI Experience Tests
//
// Pins the AI destination contract:
//   1. loading / auth states
//   2. the status shown is the REAL runtime registry state — "connected" is
//      never claimed just because a provider row exists
//   3. every hub link resolves to a destination the navigation model assigns
//      to AI (the hub is the single front door for those screens)
//   4. Models points at the ONE canonical provider destination (UX-01 forbids a
//      second place to choose the same model)
//   5. no fabricated provider data
//
// No provider credential, spend or execution semantics are exercised here —
// these tests only pin what the hub shows and where it links.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import type { ProviderRuntimeStateDTO } from '../../../lib/api-client.js';
import { destinationForPathname } from '../../../lib/navigation-model.js';
import {
  AI_SECTION_GROUPS,
  AI_SECTIONS,
  AI_TOP_LEVEL_SECTIONS,
  aiOwnershipViolations,
  aiSectionById,
  type AISectionId,
} from '../../../lib/ai-experience.js';
import { AIContextBar } from '../_components/AIContextBar.js';

afterEach(() => {
  cleanup();
});

const mocks = vi.hoisted(() => ({
  user: { userId: 'u1', email: 'anya@vedmoulya.com' } as { userId: string; email: string } | null,
  hydrated: true,
  sessionReady: true,
  statusData: undefined as
    | {
        mode: string;
        defaultProvider: string;
        defaultProviderSupported: boolean;
        providers: ProviderRuntimeStateDTO[];
      }
    | undefined,
  statusLoading: false,
}));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => (selector ? selector(mocks) : mocks),
  useAuthHydrated: () => mocks.hydrated,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useProviderRuntimeStatus: () => ({
    data: mocks.statusData,
    isLoading: mocks.statusLoading,
    isError: false,
  }),
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

const AIPage = (await import('../page.js')).default;

// ── Fixtures (real DTO shape) ───────────────────────────────────────────────

function provider(overrides: Partial<ProviderRuntimeStateDTO> = {}): ProviderRuntimeStateDTO {
  return {
    family: 'gemini',
    name: 'Google Gemini',
    status: 'CONFIGURED',
    reason: '',
    adapterImplemented: true,
    registered: true,
    canExecute: true,
    freeTier: true,
    defaultEligible: true,
    envKeys: [],
    ...overrides,
  };
}

function runtime(providers: ProviderRuntimeStateDTO[]): {
  mode: string;
  defaultProvider: string;
  defaultProviderSupported: boolean;
  providers: ProviderRuntimeStateDTO[];
} {
  return {
    mode: 'production',
    defaultProvider: 'gemini',
    defaultProviderSupported: true,
    providers,
  };
}

function renderAI(): ReturnType<typeof render> {
  return render(React.createElement(AIPage));
}

function statusLabel(): string {
  return screen.getByTestId('ai-status-label').textContent ?? '';
}

// ── 1. loading and auth ─────────────────────────────────────────────────────

describe('UX-06 AI — loading and auth', () => {
  it('shows a loading state before hydration', () => {
    mocks.hydrated = false;
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    renderAI();
    expect(screen.getByText(/Checking your AI/)).toBeDefined();
  });

  it('shows sign-in redirect when not authenticated', () => {
    mocks.hydrated = true;
    mocks.user = null;
    renderAI();
    expect(screen.getByTestId('sign-in-redirect')).toBeDefined();
  });
});

// ── 2. honest status ────────────────────────────────────────────────────────

describe('UX-06 AI — honest status from the real registry', () => {
  it('never claims connected before the runtime answers', () => {
    mocks.hydrated = true;
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = undefined;
    renderAI();
    expect(statusLabel()).toBe('Checking…');
  });

  it('reports connected only for CONFIGURED providers, by real name', () => {
    mocks.statusData = runtime([
      provider({ name: 'Google Gemini', status: 'CONFIGURED' }),
      provider({ family: 'openai', name: 'OpenAI', status: 'ERROR', reason: 'Rejected' }),
    ]);
    renderAI();
    expect(statusLabel()).toBe('Connected');
    expect(screen.getByText(/Google Gemini/)).toBeDefined();
  });

  it('reports needs-attention when the configuration was rejected', () => {
    mocks.statusData = runtime([provider({ status: 'ERROR', reason: 'Rejected' })]);
    renderAI();
    expect(statusLabel()).toBe('Needs attention');
  });

  it('reports not-connected when no provider is configured', () => {
    mocks.statusData = runtime([
      provider({ status: 'UNCONFIGURED' }),
      provider({ family: 'openai', status: 'UNCONFIGURED' }),
    ]);
    renderAI();
    expect(statusLabel()).toBe('Not connected');
    // A known-but-unconfigured row must never be advertised as connected.
    expect(document.body.textContent ?? '').not.toMatch(/AI is ready to run/);
  });

  it('keeps the connection detail out of fabricated wording', () => {
    mocks.statusData = runtime([provider({ status: 'CONFIGURED' })]);
    renderAI();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/99%/);
    expect(text).not.toMatch(/uptime/i);
  });
});

// ── 3. hub links stay inside the AI destination ─────────────────────────────

describe('UX-06 AI — every hub link is owned by AI', () => {
  it('resolves every link route to the AI destination', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();

    const hrefs = Array.from(document.querySelectorAll('a'))
      .map((anchor) => anchor.getAttribute('href'))
      .filter((href): href is string => typeof href === 'string');

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const [pathname] = href.split('?');
      expect(destinationForPathname(pathname ?? '').id, `${href} → ai`).toBe('ai');
    }
  });

  it('links Models at the ONE canonical provider destination', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    const modelsLink = screen.getByText('Models').closest('a');
    expect(modelsLink?.getAttribute('href')).toBe('/providers');
  });

  it('never sends the user to Settings to configure a provider', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.some((href) => (href ?? '').startsWith('/settings'))).toBe(false);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/tab=profile/);
  });
});

// ── 4. the AI hierarchy ─────────────────────────────────────────────────────

describe('UX-06 AI — the landing exposes the whole AI hierarchy', () => {
  it('renders a card for every canonical AI section except the landing itself', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    const carded = AI_SECTIONS.filter((section) => section.id !== 'overview');
    expect(carded.length).toBeGreaterThan(0);
    for (const section of carded) {
      expect(screen.getByTestId(`ai-section-${section.id}`)).toBeDefined();
    }
    // The landing is the overview — advertising a card back to itself is noise.
    expect(screen.queryByTestId('ai-section-overview')).toBeNull();
  });

  it('groups the sections in plain language', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    for (const group of AI_SECTION_GROUPS) {
      expect(screen.getByTestId(`ai-group-${group.id}`)).toBeDefined();
      expect(screen.getByText(group.label)).toBeDefined();
    }
  });

  it('every section card links at its declared route', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    for (const section of AI_SECTIONS.filter((s) => s.id !== 'overview')) {
      const card = screen.getByTestId(`ai-section-${section.id}`);
      expect(card.getAttribute('href'), `${section.id} route`).toBe(section.route);
    }
  });
});

// ── 5. the shared AI context bar ────────────────────────────────────────────

describe('UX-06 AI — sub-experiences declare where they are', () => {
  function renderBar(sectionId: AISectionId): void {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    render(React.createElement(AIContextBar, { sectionId, pageLabel: 'Memory' }));
  }

  it('roots every section at AI and names the current one', () => {
    renderBar('memory');
    const bar = screen.getByTestId('page-context-bar');
    expect(bar.textContent ?? '').toMatch(/AI/);
    expect(bar.textContent ?? '').toMatch(/Memory/);
  });

  it('offers the other AI sections, exactly one marked current', () => {
    renderBar('memory');
    const siblings = screen.getByTestId('ai-context-siblings');
    const anchors = Array.from(siblings.querySelectorAll('a'));
    expect(anchors.length).toBe(AI_TOP_LEVEL_SECTIONS.length);
    const current = anchors.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.length).toBe(1);
    expect(current[0]?.getAttribute('href')).toBe('/memory');
  });

  it('reveals a section\u2019s deeper surfaces without leaving AI', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    render(
      React.createElement(AIContextBar, { sectionId: 'intelligence', pageLabel: 'Intelligence' }),
    );
    const surfaces = aiSectionById('intelligence').surfaces ?? [];
    expect(surfaces.length).toBeGreaterThan(0);
    for (const surface of surfaces) {
      expect(screen.getByText(surface.label)).toBeDefined();
      expect(destinationForPathname(surface.route).id).toBe('ai');
    }
  });

  it('the AI model never advertises a route it does not own', () => {
    expect(aiOwnershipViolations()).toEqual([]);
  });
});

// ── 6. the landing headings ─────────────────────────────────────────────────

describe('UX-06 AI — the landing headings', () => {
  it('shows the real section headings', () => {
    mocks.user = { userId: 'u1', email: 'a@b.com' };
    mocks.statusData = runtime([provider()]);
    renderAI();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Your AI');
    expect(screen.getByRole('heading', { name: 'Explore your AI' })).toBeDefined();
  });
});
