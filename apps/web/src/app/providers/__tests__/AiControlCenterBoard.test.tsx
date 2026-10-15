// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — AI Control Center board tests (honest-UI contract)
// Proves the screen tells the truth:
//   • a platform allowance is labelled "VedMoulya allowance", not "your budget"
//   • "not configured" is shown when no budget exists — never a 1M balance
//   • an unknown provider quota renders "Unknown" and NO bar
//   • LOCAL AI is shown separately and flagged as not metered
//   • unknown cost renders "Unknown", never a made-up $ figure
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AiControlCenterBoard } from '../AiControlCenterBoard.js';
import type { AiControlCenterDTO, AiProviderBoardRowDTO } from '../ai-control-center-types.js';

function provider(overrides: Partial<AiProviderBoardRowDTO> = {}): AiProviderBoardRowDTO {
  return {
    providerId: 'google',
    name: 'Google',
    family: 'google',
    local: false,
    enabled: true,
    monthTokens: 12_421,
    monthExecutions: 4,
    quota: { provider: 'google', quotaKnown: false, source: 'UNKNOWN' },
    monthCostUsd: 0,
    monthCostKnown: false,
    monthCostSource: 'UNKNOWN',
    readiness: {
      providerId: 'google',
      configured: true,
      credentialPresent: true,
      ready: true,
      executable: true,
      quotaAvailable: null,
      state: 'READY',
      reason: 'Ready.',
    },
    // The registry health record is catalog data until a runtime sample writes
    // it — the default fixture states that provenance explicitly.
    healthSource: 'SEED',
    ...overrides,
  };
}

function board(overrides: Partial<AiControlCenterDTO> = {}): AiControlCenterDTO {
  return {
    timezone: 'UTC',
    todayStart: 0,
    monthStart: 0,
    summary: {
      activeCloudAis: 1,
      localAis: 0,
      monthCloudTokens: 12_421,
      monthCloudCostUsd: 0.42,
      monthCloudCostKnown: true,
      todayCloudTokens: 4_231,
      todayCloudCostUsd: 0.12,
      todayCloudCostKnown: true,
      todayCloudExecutions: 2,
      monthCloudExecutions: 4,
      localMonthTokens: 0,
      localTodayTokens: 0,
    },
    budget: { period: 'MONTH', source: 'NONE' },
    remaining: { usedTokens: 12_421, basis: 'UNKNOWN' },
    providers: [provider()],
    byModel: [],
    bySource: [],
    recent: [],
    totalEvents: 4,
    ...overrides,
  };
}

describe('AiControlCenterBoard — summary', () => {
  it('shows today and this month from real ledger figures', () => {
    render(<AiControlCenterBoard board={board()} />);
    expect(screen.getByText('4.2K')).toBeTruthy();
    expect(screen.getByText('12.4K')).toBeTruthy();
    expect(screen.getByText('1 active cloud AI')).toBeTruthy();
  });
});

describe('AiControlCenterBoard — budget honesty', () => {
  it('says "Not configured" when no budget exists (never a 1M balance)', () => {
    render(<AiControlCenterBoard board={board()} />);
    expect(screen.getByText(/Not configured/i)).toBeTruthy();
    // The historical default figure must never appear as a balance.
    expect(screen.queryByText(/million tokens available/i)).toBeNull();
  });

  it('labels a PLATFORM allowance distinctly from the user budget', () => {
    render(
      <AiControlCenterBoard
        board={board({
          budget: { period: 'MONTH', source: 'PLATFORM_ALLOWANCE', amountTokens: 1_000_000 },
          remaining: {
            usedTokens: 12_421,
            limitTokens: 1_000_000,
            remainingTokens: 987_579,
            basis: 'PLATFORM_ALLOWANCE',
          },
        })}
      />,
    );
    expect(screen.getByText('VedMoulya allowance')).toBeTruthy();
    expect(screen.getByText(/not a budget you set/i)).toBeTruthy();
    expect(screen.queryByText('Your monthly budget')).toBeNull();
  });

  it('labels an explicitly configured budget as the user own', () => {
    render(
      <AiControlCenterBoard
        board={board({
          budget: { period: 'MONTH', source: 'USER_CONFIGURED', amountTokens: 100_000 },
          remaining: {
            usedTokens: 42_300,
            limitTokens: 100_000,
            remainingTokens: 57_700,
            basis: 'USER_BUDGET',
          },
        })}
      />,
    );
    expect(screen.getByText('Your monthly budget')).toBeTruthy();
    expect(screen.getByText('57.7K')).toBeTruthy();
  });
});

