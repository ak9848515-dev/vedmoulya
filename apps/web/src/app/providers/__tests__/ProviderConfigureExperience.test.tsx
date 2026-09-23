// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configure AI surface gate (G9 one-click gate)
//
// The one-click Connect flow only covers the gateway's closed connect contract.
// A registry-only family must never be offered it: the configure view says why
// and shows the advanced configuration instead.
//
// This renders the DECISION with stub surfaces, so the assertion is about which
// surface appears — not about the internals of either one.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProviderConfigureExperience } from '../ProviderConfigureExperience.js';

function renderGate(
  overrides: {
    providerName?: string;
    oneClickSupported?: boolean;
    advancedDisclosed?: boolean;
  } = {},
): void {
  render(
    <ProviderConfigureExperience
      providerName={overrides.providerName ?? 'Acme AI'}
      oneClickSupported={overrides.oneClickSupported ?? false}
      advancedDisclosed={overrides.advancedDisclosed ?? false}
      connectFlow={<div data-testid="one-click-surface">Connect</div>}
      advancedSetup={<div data-testid="advanced-surface">Advanced configuration</div>}
    />,
  );
}

describe('ProviderConfigureExperience (G9 one-click gate)', () => {
  it('renders the one-click flow — and no gate notice — for a contract family', () => {
    renderGate({ providerName: 'Gemini', oneClickSupported: true });

    expect(screen.getByTestId('one-click-surface')).toBeDefined();
    expect(screen.queryByTestId('provider-one-click-gate')).toBeNull();
    expect(screen.queryByTestId('provider-one-click-unavailable')).toBeNull();
    // The advanced surface stays behind [Advanced] until it is disclosed.
    expect(screen.queryByTestId('advanced-surface')).toBeNull();
  });

  it('discloses the advanced surface for a contract family only when asked', () => {
    renderGate({ oneClickSupported: true, advancedDisclosed: true });

    expect(screen.getByTestId('one-click-surface')).toBeDefined();
    expect(screen.getByTestId('advanced-surface')).toBeDefined();
  });

  it('gates the one-click flow out for a registry-only family and says why', () => {
    renderGate({ providerName: 'Acme AI', oneClickSupported: false });

    // The flow is never rendered for such a provider.
    expect(screen.queryByTestId('one-click-surface')).toBeNull();

    const notice = screen.getByTestId('provider-one-click-unavailable');
    expect(notice.textContent).toMatch(/Acme AI uses the advanced setup/);
    expect(notice.textContent).toMatch(/custom or registry endpoint/i);
  });

  it('always shows the advanced configuration when the flow is gated out', () => {
    // ...even though [Advanced] was never clicked: it is the only path left.
    renderGate({ oneClickSupported: false, advancedDisclosed: false });

    expect(screen.getByTestId('provider-one-click-gate')).toBeDefined();
    expect(screen.getByTestId('advanced-surface')).toBeDefined();
  });
});
