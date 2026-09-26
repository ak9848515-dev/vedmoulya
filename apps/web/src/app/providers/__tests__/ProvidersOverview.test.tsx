// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers overview tests (Screen 1)
// AI PROVIDER UX SIMPLIFICATION
//
// Proves the acceptance criteria of the simplified list:
//   - the provider VedMoulya currently uses is immediately obvious,
//   - every card shows provider + model + connection status,
//   - no infrastructure is exposed (endpoint / protocol / token limits),
//   - "+ Add AI" lists the REAL provider registry (+ Custom AI),
//   - enable/disable, primary selection and details stay reachable.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ProvidersOverview, effectiveRuntimeStatus } from '../ProvidersOverview.js';
import type { ProviderExperienceRowDTO, ProviderRuntimeStateDTO } from '../../../lib/api-client.js';
import type { LocalAiStatus, LocalAiSnapshot } from '../use-local-ai-status.js';

// PROVIDER-UX — a user-supplied (USER) credential makes a family usable even
// though the deployment runtime registry reports NOT_CONFIGURED for it.
describe('effectiveRuntimeStatus (PROVIDER-01)', () => {
  it('treats a USER-connected family as CONFIGURED despite a NOT_CONFIGURED runtime', () => {
    expect(effectiveRuntimeStatus({ credentialSource: 'USER' }, 'NOT_CONFIGURED')).toBe(
      'CONFIGURED',
    );
    expect(effectiveRuntimeStatus({ credentialSource: 'USER' }, undefined)).toBe('CONFIGURED');
  });

  it('never upgrades a family without a user credential', () => {
    expect(effectiveRuntimeStatus({ credentialSource: 'NONE' }, 'NOT_CONFIGURED')).toBe(
      'NOT_CONFIGURED',
    );
    expect(effectiveRuntimeStatus({}, 'NOT_CONFIGURED')).toBe('NOT_CONFIGURED');
    expect(effectiveRuntimeStatus({ credentialSource: 'PLATFORM' }, 'NOT_CONFIGURED')).toBe(
      'NOT_CONFIGURED',
    );
  });

  it('passes through genuinely failing or configured runtimes untouched', () => {
    expect(effectiveRuntimeStatus({ credentialSource: 'USER' }, 'ERROR')).toBe('ERROR');
    expect(effectiveRuntimeStatus({ credentialSource: 'USER' }, 'MOCK')).toBe('MOCK');
    expect(effectiveRuntimeStatus({ credentialSource: 'USER' }, 'CONFIGURED')).toBe('CONFIGURED');
  });
});