describe('AiControlCenterBoard — provider quota honesty', () => {
  it('renders "Unknown" quota and NO bar when the provider reports nothing', () => {
    render(<AiControlCenterBoard board={board()} />);
    // Quota AND Remaining both read "Unknown" — neither is ever a number here.
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText('Google provider quota used')).toBeNull();
    // The row says WHERE the number is missing from (the provider), and that
    // the unknown is not a zero balance.
    expect(screen.getByText(/Unavailable from provider/i)).toBeTruthy();
    expect(screen.getByText(/reports no account usage/i)).toBeTruthy();
  });

  it('labels a registry seed estimate as an estimate — never as used quota', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              quota: {
                provider: 'google',
                quotaKnown: false,
                source: 'UNKNOWN',
                registryEstimatePercent: 45,
                note: 'No usage reported by this provider.',
              },
            }),
          ],
        })}
      />,
    );
    // The seed constant is visible ONLY with its provenance attached, and it is
    // never rendered as "45% used" nor as a bar.
    expect(screen.queryByText('45% used')).toBeNull();
    expect(screen.queryByLabelText('Google provider quota used')).toBeNull();
    expect(screen.getByText(/Registry estimate 45%/)).toBeTruthy();
    expect(screen.getByText(/not your account usage/i)).toBeTruthy();
  });

  it('renders a real reported quota with its own bar', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              quota: {
                provider: 'google',
                quotaKnown: true,
                usedPercent: 42,
                source: 'PROVIDER_ACCOUNT',
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('42% used')).toBeTruthy();
    expect(screen.getByLabelText('Google provider quota used')).toBeTruthy();
  });

  it('renders unknown cost as "Unknown", never a fabricated dollar figure', () => {
    render(<AiControlCenterBoard board={board()} />);
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
  });

  it('labels a known cost as ESTIMATED from registry pricing — never a provider-reported charge', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              monthCostUsd: 0.42,
              monthCostKnown: true,
              monthCostSource: 'ESTIMATED_FROM_REGISTRY_PRICING',
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('$0.42')).toBeTruthy();
    // The provenance is visible on the row: an estimate, not a charge.
    expect(screen.getByText('estimated')).toBeTruthy();
    expect(screen.getByText(/estimated from VedMoulya’s registry pricing/i)).toBeTruthy();
    // And it is explicitly negated as a provider-reported charge.
    expect(screen.getByText(/not a provider-reported charge/i)).toBeTruthy();
  });

  it('never shows a cost number for an execution that had no reported pricing', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              monthTokens: 500,
              monthExecutions: 3,
              monthCostUsd: 0,
              monthCostKnown: false,
              monthCostSource: 'UNKNOWN',
            }),
          ],
        })}
      />,
    );
    // No fabricated $0.0000 charge: the unknown cost reads Unknown.
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.queryByText('$0.00')).toBeNull();
    expect(screen.queryByText('estimated')).toBeNull();
  });
});

describe('AiControlCenterBoard — LOCAL AI separation', () => {
  it('lists local AI separately and marks it unmetered', () => {
    render(
      <AiControlCenterBoard
        board={board({
          summary: {
            ...board().summary,
            localAis: 1,
            localMonthTokens: 18_204,
          },
          providers: [
            provider(),
            provider({
              providerId: 'ollama',
              name: 'Ollama',
              family: 'ollama',
              local: true,
              monthTokens: 18_204,
              quota: {
                provider: 'ollama',
                quotaKnown: true,
                usedPercent: 0,
                remainingTokens: 0,
                source: 'KNOWN_PLAN',
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Local AI')).toBeTruthy();
    expect(screen.getByText(/No VedMoulya cloud token charge/i)).toBeTruthy();
    expect(screen.getByText('Not metered')).toBeTruthy();
    expect(screen.getByText('n/a (local)')).toBeTruthy();
  });
});

describe('AiControlCenterBoard — readiness never lies', () => {
  it('does NOT say "Ready to use" for a quota-exhausted provider', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              providerId: 'openai',
              name: 'OpenAI',
              quota: {
                provider: 'openai',
                quotaKnown: true,
                usedPercent: 100,
                source: 'PROVIDER_ACCOUNT',
              },
              readiness: {
                providerId: 'openai',
                configured: true,
                credentialPresent: true,
                ready: true,
                executable: false,
                quotaAvailable: false,
                state: 'QUOTA_EXHAUSTED',
                reason: 'Quota exhausted — connected, but not available for execution.',
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Quota exhausted — not available')).toBeTruthy();
    expect(screen.queryByText('Available')).toBeNull();
  });

  it('shows a rejected credential as needing reconnect, not ready', () => {
    render(
      <AiControlCenterBoard
        board={board({
          providers: [
            provider({
              providerId: 'openai',
              name: 'OpenAI',
              readiness: {
                providerId: 'openai',
                configured: true,
                credentialPresent: true,
                ready: false,
                executable: false,
                quotaAvailable: null,
                state: 'AUTH_REQUIRED',
                reason: 'Credential rejected — reconnect this AI.',
              },
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText('Credential rejected — reconnect')).toBeTruthy();
  });

  it('reports a healthy provider as Available', () => {
    render(<AiControlCenterBoard board={board()} />);
    expect(screen.getByText('Available')).toBeTruthy();
  });
});
