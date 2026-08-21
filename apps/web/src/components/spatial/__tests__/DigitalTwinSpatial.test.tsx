// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Spatial Intelligence: DigitalTwinSpatial component tests
// (SPRINT-043D step 23). Honest invariants: empty/missing → FORMING (never a
// fabricated populated twin); missing value ≠ 0-score.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DigitalTwinSpatial } from '../DigitalTwinSpatial.js';
import type { TwinDimension } from '../../../lib/spatial/radar-mappings.js';

function dim(over: Partial<TwinDimension> & { key: string }): TwinDimension {
  return { label: over.key, note: undefined, value: 1, ...over };
}

describe('DigitalTwinSpatial', () => {
  it('shows the forming state and never a fake populated twin', () => {
    render(<DigitalTwinSpatial dimensions={[]} />);
    expect(screen.getByTestId('twin-forming')).toBeDefined();
    expect(screen.getByText('Your Digital Twin is forming.')).toBeDefined();
  });

  it('renders the forming state when every dimension is NULL (UNKNOWN)', () => {
    const dims = [dim({ key: 'goals', value: null }), dim({ key: 'progress', value: null })];
    render(<DigitalTwinSpatial dimensions={dims} />);
    expect(screen.getByTestId('twin-forming')).toBeDefined();
  });

  it('recovers from forming to the orbital view when data arrives (hooks-order regression)', () => {
    // The Command Center starts with empty dimensions (FORMING) and populates
    // them after data loads. All hooks must run unconditionally so React never
    // sees a changing hook count between renders.
    const { rerender } = render(<DigitalTwinSpatial dimensions={[]} />);
    expect(screen.getByTestId('twin-forming')).toBeDefined();
    rerender(<DigitalTwinSpatial dimensions={[dim({ key: 'goals', value: 3 })]} />);
    expect(screen.getByTestId('twin-spatial')).toBeDefined();
    expect(screen.getByTestId('twin-node-goals')).toBeDefined();
  });

  it('renders the orbital view and PARTIAL status when some data exists', () => {
    const dims = [
      dim({ key: 'goals', value: 3 }),
      dim({ key: 'progress', value: null }),
      dim({ key: 'opportunities', value: 2 }),
    ];
    render(<DigitalTwinSpatial dimensions={dims} />);
    expect(screen.getByText('PARTIAL')).toBeDefined();
    expect(screen.getAllByTestId(/^twin-node-/)).toHaveLength(3);
  });

  it('renders UNKNOWN dimensions as dashed neutral nodes — missing is never a 0-score', () => {
    const dims = [dim({ key: 'goals', value: 3 }), dim({ key: 'progress', value: null })];
    const { container } = render(<DigitalTwinSpatial dimensions={dims} />);
    const progress = screen.getByTestId('twin-node-progress');
    expect(progress).toBeDefined();
    // Honest accessible label: "not yet known", never a 0 score.
    expect(progress.getAttribute('aria-label')).toContain('not yet known');
    // Dashed stroke = unrecorded, not a negative/low state.
    const strokeDash = container
      .querySelector('[data-testid="twin-node-progress"]')
      ?.getAttribute('stroke-dasharray');
    expect(strokeDash).toBe('3 2');
  });

  it('emits onSelect with the selected dimension', () => {
    const dims = [
      dim({ key: 'goals', value: 3, note: '3 active' }),
      dim({ key: 'progress', value: null }),
      dim({ key: 'opportunities', value: 2 }),
    ];
    const onSelect = vi.fn();
    render(<DigitalTwinSpatial dimensions={dims} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('twin-node-goals'));
    expect(onSelect).toHaveBeenCalledWith(dims[0]);
    // Detail uses the honest twin value label (not a 0-score).
    expect(screen.getByText('3 · 3 active')).toBeDefined();
  });
});
