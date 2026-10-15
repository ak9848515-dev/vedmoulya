// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers page: query states (regression)
//
// The screen has exactly four honest states for the provider read, and the
// page must show the RIGHT one:
//   loading · the loaded provider list · a loaded-but-empty registry · failure
//
// Two real defects are pinned here:
//
//   D1 — `useAiControlCenter` was called BELOW the loading/error early returns,
//        so the first render that received data ran one hook more than the
//        render before it. React (dev) throws its hook invariant
//        ("Rendered more hooks than during the previous render"), the
//        ErrorBoundary swapped the provider list for its fallback, and the list
//        never appeared (reproduced in a real browser on /providers).
//
//   D2 — the guards were ordered `if (isLoading || !data)` BEFORE `if (isError)`,
//        so a FAILED request rendered the loading state forever: no error and no
//        retry — the "stuck on Loading AI providers…" report. A rejected query
//        (offline, 500, 401 after the refresh attempt) and the gateway's
//        HTTP 200 `{ success: false }` envelope both take that path.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import type {
  ProviderExperienceRowDTO,
  ProviderExperienceViewDTO,
} from '../../../lib/api-client.js';
import type { LocalAiStatus, LocalAiSnapshot } from '../use-local-ai-status.js';

const mocks = vi.hoisted(() => ({
  user: { userId: 'u1', email: 'anya@vedmoulya.com' } as {
    userId: string;
    email: string;
  } | null,
  hydrated: true,
  sessionReady: true,
  /** Whatever the provider read resolves to right now. */
  experience: {
    data: undefined as ProviderExperienceViewDTO | undefined,
    isLoading: true,
    isError: false,
    error: null as Error | null,
  },
  refetch: vi.fn(() => Promise.resolve()),
  runtimeData: undefined as unknown,
  controlCenterData: undefined as unknown,
}));

vi.mock('../../../stores/auth-store.js', () => ({
  useAuthStore: (selector?: (state: unknown) => unknown) =>
    selector ? selector(mocks) : { user: mocks.user, sessionReady: mocks.sessionReady },
  useAuthHydrated: () => mocks.hydrated,
}));

vi.mock('../../../lib/api-client.js', () => ({
  useProviderExperience: (): unknown => ({
    ...mocks.experience,
    refetch: mocks.refetch,
  }),
  useProviderRuntimeStatus: () => ({ data: mocks.runtimeData, isLoading: false, isError: false }),
  useSetProviderEnabled: () => ({ mutateAsync: vi.fn() }),
  useSetProviderPreferences: () => ({ mutateAsync: vi.fn() }),
  useProviderUsageDetail: () => ({ data: undefined, isLoading: true, isError: false }),
  useRecordLocalAiUsage: () => ({ mutate: vi.fn() }),
  // A real tRPC query hook CONSUMES React hooks. The stand-in below does too,
  // so a call site placed below an early return is detected by React instead of
  // silently passing because the double happened to call no hooks.
  useAiControlCenter: (): unknown => ({
    data: useStandInQuery(mocks.controlCenterData),
  }),
  // The Advanced section's provider-usage ingest note (deployment-scoped). It
  // renders nothing without data, so the double mirrors an unloaded query.
  useProviderUsageIngestStatus: (): unknown => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../../components/SignInRedirect.js', () => ({
  SignInRedirect: () => React.createElement('div', { 'data-testid': 'sign-in-redirect' }),
}));

// The page resolves a reference FX rate on mount; the list does not need one,
// so keep the test off the network.
vi.mock('@vedmoulya/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vedmoulya/shared')>();
  return { ...actual, fetchUsdToInrReferenceRate: () => Promise.resolve(undefined) };
});

// The Local AI controller probes the local agent; it is not part of this read.
vi.mock('../use-local-ai-status.js', () => ({
  useLocalAiStatus: (): LocalAiStatus => ({
    check: null,
    report: null,
    selectedModelId: '',
    setSelectedModelId: vi.fn(),
    checking: false,
    connecting: false,
    agentReachable: false,
    snapshot: {
      agentReachable: false,
      checking: false,
      connecting: false,
      state: null,
      connected: false,
      label: 'Not connected',
      tone: 'neutral',
      message: 'Local Agent is not reachable.',
      runtimeName: null,
      modelId: null,
      failure: null,
    } satisfies LocalAiSnapshot,
    refresh: vi.fn(() => Promise.resolve()),
    connect: vi.fn(() => Promise.resolve()),
    failure: null,
    connected: false,
  }),
}));

