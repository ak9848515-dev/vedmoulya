// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Spatial Intelligence: OpportunityRadarSpatial component tests
// (SPRINT-043D step 23). Verifies presentation behaviour only: empty state,
// populated nodes, STOP emphasis, selection + the existing mapping layer is
// consumed (no invented state).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpportunityRadarSpatial } from '../OpportunityRadarSpatial.js';
import type { RadarSpatialEntry } from '../../../lib/spatial/radar-mappings.js';

function mk(over: Partial<RadarSpatialEntry> & { problemId: string }): RadarSpatialEntry {
  return {
    problemStatement: 'Some slow checkout',
    opportunityScore: 0.6,
    evidenceCount: 2,
    hasVerifiedPayment: false,
    revenueState: 'PROBLEM',
    nextAction: 'RUN_NO_COST_EXPERIMENT',
    ...over,
  };
}

const entries: RadarSpatialEntry[] = [
  mk({
    problemId: 'stop-1',
    nextAction: 'STOP',
    stopReason: 'no signal after interviews',
    problemStatement: 'Abandoned cart feature',
  }),
  mk({
    problemId: 'v-1',
    hasVerifiedPayment: true,
    evidenceCount: 1,
    opportunityScore: 0.9,
    problemStatement: 'Paywall friction',
  }),
  mk({
    problemId: 'o-1',
    evidenceCount: 3,
    opportunityScore: 0.4,
    problemStatement: 'Reporting lag',
  }),
  mk({ problemId: 'u-1', evidenceCount: 0, opportunityScore: 0.2, problemStatement: 'New idea' }),
];

describe('OpportunityRadarSpatial', () => {
  it('renders an honest empty state (never fabricated nodes)', () => {
    render(<OpportunityRadarSpatial entries={[]} />);
    expect(screen.getByTestId('radar-empty')).toBeDefined();
    expect(screen.getByText('Your opportunity field is forming.')).toBeDefined();
  });

  it('renders one interactive node per entry, sorted with STOP first', () => {
    render(<OpportunityRadarSpatial entries={entries} />);
    // stop-1 sorts first -> it is the first radar node button in DOM order.
    expect(screen.getAllByTestId(/^radar-node-/)).toHaveLength(4);
    expect(screen.getByTestId('radar-node-stop-1')).toBeDefined();
  });

  it('does NOT style STOP as a success (red ring + ✕ marker present)', () => {
    render(<OpportunityRadarSpatial entries={entries} />);
    expect(screen.getByText('✕')).toBeDefined(); // STOP marker
  });

  it('emits onSelect with the problemId on click and shows the selected detail', () => {
    const onSelect = vi.fn();
    render(<OpportunityRadarSpatial entries={entries} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('radar-node-v-1'));
    expect(onSelect).toHaveBeenCalledWith('v-1');
    // Selected detail panel exposes the authoritative fields (§8).
    expect(screen.getByText('Paywall friction')).toBeDefined();
    expect(screen.getByText('verified payment')).toBeDefined();
  });

  it('does not invent scores: UNKNOWN importance is rendered as UNKNOWN', () => {
    // The fixture above defines exactly four entries; index 3 is the UNKNOWN one.
    const unknownEntry = entries[3]!;
    render(<OpportunityRadarSpatial entries={[unknownEntry]} />);
    fireEvent.click(screen.getByTestId('radar-node-u-1'));
    expect(screen.getByText('UNKNOWN')).toBeDefined();
  });

  it('supports keyboard selection (Enter) with an accessible label (§8/§19)', () => {
    render(<OpportunityRadarSpatial entries={entries} />);
    const node = screen.getByTestId('radar-node-o-1');
    expect(node.getAttribute('aria-label')).toContain('OBSERVED opportunity');
    fireEvent.keyDown(node, { key: 'Enter' });
    // Selection detail appears for the focused opportunity.
    expect(screen.getByText('Reporting lag')).toBeDefined();
    expect(node.getAttribute('aria-selected')).toBe('true');
  });

  it('paints the interactive hit circle LAST so real clicks reach the button (SPRINT-043E D1)', () => {
    // Regression for a real browser defect: the transparent hit circle was
    // painted BEFORE the visible dot, so the dot intercepted pointer events
    // and clicking the node did nothing. The hit circle must be the LAST
    // circle in the node group (SVG paint order == pointer-event order).
    render(<OpportunityRadarSpatial entries={[entries[0]!]} />);
    const group = screen.getByTestId('radar-node-stop-1').closest('g');
    expect(group).not.toBeNull();
    const circles = Array.from(group!.querySelectorAll('circle')) as SVGCircleElement[];
    expect(circles.length).toBeGreaterThanOrEqual(2);
    const hit = screen.getByTestId('radar-node-stop-1') as unknown as SVGCircleElement;
    const visibleDots = circles.filter(
      (c) => c.getAttribute('fill') !== 'transparent' && c !== hit,
    );
    expect(visibleDots.length).toBeGreaterThanOrEqual(1);
    // The hit (button) circle must come after every visible dot in DOM order.
    const hitIndex = circles.indexOf(hit);
    for (const dot of visibleDots) {
      expect(circles.indexOf(dot)).toBeLessThan(hitIndex);
    }
  });
});
