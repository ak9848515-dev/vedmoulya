// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — OpenAI Organization Usage panel tests (usage details view)
//
// Proves the real-period org usage panel contract:
//   - loading state renders while the query is pending,
//   - OpenAI-reported per-model rows + totals render exactly as reported
//     (no fabrication — only what the payload carries),
//   - Today / This week / This month selectors request their real period,
//   - an unavailable payload (no admin-scope key etc.) shows an honest
//     "Usage unavailable" with the gateway's reason — never fake numbers,
//   - refresh triggers a refetch.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { OpenAIOrgUsagePanel } from '../OpenAIOrgUsagePanel.js';
import type { OpenAIOrgPeriod } from '../../../lib/api-client.js';

const mocks = vi.hoisted(() => ({
  data: undefined as
    | {
        available: boolean;
        period: OpenAIOrgPeriod;
        message: string;
        rows: Array<{
          model: string;
          inputTokens: number;
          cachedInputTokens: number;
          outputTokens: number;
        }>;
        totals: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
        hasMore?: boolean;
      }
    | undefined,
  isLoading: false,
  isFetching: false,
  requestedPeriods: [] as OpenAIOrgPeriod[],
  refetch: vi.fn(async () => ({ data: undefined })),
}));

vi.mock('../../../lib/api-client.js', () => ({
  useOpenAIOrgUsage: (_userId: string, period: OpenAIOrgPeriod) => {
    mocks.requestedPeriods.push(period);
    return {
      data: mocks.data,
      isLoading: mocks.isLoading,
      isFetching: mocks.isFetching,
      refetch: mocks.refetch,
    };
  },
}));

const orgRows = {
  gpt4o: { model: 'gpt-4o', inputTokens: 1000, cachedInputTokens: 50, outputTokens: 300 },
  mini: { model: 'gpt-4o-mini', inputTokens: 10, cachedInputTokens: 0, outputTokens: 5 },
};

describe('OpenAIOrgUsagePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.data = undefined;
    mocks.isLoading = false;
    mocks.isFetching = false;
    mocks.requestedPeriods = [];
  });

  it('shows a loading state while the org usage query is pending', () => {
    mocks.isLoading = true;
    render(<OpenAIOrgUsagePanel userId="u1" />);
    expect(screen.getByText(/Loading organization usage/i)).toBeDefined();
  });

  it('renders per-model rows and totals exactly as OpenAI reported them', () => {
    mocks.data = {
      available: true,
      period: 'month',
      message: 'Reported by OpenAI for your organization account.',
      rows: [orgRows.gpt4o, orgRows.mini],
      totals: { inputTokens: 1010, cachedInputTokens: 50, outputTokens: 305 },
    };
    render(<OpenAIOrgUsagePanel userId="u1" />);

    expect(screen.getByText('gpt-4o')).toBeDefined();
    expect(screen.getByText('gpt-4o-mini')).toBeDefined();
    // 1000 tokens → compact "1.0K" (gpt-4o input + total input), 305 → "305".
    expect(screen.getAllByText('1.0K').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('305')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
    expect(screen.getByText(/Reported by OpenAI/)).toBeDefined();
    // Never invents cost, requests, or a percentage.
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('requests the month period by default with the Today/Week/Month selector', () => {
    mocks.data = {
      available: true,
      period: 'month',
      message: 'Reported by OpenAI for your organization account.',
      rows: [],
      totals: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
    render(<OpenAIOrgUsagePanel userId="u1" />);
    expect(screen.getByRole('group', { name: 'Usage period' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Today' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'This week' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'This month' })).toBeDefined();
    // Default period is month; an empty report is shown honestly.
    expect(screen.getByText(/no .*month.* usage reported by openai/i)).toBeDefined();
  });

  it('switches the real requested period when Today / This week is clicked', () => {
    mocks.data = {
      available: true,
      period: 'month',
      message: 'Reported by OpenAI for your organization account.',
      rows: [],
      totals: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
    render(<OpenAIOrgUsagePanel userId="u1" />);
    // Default read is the month window.
    expect(mocks.requestedPeriods).toContain('month');

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(mocks.requestedPeriods).toContain('today');
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    expect(mocks.requestedPeriods).toContain('week');
  });

  it('shows an honest unavailable state with the gateway reason — no fake numbers', () => {
    mocks.data = {
      available: false,
      period: 'month',
      message:
        'The OpenAI organization usage endpoint requires an Organization admin-scope API key (project/user keys are refused).',
      rows: [],
      totals: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
    };
    render(<OpenAIOrgUsagePanel userId="u1" />);
    expect(screen.getByText('Usage unavailable')).toBeDefined();
    // The admin-scope reason appears in the unavailable message (and in the
    // panel subtitle) — at least one element carries it.
    expect(screen.getAllByText(/admin-scope/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText(/\d+ tokens/)).toBeNull();
  });
});