/**
 * Stand-in for a tRPC query hook. It consumes React state exactly like the
 * real `useQuery` does, so a hook call placed BELOW an early return is a real
 * hook-order violation here — not a no-op that the test would miss.
 */
function useStandInQuery<T>(value: T): T {
  const [first] = React.useState(value);
  return first;
}

const ProvidersPage = (await import('../page.js')).default;

// ── Fixtures (real DTO shape) ───────────────────────────────────────────────

function row(
  overrides: Partial<ProviderExperienceRowDTO> & { providerId: string; family: string },
): ProviderExperienceRowDTO {
  return {
    name: overrides.providerId,
    credentialSource: 'NONE',
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
    credentialSource: 'USER',
    selectedModel: { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  }),
  row({ providerId: 'openai', family: 'openai', name: 'OpenAI' }),
];

function view(providers: ProviderExperienceRowDTO[]): ProviderExperienceViewDTO {
  return {
    providers,
    usage: {
      totals: { aiCalls: 0, tokensInput: 0, tokensOutput: 0, tokensTotal: 0, costUsd: 0 },
      byProvider: [],
    },
    preferences: { preferredProviderId: 'google', disabledProviderIds: [] },
  } as unknown as ProviderExperienceViewDTO;
}

function setExperience(
  next: Partial<typeof mocks.experience> & { data?: ProviderExperienceViewDTO | undefined },
): void {
  mocks.experience = {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...next,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { userId: 'u1', email: 'anya@vedmoulya.com' };
  mocks.hydrated = true;
  mocks.sessionReady = true;
  setExperience({ isLoading: true });
});

afterEach(() => {
  cleanup();
});

// ── States ──────────────────────────────────────────────────────────────────

describe('AI Providers page — provider read states', () => {
  it('shows the loading state while the provider read is in flight', () => {
    setExperience({ isLoading: true });
    render(<ProvidersPage />);

    expect(screen.getByText('Loading AI providers...')).toBeDefined();
    expect(screen.queryByText(/Unable to load AI providers/)).toBeNull();
  });

  it('renders the provider list once the read succeeds', () => {
    setExperience({ data: view(PROVIDERS) });
    render(<ProvidersPage />);

    expect(screen.getByTestId('primary-provider-google')).toBeDefined();
    expect(screen.getByTestId('provider-card-openai')).toBeDefined();
    expect(screen.queryByText('Loading AI providers...')).toBeNull();
  });

  it('renders the empty state for a loaded-but-empty registry', () => {
    setExperience({ data: view([]) });
    render(<ProvidersPage />);

    expect(screen.getByText(/No AI connected yet/)).toBeDefined();
    expect(screen.queryByText('Loading AI providers...')).toBeNull();
  });

  it('shows an actionable error — never the loading state — when the read fails', () => {
    setExperience({ isError: true, error: new Error('gateway is unreachable') });
    render(<ProvidersPage />);

    expect(screen.getByText(/Unable to load AI providers/)).toBeDefined();
    // The gateway's own reason is surfaced, not a generic shrug.
    expect(screen.getByText(/gateway is unreachable/)).toBeDefined();
    // The failure must NOT be disguised as loading.
    expect(screen.queryByText('Loading AI providers...')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(mocks.refetch).toHaveBeenCalled();
  });
});

// ── D1 — the loading → data transition ──────────────────────────────────────

describe('AI Providers page — loading → data transition (D1)', () => {
  it('keeps the provider list on the first render that receives data', () => {
    setExperience({ isLoading: true });
    const { rerender } = render(<ProvidersPage />);
    expect(screen.getByText('Loading AI providers...')).toBeDefined();

    // The read resolves: the NEXT render must run the same hook order.
    setExperience({ data: view(PROVIDERS) });
    rerender(<ProvidersPage />);

    expect(screen.getByTestId('primary-provider-google')).toBeDefined();
    // The hook-order violation used to hand the whole list to the boundary.
    expect(screen.queryByText(/Unable to load ai-providers/)).toBeNull();
  });
});
