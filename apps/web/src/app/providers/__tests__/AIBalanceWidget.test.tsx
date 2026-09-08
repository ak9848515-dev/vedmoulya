// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Balance widget tests
//
// Proves the compact command-center balance card:
//   - ONE aggregated number only: no provider breakdown on the overview;
//   - renders the REAL derived balance (budget − measured usage) with a
//     readable % remaining, progress bar and X/Y token caption;
//   - NEVER fabricates: with no configured budget it shows an honest
//     unavailable state instead of inventing a number;
//   - the card is labelled as the user's monthly token budget — never a
//     provider account balance or free-tier quota;
//   - "View all" opens the detailed usage screen.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AIBalanceWidget, type AIBalanceData } from '../AIBalanceWidget.js';

function balance(overrides: Partial<AIBalanceData>): AIBalanceData {
  return {
    tokensUsed: 600_000,
    tokenBudget: 2_000_000,
    budgetConfigured: true,
    ...overrides,
  };
}

describe('AIBalanceWidget', () => {
  it('renders the aggregated balance: tokens available, % remaining and progress bar', () => {
    render(<AIBalanceWidget balance={balance({})} />);

    expect(screen.getByText('AI Balance')).toBeDefined();
    // 2.0M budget − 0.6M used = 1.4M available → "1.4 million".
    expect(screen.getByText(/1\.4 million/)).toBeDefined();
    expect(screen.getByText('70% remaining')).toBeDefined();
    // X/Y caption: 1.4M / 2.0M tokens remaining.
    expect(screen.getByText(/1\.4M \/ 2\.0M tokens remaining/)).toBeDefined();
    // Progress bar carries the readable percentage.
    const bar = screen.getByRole('progressbar', { name: /monthly token budget remaining/i });
    expect(bar.getAttribute('aria-valuenow')).toBe('70');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('shows an honest unavailable state when no budget is configured (no fabrication)', () => {
    render(
      <AIBalanceWidget
        balance={balance({ budgetConfigured: false, tokenBudget: 0, tokensUsed: 0 })}
      />,
    );

    expect(screen.getByText(/balance unavailable/i)).toBeDefined();
    expect(screen.queryByText(/% remaining/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(/tokens remaining/)).toBeNull();
  });

  it('never presents the balance as a provider account or free-tier quota', () => {
    render(<AIBalanceWidget balance={balance({})} />);

    // Positive labelling: it is the user's monthly token budget.
    expect(screen.getAllByText(/monthly token budget/i).length).toBeGreaterThan(0);
    // Negative: never a provider balance or free-tier claim.
    expect(screen.queryByText(/provider account/i)).toBeNull();
    expect(screen.queryByText(/free tier/i)).toBeNull();
    expect(screen.queryByText(/free tokens/i)).toBeNull();
  });

  it('shows ONE aggregated number — no provider breakdown on the overview', () => {
    render(<AIBalanceWidget balance={balance({})} />);

    // No per-provider rows/names anywhere in this card.
    expect(screen.queryByText(/Gemini|OpenAI|Claude|DeepSeek|Mistral|Groq/i)).toBeNull();
    // Exactly one headline number.
    expect(screen.getAllByText(/million|billion/).length).toBe(1);
  });

  it('triggers the View all action to open the detailed usage screen', () => {
    const onViewAll = vi.fn();
    render(<AIBalanceWidget balance={balance({})} onViewAll={onViewAll} />);

    fireEvent.click(screen.getByRole('button', { name: /view all/i }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });
});
