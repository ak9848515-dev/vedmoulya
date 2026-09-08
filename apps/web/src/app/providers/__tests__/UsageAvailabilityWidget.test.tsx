// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Usage & Availability widget tests
//
// Proves the compact command-center widget renders REAL state truthfully:
//   - per-provider usage rows (available / warning / limited / unavailable /
//     not configured / unmetered),
//   - readiness summary counts,
//   - refresh + last-updated + View details actions,
//   - NO fabricated values: when quota is missing the UI says so,
//   - a broken provider row never breaks the whole widget,
//   - the readiness legend explains the three colours in words.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  UsageAvailabilityWidget,
  ReadinessLegend,
  type UsageWidgetRow,
  type UsageWidgetSummary,
} from '../UsageAvailabilityWidget.js';
import { providerReadiness, PROVIDER_QUOTA_DISCLAIMER } from '../provider-readiness.js';

function row(overrides: Partial<UsageWidgetRow>): UsageWidgetRow {
  return {
    providerId: 'google',
    name: 'Gemini',
    readiness: providerReadiness('CONFIGURED', true),
    quotaUsedPercent: 30,
    ...overrides,
  };
}

const defaultRows: UsageWidgetRow[] = [
  row({ providerId: 'google', name: 'Gemini', quotaUsedPercent: 30 }),
  row({
    providerId: 'openai',
    name: 'OpenAI',
    readiness: providerReadiness('NOT_CONFIGURED', true),
    quotaUsedPercent: 0,
  }),
  row({ providerId: 'deepseek', name: 'DeepSeek', quotaUsedPercent: 0 }),
];

const summary: UsageWidgetSummary = { ready: 1, attention: 0, notConfigured: 1 };

describe('UsageAvailabilityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the widget title', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('AI Usage & Availability')).toBeDefined();
  });

  it('shows the reported quota labelled as provider-level usage — never a free balance', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('Provider usage · 70% remaining')).toBeDefined();
    // Every percentage is explicitly scoped as provider-level: no bare
    // "X% remaining" chip and no free-token claim exists anywhere.
    expect(screen.queryByText(/^\d+% remaining$/)).toBeNull();
    expect(screen.queryByText(/^Free tokens/i)).toBeNull();
  });

  it('never fabricates a percent when quota is not reported', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    const unavailable = screen.getAllByText('Usage unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    expect(screen.queryByText(/^\d+% remaining$/)).toBeNull();
  });

  it('shows the honest provider-level disclaimer when percentages appear', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.getByText(PROVIDER_QUOTA_DISCLAIMER)).toBeDefined();
  });

  it('hides the provider-level disclaimer when no percentage is shown', () => {
    const rows: UsageWidgetRow[] = [
      row({
        providerId: 'ollama',
        name: 'Ollama',
        readiness: providerReadiness('CONFIGURED', true),
        quotaUsedPercent: 0,
        local: true,
      }),
      row({
        providerId: 'openai',
        name: 'OpenAI',
        readiness: providerReadiness('NOT_CONFIGURED', true),
        quotaUsedPercent: 0,
      }),
      row({ providerId: 'deepseek', name: 'DeepSeek', quotaUsedPercent: 0 }),
    ];
    render(<UsageAvailabilityWidget rows={rows} summary={summary} updatedAt={null} />);
    expect(screen.queryByText(/provider-health quota signal/)).toBeNull();
  });

  it('shows "Not configured" for providers that cannot operate', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.getAllByText('Not configured').length).toBeGreaterThan(0);
  });

  it('shows warning and limited states from real quota values, always labelled provider-level', () => {
    const rows: UsageWidgetRow[] = [
      row({ providerId: 'a', name: 'Provider A', quotaUsedPercent: 70 }),
      row({ providerId: 'b', name: 'Provider B', quotaUsedPercent: 88 }),
    ];
    render(<UsageAvailabilityWidget rows={rows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('Provider usage · 30% remaining')).toBeDefined(); // warning
    expect(screen.getByText('Provider usage · 12% remaining')).toBeDefined(); // limited
  });

  it('treats local providers as unmetered', () => {
    const rows: UsageWidgetRow[] = [
      row({
        providerId: 'ollama',
        name: 'Ollama',
        readiness: providerReadiness('CONFIGURED', true),
        quotaUsedPercent: 0,
        local: true,
      }),
    ];
    render(<UsageAvailabilityWidget rows={rows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('Local')).toBeDefined();
  });

  it('isolates a broken row instead of failing the whole widget', () => {
    const rows: UsageWidgetRow[] = [
      row({ providerId: 'ok', name: 'Fine', quotaUsedPercent: 45 }),
      {
        providerId: 'bad',
        name: 'Broken',
        readiness: { key: 'green', label: 'Configured and enabled' },
        quotaUsedPercent: NaN,
      },
    ];
    render(<UsageAvailabilityWidget rows={rows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('Provider usage · 55% remaining')).toBeDefined();
    expect(screen.getByText('Usage unavailable')).toBeDefined();
  });

  it('renders the readiness summary counts', () => {
    const s: UsageWidgetSummary = { ready: 3, attention: 1, notConfigured: 2 };
    render(<UsageAvailabilityWidget rows={defaultRows} summary={s} updatedAt={null} />);
    expect(screen.getByText('3 ready · 1 need attention · 2 not configured')).toBeDefined();
  });

  it('shows "Not refreshed yet" before the first fetch', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.getByText('Not refreshed yet')).toBeDefined();
  });

  it('shows an honest recency label after refresh', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={new Date()} />);
    expect(screen.getByText('Updated just now')).toBeDefined();
  });

  it('calls onRefresh when the refresh action is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <UsageAvailabilityWidget
        rows={defaultRows}
        summary={summary}
        updatedAt={new Date()}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByLabelText('Refresh usage'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls onViewDetails when View details is clicked', () => {
    const onViewDetails = vi.fn();
    render(
      <UsageAvailabilityWidget
        rows={defaultRows}
        summary={summary}
        updatedAt={null}
        onViewDetails={onViewDetails}
      />,
    );
    fireEvent.click(screen.getByText('View details'));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('hides the refresh and details actions when no handlers are wired', () => {
    render(<UsageAvailabilityWidget rows={defaultRows} summary={summary} updatedAt={null} />);
    expect(screen.queryByLabelText('Refresh usage')).toBeNull();
    expect(screen.queryByText('View details')).toBeNull();
  });
});

describe('ReadinessLegend', () => {
  it('explains the three readiness colours in words', () => {
    render(<ReadinessLegend />);
    expect(screen.getByText('Not configured')).toBeDefined();
    expect(screen.getByText('Configured, not enabled')).toBeDefined();
    expect(screen.getByText('Configured and enabled')).toBeDefined();
    expect(screen.getByText('— Configure to use')).toBeDefined();
    expect(screen.getByText('— Ready to enable')).toBeDefined();
    expect(screen.getByText('— Ready to use')).toBeDefined();
  });
});
