// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — State components tests
// Follows DES-010A/D07 Component Behaviour
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { EmptyState, ErrorState, OfflineState, SuccessState } from './State.js';

describe('EmptyState', () => {
  it('renders title, description, and default icon', () => {
    render(<EmptyState title="No data" description="Nothing here yet" />);
    expect(screen.getByText('No data')).toBeDefined();
    expect(screen.getByText('Nothing here yet')).toBeDefined();
  });

  it('renders a custom icon instead of the default', () => {
    render(<EmptyState title="Custom" icon={<span data-testid="custom-icon">*</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeDefined();
    expect(screen.queryByTestId('inbox-icon')).toBeNull();
  });

  it('renders action and secondary action buttons and wires click handlers', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <EmptyState
        title="Empty"
        action={{ label: 'Create', onClick: onPrimary }}
        secondaryAction={{ label: 'Import', onClick: onSecondary }}
      />,
    );
    fireEvent.click(screen.getByText('Create'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Import'));
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('does not render buttons when actions are absent', () => {
    render(<EmptyState title="Only title" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('renders default title and message when none provided', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeDefined();
  });

  it('renders a custom error message when given an Error', () => {
    render(<ErrorState error={new Error('disk full')} />);
    expect(screen.getByText('disk full')).toBeDefined();
  });

  it('renders a string error without crashing', () => {
    render(<ErrorState error="plain string error" />);
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('wires retry and dismiss handlers', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(<ErrorState onRetry={onRetry} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('OfflineState', () => {
  it('renders default offline messaging', () => {
    render(<OfflineState />);
    expect(screen.getByText("You're offline")).toBeDefined();
  });

  it('renders lastSynced when provided', () => {
    render(<OfflineState lastSynced="5m ago" />);
    expect(screen.getByText(/Last synced: 5m ago/)).toBeDefined();
  });

  it('wires the reconnect handler', () => {
    const onReconnect = vi.fn();
    render(<OfflineState onReconnect={onReconnect} />);
    fireEvent.click(screen.getByText('Reconnect'));
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});

describe('SuccessState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders title, message, and action', () => {
    const onClick = vi.fn();
    render(<SuccessState title="Saved" message="All good" action={{ label: 'View', onClick }} />);
    expect(screen.getByText('Saved')).toBeDefined();
    expect(screen.getByText('All good')).toBeDefined();
    fireEvent.click(screen.getByText('View'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after the timeout and calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<SuccessState title="Saved" autoDismiss={1000} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<SuccessState title="Saved" onDismiss={onDismiss} />);
    const dismiss = screen.getByLabelText('Dismiss');
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('renders forever when no autoDismiss is set', () => {
    render(<SuccessState title="Sticky" />);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Sticky')).toBeDefined();
  });
});
