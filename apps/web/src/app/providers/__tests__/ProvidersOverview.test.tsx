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
import { ProvidersOverview } from '../ProvidersOverview.js';
import type { ProviderExperienceRowDTO, ProviderRuntimeStateDTO } from '../../../lib/api-client.js';

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
  } = {},
) {
  const onConfigure = vi.fn();
  const onOpenDetails = vi.fn();
  const onToggle = vi.fn();
  const onSetPrimary = vi.fn();
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
      addAIOpen={overrides.addAIOpen ?? false}
      onAddAIOpenChange={onAddAIOpenChange}
    />,
  );
  return { onConfigure, onOpenDetails, onToggle, onSetPrimary, onAddAIOpenChange };
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
    expect(openai.textContent).toMatch(/✓Connected/);
    expect(within(openai).getByRole('button', { name: /configure openai/i })).toBeDefined();

    const claude = screen.getByTestId('provider-card-anthropic');
    expect(claude.textContent).toMatch(/Claude/);
    expect(claude.textContent).toMatch(/○Not connected/);
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

  it('keeps the server-enforced switch invariant visible in the menu', () => {
    const { onToggle } = renderOverview();

    // openai is disabled → the action turns it back on (never a fake success).
    fireEvent.click(screen.getByRole('button', { name: /more actions for openai/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Use this AI' }));
    expect(onToggle).toHaveBeenCalledWith('openai', true);
  });

  it('offers the registry providers and Custom AI in the Add AI dialog', () => {
    const { onConfigure } = renderOverview({ addAIOpen: true });

    expect(screen.getByText('Connect an AI to VedMoulya')).toBeDefined();
    // Real registry entries with their true connection state.
    expect(screen.getByTestId('add-ai-option-google').textContent).toMatch(/✓ Connected/);
    expect(screen.getByTestId('add-ai-option-openai').textContent).toMatch(/✓ Connected/);
    expect(screen.getByTestId('add-ai-option-anthropic').textContent).toMatch(/○ Not connected/);
    expect(screen.getByTestId('add-ai-custom')).toBeDefined();

    fireEvent.click(screen.getByTestId('add-ai-option-anthropic'));
    expect(onConfigure).toHaveBeenCalledWith('anthropic');
  });

  it('shows an inviting empty state when no AI is connected', () => {
    renderOverview({ providers: [] });
    expect(screen.getByText(/No AI connected yet/i)).toBeDefined();
  });
});
