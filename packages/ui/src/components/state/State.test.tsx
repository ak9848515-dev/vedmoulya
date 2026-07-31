// ──────────────────────────────────────────────────────────────────
// VedMoulya — State Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: EmptyState, ErrorState, OfflineState, SuccessState
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState, ErrorState, OfflineState, SuccessState } from './index.js';

// ── EmptyState ────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No items" description="Create your first item." />);
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Create your first item.')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: 'Create', onClick }} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders secondary action button', () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" secondaryAction={{ label: 'Learn', onClick }} />);
    fireEvent.click(screen.getByText('Learn'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders with custom icon', () => {
    render(<EmptyState title="Empty" icon={<span data-testid="custom-icon">📦</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders without actions', () => {
    const { container } = render(<EmptyState title="Just title" />);
    expect(screen.getByText('Just title')).toBeInTheDocument();
  });
});

// ── ErrorState ────────────────────────────────────────────────────────────

describe('ErrorState', () => {
  it('renders default title and message', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<ErrorState title="Custom Error" message="Custom message" />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('renders error object message', () => {
    const error = new Error('Network failure');
    render(<ErrorState error={error} />);
    expect(screen.getByText('Network failure')).toBeInTheDocument();
  });

  it('calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('calls onDismiss when clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorState onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

// ── OfflineState ──────────────────────────────────────────────────────────

describe('OfflineState', () => {
  it('renders default title and message', () => {
    render(<OfflineState />);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('renders last synced timestamp', () => {
    render(<OfflineState lastSynced="5 min ago" />);
    expect(screen.getByText(/Last synced: 5 min ago/)).toBeInTheDocument();
  });

  it('calls onReconnect when clicked', () => {
    const onReconnect = vi.fn();
    render(<OfflineState onReconnect={onReconnect} />);
    fireEvent.click(screen.getByText('Reconnect'));
    expect(onReconnect).toHaveBeenCalled();
  });

  it('has role alert', () => {
    const { container } = render(<OfflineState />);
    expect(container.firstChild).toHaveAttribute('role', 'alert');
  });
});

// ── SuccessState ──────────────────────────────────────────────────────────

describe('SuccessState', () => {
  it('renders title and message', () => {
    render(<SuccessState title="Done!" message="Saved successfully." />);
    expect(screen.getByText('Done!')).toBeInTheDocument();
    expect(screen.getByText('Saved successfully.')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = vi.fn();
    render(<SuccessState title="Done!" action={{ label: 'View', onClick }} />);
    fireEvent.click(screen.getByText('View'));
    expect(onClick).toHaveBeenCalled();
  });

  it('has role status', () => {
    const { container } = render(<SuccessState title="Done!" />);
    expect(container.firstChild).toHaveAttribute('role', 'status');
  });

  it('renders dismiss button', () => {
    const onDismiss = vi.fn();
    render(<SuccessState title="Done!" onDismiss={onDismiss} />);
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss clicked', () => {
    const onDismiss = vi.fn();
    render(<SuccessState title="Done!" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot for default state', () => {
    const { container } = render(<SuccessState title="Done!" message="Saved." />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