vi.mock('../../../lib/trpc.js', () => ({
  api: {
    providers: {
      testConnection: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      registerProvider: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

function row(
  overrides: Partial<ProviderExperienceRowDTO> & { providerId: string; family: string },
): ProviderExperienceRowDTO {
  return {
    name: overrides.providerId,
    selectedModel: null,
    models: [],
    availability: 'AVAILABLE',
    enabled: true,
    resourceType: 'FREE_API_QUOTA',
    freeToUse: true,
    health: { status: 'healthy', score: 1, latencyMs: 100, quotaUsedPercent: 0 },
    lifecycleStatus: 'active',
    ...overrides,
  };
}

const PROVIDERS: ProviderExperienceRowDTO[] = [
  row({
    providerId: 'google',
    family: 'google',
    name: 'Google (Gemini)',
    selectedModel: { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  }),
  row({
    providerId: 'openai',
    family: 'openai',
    name: 'OpenAI',
    enabled: false,
    selectedModel: { id: 'gpt-4o', name: 'GPT-4o' },
  }),
  row({
    providerId: 'anthropic',
    family: 'anthropic',
    name: 'Anthropic (Claude)',
    selectedModel: { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
  }),
];

const RUNTIME = new Map<string, ProviderRuntimeStateDTO>(
  (
    [
      ['google', 'CONFIGURED'],
      ['openai', 'CONFIGURED'],
      ['anthropic', 'UNSUPPORTED_RUNTIME'],
    ] as const
  ).map(([family, status]) => [
    family,
    {
      family,
      name: family,
      status,
      reason: '',
      adapterImplemented: status === 'CONFIGURED',
      registered: status === 'CONFIGURED',
      canExecute: status === 'CONFIGURED',
      freeTier: true,
      defaultEligible: true,
      envKeys: [],
    },
  ]),
);

function renderOverview(
  overrides: {
    addAIOpen?: boolean;
    providers?: ProviderExperienceRowDTO[];
    preferredProviderId?: string;
    localAi?: LocalAiStatus;
  } = {},
) {
  const onConfigure = vi.fn();
  const onOpenDetails = vi.fn();
  const onToggle = vi.fn();
  const onSetPrimary = vi.fn();
  const onRefresh = vi.fn();
  const onAddAIOpenChange = vi.fn();
  render(
    <ProvidersOverview
      userId="u1"
      providers={overrides.providers ?? PROVIDERS}
      runtimeByFamily={RUNTIME}
      preferences={{
        ...(overrides.preferredProviderId !== undefined
          ? { preferredProviderId: overrides.preferredProviderId }
          : {}),
        disabledProviderIds: ['openai'],
      }}
      updatingProviderId={null}
      onConfigure={onConfigure}
      onOpenDetails={onOpenDetails}
      onToggle={onToggle}
      onSetPrimary={onSetPrimary}
      onRefresh={onRefresh}
      addAIOpen={overrides.addAIOpen ?? false}
      onAddAIOpenChange={onAddAIOpenChange}
      {...(overrides.localAi !== undefined ? { localAi: overrides.localAi } : {})}
    />,
  );
  return {
    onConfigure,
    onOpenDetails,
    onToggle,
    onSetPrimary,
    onRefresh,
    onAddAIOpenChange,
  };
}

describe('ProvidersOverview (simplified AI Providers screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('features the provider VedMoulya is currently using, with model and status', () => {
    renderOverview();

    const primary = screen.getByTestId('primary-provider-google');
    expect(primary.textContent).toMatch(/Gemini/);
    expect(primary.textContent).toMatch(/Google/);
    expect(primary.textContent).toMatch(/Gemini 2.5 Flash/);
    expect(primary.textContent).toMatch(/✓Connected/);
    expect(primary.textContent).toMatch(/ACTIVE/);
  });

  it('lists the other AIs as compact cards with their own model and status', () => {
    renderOverview();

    const openai = screen.getByTestId('provider-card-openai');
    expect(openai.textContent).toMatch(/OpenAI/);
    expect(openai.textContent).toMatch(/GPT-4o/);
    // PROVIDER-01 — OpenAI is CONFIGURED in this fixture but switched OFF.
    // A provider that cannot be used must never read "Connected": the card
    // says it is not connected and explains why (configured ≠ connected).
    expect(openai.textContent).toMatch(/○Not connected/);
    expect(openai.textContent).not.toMatch(/✓Connected/);
    expect(openai.textContent).toMatch(/turned off/i);
    expect(within(openai).getByRole('button', { name: /configure openai/i })).toBeDefined();

    const claude = screen.getByTestId('provider-card-anthropic');
    expect(claude.textContent).toMatch(/Claude/);
    expect(claude.textContent).toMatch(/○Not connected/);
  });

  it('reads Connected for a family the user connected with their OWN credential', () => {
    // The deployment runtime registry says google is NOT_CONFIGURED (no env key),
    // but the user holds a verified key for it: the card must read Connected and
    // ACTIVE — never "Not connected" — once it is switched on.
    const runtimeNoGoogleKey = new Map<string, ProviderRuntimeStateDTO>(RUNTIME);
    runtimeNoGoogleKey.set('google', {
      family: 'google',
      name: 'google',
      status: 'NOT_CONFIGURED',
      reason: 'No key set (AI_GOOGLE_API_KEY)',
      adapterImplemented: true,
      registered: false,
      canExecute: true,
      freeTier: true,
      defaultEligible: true,
      envKeys: ['AI_GOOGLE_API_KEY'],
    });

    render(
      <ProvidersOverview
        userId="u1"
        providers={PROVIDERS.map((p) =>
          p.providerId === 'google' ? { ...p, credentialSource: 'USER' as const } : p,
        )}
        runtimeByFamily={runtimeNoGoogleKey}
        preferences={{ disabledProviderIds: ['openai'] }}
        updatingProviderId={null}
        onConfigure={vi.fn()}
        onOpenDetails={vi.fn()}
        onToggle={vi.fn()}
        onSetPrimary={vi.fn()}
        onRefresh={vi.fn()}
        addAIOpen={false}
        onAddAIOpenChange={vi.fn()}
      />,
    );

    const primary = screen.getByTestId('primary-provider-google');
    expect(primary.textContent).toMatch(/Connected/);
    expect(primary.textContent).not.toMatch(/Not connected/);
    expect(primary.textContent).toMatch(/ACTIVE/);
  });

  it('reads Connected for a configured, switched-on AI that is not the primary', () => {
    renderOverview({
      providers: PROVIDERS.map((provider) =>
        provider.providerId === 'openai' ? { ...provider, enabled: true } : provider,
      ),
    });

    const openai = screen.getByTestId('provider-card-openai');
    expect(openai.textContent).toMatch(/✓Connected/);
    expect(openai.textContent).toMatch(/GPT-4o/);
    expect(openai.textContent).not.toMatch(/turned off/i);
  });

  it('shows a configured-but-disabled AI as Not connected while still enabling it', () => {
    renderOverview();

    const openai = screen.getByTestId('provider-card-openai');
    // The user can still turn it back on — "not connected" here means
    // "switched off", not "nothing is configured".
    expect(openai.textContent).toMatch(/Not connected/);
    expect(openai.textContent).not.toMatch(/ACTIVE/);
    expect(within(openai).getByRole('button', { name: /configure openai/i })).toBeDefined();
  });

  it('never exposes infrastructure on the cards', () => {
    renderOverview();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/endpoint/i);
    expect(text).not.toMatch(/protocol/i);
    expect(text).not.toMatch(/token limit|context window/i);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('opens the configuration experience from Configure', () => {
    const { onConfigure } = renderOverview();
    fireEvent.click(screen.getByRole('button', { name: /configure claude/i }));
    expect(onConfigure).toHaveBeenCalledWith('anthropic');
  });

  it('keeps enable/disable, primary selection and details reachable from the ⋮ menu', () => {
    const { onToggle, onSetPrimary, onOpenDetails } = renderOverview();

    fireEvent.click(screen.getByRole('button', { name: /more actions for gemini/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Turn off for now' }));
    expect(onToggle).toHaveBeenCalledWith('google', false);

    fireEvent.click(screen.getByRole('button', { name: /more actions for claude/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Use as primary AI' }));
    expect(onSetPrimary).toHaveBeenCalledWith('anthropic');

    fireEvent.click(screen.getByRole('button', { name: /more actions for openai/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Provider details' }));
    expect(onOpenDetails).toHaveBeenCalledWith('openai');
  });

  it('keeps an unavailable action reachable, explains why, and does nothing when used', async () => {
    const { onSetPrimary } = renderOverview();

    fireEvent.click(screen.getByRole('button', { name: /more actions for gemini/i }));
    // Gemini is already the primary AI: the item stays focusable and announces
    // the reason instead of being silently unavailable.
    const primaryItem = await screen.findByRole(
      'menuitem',
      { name: /Primary AI/ },
      { timeout: 5000 },
    );
    expect(primaryItem.getAttribute('aria-disabled')).toBe('true');
    // The unavailable action explains itself synchronously and for the
    // accessibility tree — the reason is real text, not a tooltip only.
    expect(primaryItem.textContent).toMatch(/already the primary ai/i);

    fireEvent.click(primaryItem);
    expect(onSetPrimary).not.toHaveBeenCalled();
    // The menu stays open so another action can be chosen.
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
  });

  it('keeps the server-enforced switch invariant visible in the menu', () => {
    const { onToggle } = renderOverview();

    // openai is disabled → the action turns it back on (never a fake success).
    fireEvent.click(screen.getByRole('button', { name: /more actions for openai/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Use this AI' }));
    expect(onToggle).toHaveBeenCalledWith('openai', true);
  });

  it('offers the registry providers and Custom AI in the Add AI dialog', async () => {
    const { onConfigure } = renderOverview({ addAIOpen: true });

    // The dialog (and the custom-provider form it embeds) loads on demand, so
    // this assertion waits for the lazy chunk under a generous budget.
    expect(
      await screen.findByText('Connect an AI to VedMoulya', {}, { timeout: 5000 }),
    ).toBeDefined();
    // Real registry entries with their true connection state.
    expect(screen.getByTestId('add-ai-option-google').textContent).toMatch(/✓ Connected/);
    expect(screen.getByTestId('add-ai-option-openai').textContent).toMatch(/✓ Connected/);
    expect(screen.getByTestId('add-ai-option-anthropic').textContent).toMatch(/○ Not connected/);
    expect(screen.getByTestId('add-ai-custom')).toBeDefined();

    fireEvent.click(screen.getByTestId('add-ai-option-anthropic'));
    expect(onConfigure).toHaveBeenCalledWith('anthropic');
  });

  it('shows an inviting empty state with a working Add AI action', async () => {
    const { onAddAIOpenChange } = renderOverview({ providers: [] });
    expect(screen.getByText(/No AI connected yet/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add AI' }));
    expect(onAddAIOpenChange).toHaveBeenCalledWith(true);
  });

  it('explains an empty registry instead of claiming it is still loading', async () => {
    renderOverview({ providers: [], addAIOpen: true });

    expect(await screen.findByTestId('add-ai-registry-empty', {}, { timeout: 5000 })).toBeDefined();
    expect(screen.getByText(/has not been seeded yet/i)).toBeDefined();
    // The misleading "still loading" copy must not appear for an empty registry.
    expect(screen.queryByText(/still loading its provider registry/i)).toBeNull();
  });

  it('walks the ⋮ menu with the keyboard and returns focus on Escape', async () => {
    renderOverview();
    const trigger = screen.getByRole('button', { name: /more actions for gemini/i });
    fireEvent.click(trigger);

    // Every item is part of the roving focus order — including the one that is
    // unavailable (Gemini is already the primary AI), so keyboard users can
    // reach it and hear why it cannot be used.
    const items = await screen.findAllByRole('menuitem', {}, { timeout: 5000 });
    expect(items.length).toBeGreaterThan(1);
    const last = items.length - 1;

    // Opening the menu focuses the first item.
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(items[last]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    // Wraps to the first item.
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[last]);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });
});

// ── Local AI on the overview cards ─────────────────────────────────────────
describe('ProvidersOverview — Local AI card', () => {
  function stubLocalAi(snapshot: Partial<LocalAiSnapshot>): LocalAiStatus {
    const merged: LocalAiSnapshot = {
      agentReachable: true,
      checking: false,
      connecting: false,
      state: 'OLLAMA_CONNECTED',
      label: 'Connected',
      tone: 'ok',
      message: 'Ollama answered on qwen2.5-coder:3b.',
      runtimeName: 'Ollama',
      modelId: 'qwen2.5-coder:3b',
      ...snapshot,
    };
    return {
      check: null,
      report: null,
      selectedModelId: merged.modelId ?? '',
      setSelectedModelId: vi.fn(),
      checking: merged.checking,
      connecting: merged.connecting,
      agentReachable: merged.agentReachable,
      snapshot: merged,
      refresh: vi.fn(() => Promise.resolve()),
      connect: vi.fn(() => Promise.resolve()),
    };
  }

  it('renders the shared Local AI live state among the provider cards', () => {
    renderOverview({ localAi: stubLocalAi({}) });
    expect(screen.getByTestId('local-ai-overview-card')).toBeTruthy();
    expect(screen.getByTestId('local-ai-overview-connection').textContent).toBe('Connected');
    expect(screen.getByTestId('local-ai-overview-model').textContent).toBe('qwen2.5-coder:3b');
  });

  it('renders nothing extra when no Local AI controller is supplied', () => {
    renderOverview();
    expect(screen.queryByTestId('local-ai-overview-card')).toBeNull();
  });
});
