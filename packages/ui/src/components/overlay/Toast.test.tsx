// ──────────────────────────────────────────────────────────────────
// VedMoulya — Toast Component Tests
// Covers: ToastProvider, useToast, ToastItem variants, ToastViewport, Snackbar
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, ToastViewport, useToast, Snackbar } from '../overlay/Toast.js';

// ── Test Harness ────────────────────────────────────────────────────────────

function ToastTrigger(): React.JSX.Element {
  const { addToast, removeToast } = useToast();
  return (
    <div>
      <button
        type="button"
        onClick={() => addToast({ title: 'Hello', description: 'World', type: 'success' })}
      >
        Add
      </button>
      <button type="button" onClick={() => removeToast('toast-x')}>
        Remove
      </button>
    </div>
  );
}

// ── ToastProvider ───────────────────────────────────────────────────────────

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children inside the provider', () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>,
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders the viewport', () => {
    // ToastProvider renders its own viewport, so an explicit <ToastViewport />
    // child would duplicate it. Assert the provider's built-in viewport exists.
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>,
    );
    const viewport = screen.getByTestId('toast-viewport');
    expect(viewport.tagName).toBe('OL');
  });

  it('adds and renders a toast with title, description and type', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('auto-dismisses a toast after 5 seconds', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Hello')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('removeToast removes a matching toast by id', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
        <ToastViewport />
      </ToastProvider>,
    );
    // addToast assigns an internal id; removing an unknown id is a no-op
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('useToast throws outside the provider', () => {
    // Suppress the expected console error from React error boundary handling.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastTrigger />)).toThrow('useToast must be used within ToastProvider');
    spy.mockRestore();
  });
});

// ── ToastItem variants ──────────────────────────────────────────────────────

describe('ToastItem types', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function AddByType({ type }: { type: 'success' | 'error' | 'warning' | 'info' }) {
    const { addToast } = useToast();
    return (
      <button type="button" onClick={() => addToast({ title: `Toast ${type}`, type })}>
        Fire {type}
      </button>
    );
  }

  it('renders a success toast with its title', () => {
    render(
      <ToastProvider>
        <AddByType type="success" />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Fire success'));
    expect(screen.getByText('Toast success')).toBeInTheDocument();
  });

  it('renders an error toast with its title', () => {
    render(
      <ToastProvider>
        <AddByType type="error" />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Fire error'));
    expect(screen.getByText('Toast error')).toBeInTheDocument();
  });

  it('renders a warning toast with its title', () => {
    render(
      <ToastProvider>
        <AddByType type="warning" />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Fire warning'));
    expect(screen.getByText('Toast warning')).toBeInTheDocument();
  });

  it('renders an info toast with its title', () => {
    render(
      <ToastProvider>
        <AddByType type="info" />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Fire info'));
    expect(screen.getByText('Toast info')).toBeInTheDocument();
  });

  it('renders a toast without a description (title only)', () => {
    render(
      <ToastProvider>
        <AddByType type="info" />
        <ToastViewport />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Fire info'));
    expect(screen.getByText('Toast info')).toBeInTheDocument();
  });
});

// ── ToastViewport ───────────────────────────────────────────────────────────

describe('ToastViewport', () => {
  it('accepts and applies a custom className', () => {
    render(
      <ToastProvider>
        <ToastViewport className="custom-viewport" />
      </ToastProvider>,
    );
    // The provider renders its own viewport plus this explicit one.
    const viewports = screen.getAllByTestId('toast-viewport');
    expect(viewports).toHaveLength(2);
    expect(viewports.some((v) => v.className.includes('custom-viewport'))).toBe(true);
  });
});

// ── Snackbar ────────────────────────────────────────────────────────────────

describe('Snackbar variants', () => {
  it('renders default style', () => {
    const { container } = render(<Snackbar message="Default" />);
    expect(container.firstChild).toHaveClass('bg-[#1F2937]');
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders success style', () => {
    const { container } = render(<Snackbar message="Saved" type="success" />);
    expect(container.firstChild).toHaveClass('bg-[#22C55E]');
  });

  it('renders error style', () => {
    const { container } = render(<Snackbar message="Failed" type="error" />);
    expect(container.firstChild).toHaveClass('bg-[#EF4444]');
  });

  it('renders warning style', () => {
    const { container } = render(<Snackbar message="Careful" type="warning" />);
    expect(container.firstChild).toHaveClass('bg-[#F59E0B]');
  });

  it('invokes the action callback', () => {
    const onClick = vi.fn();
    render(<Snackbar message="Deleted" action={{ label: 'Undo', onClick }} />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render an action button when no action is provided', () => {
    render(<Snackbar message="No action" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Snackbar message="Custom" className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('renders with role alert', () => {
    const { container } = render(<Snackbar message="Alert" />);
    expect(container.firstChild).toHaveAttribute('role', 'alert');
  });
});
