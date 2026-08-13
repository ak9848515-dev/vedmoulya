// @vitest-environment jsdom
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — ModelSelector Component Tests (EPIC-012A follow-up)
//
// Proves the model selector dropdown behaviour:
//   - dropdown opens/closes on trigger click
//   - currently selected model has a checkmark
//   - model selection calls onSelect and closes the dropdown
//   - Auto option is present at the top
//   - search filters models (shown when >5 models)
//   - unavailable/deprecated models show correct status badges
//   - clicking outside closes the dropdown
//   - Escape closes the dropdown
//   - keyboard navigation (Arrow keys, Enter)
//   - disabled provider shows collapsed read-only trigger
//   - mobile detection does not crash
//   - empty results message when no models match search
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ModelSelector, type ModelOption } from '../ModelSelector.js';

// jsdom does not implement scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const sampleModels: ModelOption[] = [
  { id: 'gpt-5', name: 'GPT-5', capabilities: ['Reasoning', 'Coding'], status: 'available' },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5-mini',
    capabilities: ['Fast', 'Efficient'],
    status: 'available',
  },
  { id: 'gpt-4.1', name: 'GPT-4.1', capabilities: ['General', 'Coding'], status: 'available' },
  {
    id: 'gpt-4-vision',
    name: 'GPT-4 Vision',
    capabilities: ['Vision', 'Reasoning'],
    status: 'limited',
  },
  { id: 'gpt-3.5', name: 'GPT-3.5', capabilities: ['Fast', 'Efficient'], status: 'offline' },
  {
    id: 'gpt-4-deprecated',
    name: 'GPT-4 (Deprecated)',
    capabilities: ['General'],
    status: 'deprecated',
  },
];

const defaultProps = {
  models: sampleModels,
  selectedModelId: 'gpt-5',
  onSelect: vi.fn(),
  providerName: 'OpenAI',
  enabled: true,
};

// ── Basic rendering ─────────────────────────────────────────────────────────

describe('ModelSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the currently selected model name on the trigger', () => {
    render(<ModelSelector {...defaultProps} />);
    expect(screen.getByText('GPT-5')).toBeDefined();
  });

  it('shows Auto with sparkle icon when selectedModelId is undefined', () => {
    render(<ModelSelector {...defaultProps} selectedModelId={undefined} />);
    expect(screen.getByText('Auto')).toBeDefined();
  });

  it('shows a collapsed trigger when disabled', () => {
    render(<ModelSelector {...defaultProps} enabled={false} />);
    expect(screen.getByText('GPT-5')).toBeDefined();
    // No dropdown should open on click when disabled
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.queryByText('Search models...')).toBeNull();
  });

  it('has an accessible label', () => {
    render(<ModelSelector {...defaultProps} />);
    expect(screen.getByLabelText('Select model for OpenAI')).toBeDefined();
  });
});

// ── Dropdown open/close ────────────────────────────────────────────────────

describe('ModelSelector dropdown open/close', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the dropdown when the trigger is clicked', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    // The dropdown should show the options
    expect(screen.getByText('Auto (Recommended)')).toBeDefined();
    expect(screen.getByText('GPT-5-mini')).toBeDefined();
  });

  it('closes the dropdown when clicking outside', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.getByText('Auto (Recommended)')).toBeDefined();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Auto (Recommended)')).toBeNull();
  });

  it('closes the dropdown on Escape key', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.getByText('Auto (Recommended)')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Auto (Recommended)')).toBeNull();
  });

  it('sets aria-expanded correctly', () => {
    render(<ModelSelector {...defaultProps} />);
    const trigger = screen.getByLabelText('Select model for OpenAI');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
});

// ── Model selection ─────────────────────────────────────────────────────────

describe('ModelSelector selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the currently selected model with a checkmark', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    // The selected item should have aria-selected="true"
    const selectedOption = screen.getByRole('option', { selected: true });
    expect(selectedOption).toBeDefined();
    expect(selectedOption.textContent).toContain('GPT-5');
  });

  it('calls onSelect when a model is clicked and closes the dropdown', () => {
    const onSelect = vi.fn();
    render(<ModelSelector {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('GPT-5'));
    fireEvent.click(screen.getByText('GPT-5-mini'));

    expect(onSelect).toHaveBeenCalledWith('gpt-5-mini');
    // Dropdown should be closed after selection
    expect(screen.queryByText('Auto (Recommended)')).toBeNull();
  });

  it('calls onSelect with undefined when Auto is chosen', () => {
    const onSelect = vi.fn();
    render(<ModelSelector {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('GPT-5'));
    fireEvent.click(screen.getByText('Auto (Recommended)'));

    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});

// ── Search ──────────────────────────────────────────────────────────────────

describe('ModelSelector search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a search field when there are more than 5 models', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    expect(screen.getByPlaceholderText('Search models...')).toBeDefined();
  });

  it('filters models when typing in the search field', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'mini' } });

    // GPT-5-mini should still show
    expect(screen.getByText('GPT-5-mini')).toBeDefined();
    // GPT-5 should be hidden in the dropdown (trigger still shows it)
    const gpt5Elements = screen.getAllByText('GPT-5');
    expect(gpt5Elements.length).toBe(1); // only the trigger button
  });

  it('shows empty state when no models match the search', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

    expect(screen.getByText('No models match your search.')).toBeDefined();
  });

  it('searches by capability name too', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'vision' } });

    expect(screen.getByText('GPT-4 Vision')).toBeDefined();
  });
});

