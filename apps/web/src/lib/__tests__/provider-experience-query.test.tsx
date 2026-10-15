// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — providers.getExperience query envelope (regression)
//
// The gateway answers a SERVICE failure with HTTP 200 + `{ success: false }`,
// so tRPC's `isError` never fires for it. `unwrap()` alone then produced
// `data: undefined` with no error, and the AI Providers screen rendered its
// loading state forever (the "stuck on Loading AI providers…" report). The
// hook now translates that envelope into a real error state carrying the
// gateway's own reason — the same rule `guardMutation` already applies to
// mutations, and nothing is fabricated when the read fails.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  query: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock('../trpc.js', () => ({
  api: {
    providers: {
      getExperience: { useQuery: () => mocks.query },
    },
  },
}));

const { useProviderExperience } = await import('../api-client.js');

const VIEW = { providers: [], preferences: { disabledProviderIds: [] } };

beforeEach(() => {
  mocks.query = {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
});

describe('useProviderExperience — gateway envelopes', () => {
  it('unwraps a successful envelope into the view model', () => {
    mocks.query = { ...mocks.query, data: { success: true, data: VIEW } };

    const { result } = renderHook(() => useProviderExperience('u1'));

    expect(result.current.data).toEqual(VIEW);
    expect(result.current.isError).toBe(false);
  });

  it('surfaces a { success: false } envelope as a visible error with its reason', () => {
    mocks.query = {
      ...mocks.query,
      data: { success: false, error: { message: 'Unable to load providers' } },
    };

    const { result } = renderHook(() => useProviderExperience('u1'));

    // No data AND an error — never "successful but empty", which the screen
    // would render as an endless loading state.
    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('Unable to load providers');
  });

  it('keeps a rejected query an error and never invents data for it', () => {
    mocks.query = {
      ...mocks.query,
      isError: true,
      error: new Error('gateway is unreachable'),
    };

    const { result } = renderHook(() => useProviderExperience('u1'));

    expect(result.current.data).toBeUndefined();
    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('gateway is unreachable');
  });
});
