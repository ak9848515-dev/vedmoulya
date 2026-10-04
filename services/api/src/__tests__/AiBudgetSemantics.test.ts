// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — Budget / Quota semantics tests
// Proves VedMoulya never presents a fabricated balance:
//   • a platform default is NOT presented as a user budget (A-4 migration)
//   • "not configured" stays "not configured"
//   • remaining tokens exist ONLY when a real limit exists
//   • an UNKNOWN provider quota never yields a remaining-token number
//   • local AI is unmetered by cloud quota
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  resolveProviderQuotaView,
  resolveRemainingCapacity,
  resolveUserBudgetView,
} from '../observability/AiBudgetSemantics.js';

describe('resolveUserBudgetView — provenance is never invented', () => {
  it('reports "not configured" when the user never set a budget', () => {
    expect(resolveUserBudgetView({})).toEqual({ period: 'MONTH', source: 'NONE' });
    expect(resolveUserBudgetView({ monthlyTokenBudget: undefined }).source).toBe('NONE');
    expect(resolveUserBudgetView({ monthlyTokenBudget: 0 }).source).toBe('NONE');
  });

  it('treats the legacy 1M default as a PLATFORM ALLOWANCE, never a user budget', () => {
    const view = resolveUserBudgetView({ monthlyTokenBudget: 1_000_000 });
    expect(view.source).toBe('PLATFORM_ALLOWANCE');
    expect(view.amountTokens).toBe(1_000_000);
    expect(view.configuredAt).toBeUndefined();
  });

  it('reports an explicitly configured budget as a USER budget', () => {
    const view = resolveUserBudgetView({
      monthlyTokenBudget: 100_000,
      monthlyTokenBudgetSource: 'USER',
      budgetConfiguredAt: '2026-10-01T00:00:00.000Z',
    });
    expect(view.source).toBe('USER_CONFIGURED');
    expect(view.amountTokens).toBe(100_000);
    expect(view.configuredAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('honours an explicit PLATFORM marker even with a configuredAt stamp', () => {
    const view = resolveUserBudgetView({
      monthlyTokenBudget: 500_000,
      monthlyTokenBudgetSource: 'PLATFORM',
      budgetConfiguredAt: '2026-10-01T00:00:00.000Z',
    });
    expect(view.source).toBe('PLATFORM_ALLOWANCE');
  });
});

describe('resolveRemainingCapacity — no denominator, no number', () => {
  it('omits remainingTokens when no budget exists', () => {
    const capacity = resolveRemainingCapacity(42_000, resolveUserBudgetView({}));
    expect(capacity.remainingTokens).toBeUndefined();
    expect(capacity.limitTokens).toBeUndefined();
    expect(capacity.basis).toBe('UNKNOWN');
    expect(capacity.usedTokens).toBe(42_000);
  });

  it('computes remaining ONLY from a real user budget', () => {
    const budget = resolveUserBudgetView({
      monthlyTokenBudget: 100_000,
      monthlyTokenBudgetSource: 'USER',
      budgetConfiguredAt: '2026-10-01T00:00:00.000Z',
    });
    const capacity = resolveRemainingCapacity(42_000, budget);
    expect(capacity.limitTokens).toBe(100_000);
    expect(capacity.remainingTokens).toBe(58_000);
    expect(capacity.basis).toBe('USER_BUDGET');
  });

  it('clamps remaining at 0 when usage exceeds the budget (never negative)', () => {
    const budget = resolveUserBudgetView({
      monthlyTokenBudget: 1_000,
      monthlyTokenBudgetSource: 'USER',
      budgetConfiguredAt: '2026-10-01T00:00:00.000Z',
    });
    expect(resolveRemainingCapacity(5_000, budget).remainingTokens).toBe(0);
  });

  it('labels a platform allowance distinctly from a user budget', () => {
    const allowance = resolveUserBudgetView({ monthlyTokenBudget: 1_000_000 });
    expect(resolveRemainingCapacity(0, allowance).basis).toBe('PLATFORM_ALLOWANCE');
  });
});

describe('resolveProviderQuotaView — UNKNOWN stays UNKNOWN', () => {
  it('never invents a remaining-token count from a missing quota signal', () => {
    const quota = resolveProviderQuotaView('google', 0, false);
    expect(quota.quotaKnown).toBe(false);
    expect(quota.remainingTokens).toBeUndefined();
    expect(quota.usedPercent).toBeUndefined();
    expect(quota.source).toBe('UNKNOWN');
  });

  it('exposes a real reported percentage WITHOUT fabricating a token count', () => {
    const quota = resolveProviderQuotaView('openai', 42, false);
    expect(quota.quotaKnown).toBe(true);
    expect(quota.usedPercent).toBe(42);
    expect(quota.remainingTokens).toBeUndefined();
    expect(quota.source).toBe('PROVIDER_ACCOUNT');
  });

  it('clamps a reported percentage into 0..100', () => {
    expect(resolveProviderQuotaView('x', 150, false).usedPercent).toBe(100);
    expect(resolveProviderQuotaView('x', -5, false).quotaKnown).toBe(false);
  });

  it('treats local AI as unmetered by cloud quota', () => {
    const quota = resolveProviderQuotaView('ollama', 0, true);
    expect(quota.quotaKnown).toBe(true);
    expect(quota.remainingTokens).toBe(0);
    expect(quota.note).toMatch(/Local AI/i);
  });
});