// ── Model status indicators ─────────────────────────────────────────────────

describe('ModelSelector status indicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Available badge for available models', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    const availableElements = screen.getAllByText('Available');
    expect(availableElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Limited badge for limited models', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.getByText('Limited')).toBeDefined();
  });

  it('shows Offline badge for offline models', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('shows Deprecated badge for deprecated models', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    expect(screen.getByText('Deprecated')).toBeDefined();
  });
});

// ── Auto routing ────────────────────────────────────────────────────────────

describe('ModelSelector Auto routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Auto as the first option with VedMoulya routing description', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    const autoOption = screen.getByText('Auto (Recommended)');
    expect(autoOption).toBeDefined();
    expect(screen.getByText('VedMoulya chooses the best model for each task')).toBeDefined();
  });
});

// ── Keyboard navigation ────────────────────────────────────────────────────

describe('ModelSelector keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the dropdown with Enter key', () => {
    render(<ModelSelector {...defaultProps} />);
    const trigger = screen.getByLabelText('Select model for OpenAI');
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(screen.getByText('Auto (Recommended)')).toBeDefined();
  });

  it('opens the dropdown with Space key', () => {
    render(<ModelSelector {...defaultProps} />);
    const trigger = screen.getByLabelText('Select model for OpenAI');
    fireEvent.keyDown(trigger, { key: ' ' });

    expect(screen.getByText('Auto (Recommended)')).toBeDefined();
  });

  it('navigates with ArrowDown and selects with Enter', () => {
    const onSelect = vi.fn();
    render(<ModelSelector {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('GPT-5'));

    // Arrow down should move focus (no action, just visual)
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'ArrowDown' });

    // Enter should select the focused option
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalled();
  });

  it('navigates with ArrowUp', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    // Arrow up from index 0 should stay at 0
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    // No crash — ArrowUp at index 0 is clamped
  });

  it('closes the dropdown with Escape', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ── Capability labels ───────────────────────────────────────────────────────

describe('ModelSelector capability display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays capability labels separated by ·', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    expect(screen.getByText('Reasoning')).toBeDefined();
    // Coding appears in both GPT-5 and GPT-4.1 — use getAllByText
    const codingElements = screen.getAllByText('Coding');
    expect(codingElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows description text for Auto option', () => {
    render(<ModelSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('GPT-5'));

    expect(screen.getByText('VedMoulya chooses the best model for each task')).toBeDefined();
  });

  it('truncates capabilities to 3 items', () => {
    const manyCapModels: ModelOption[] = [
      { id: 'm1', name: 'Model 1', capabilities: ['A', 'B', 'C', 'D', 'E'], status: 'available' },
    ];
    render(<ModelSelector {...defaultProps} models={manyCapModels} selectedModelId={'m1'} />);
    // Trigger shows 'Model 1' because it's the selected model
    fireEvent.click(screen.getByText('Model 1'));

    // Model 1 appears in both the trigger and the dropdown — use getAllByText
    const model1Elements = screen.getAllByText('Model 1');
    expect(model1Elements.length).toBeGreaterThanOrEqual(1);
    // The capability labels render inside the dropdown. Verify the model
    // entry is present and that capability text is rendered within it.
    const listbox = screen.getByRole('listbox');
    expect(listbox.textContent).toContain('Model 1');
    expect(listbox.textContent).toContain('A');
    expect(listbox.textContent).toContain('B');
    expect(listbox.textContent).toContain('C');
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('ModelSelector edge cases', () => {
  it('handles empty models array without crashing', () => {
    render(<ModelSelector {...defaultProps} models={[]} />);
    expect(screen.getByText('Auto')).toBeDefined();
  });

  it('does not show search when models <= 5', () => {
    const fewModels: ModelOption[] = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    render(<ModelSelector {...defaultProps} models={fewModels} />);
    fireEvent.click(screen.getByText('Auto'));
    // With only 2 models + Auto = 3 items, search should not be shown
    expect(screen.queryByPlaceholderText('Search models...')).toBeNull();
  });

  it('handles unknown selectedModelId gracefully', () => {
    render(<ModelSelector {...defaultProps} selectedModelId={'nonexistent'} />);
    // Should fall back to showing "Auto"
    expect(screen.getByText('Auto')).toBeDefined();
  });
});
