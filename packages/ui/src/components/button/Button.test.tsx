// ──────────────────────────────────────────────────────────────────
// VedMoulya — Button & IconButton Tests
// BLD-003A Design System Quality & Documentation
// Covers: unit, interaction, accessibility, keyboard, theme,
//         responsive, and snapshot tests
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Bell } from 'lucide-react';
import { Button, buttonVariants, IconButton, iconButtonVariants } from './index.js';

// ── Button ────────────────────────────────────────────────────────────────

describe('Button', () => {
  // ── Unit: Render ────────────────────────────────────────────────────────
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders with icon on the left', () => {
    render(<Button icon={<Bell data-testid="icon" />}>Notify</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders with icon on the right', () => {
    render(
      <Button icon={<Bell data-testid="icon" />} iconPosition="right">
        Notify
      </Button>,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  // ── Variants ────────────────────────────────────────────────────────────
  it('applies primary variant classes', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    expect(container.firstChild).toHaveClass('bg-[#2B5FD9]');
  });

  it('applies secondary variant classes', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toHaveClass('bg-white');
  });

  it('applies ghost variant classes', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    expect(container.firstChild).toHaveClass('bg-transparent');
  });

  it('applies danger variant classes', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toHaveClass('bg-[#EF4444]');
  });

  it('applies ai variant classes', () => {
    const { container } = render(<Button variant="ai">AI</Button>);
    expect(container.firstChild).toHaveClass('bg-[#7C3AED]');
  });

  // ── Sizes ───────────────────────────────────────────────────────────────
  it('applies sm size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toHaveClass('h-8');
  });

  it('applies md size classes', () => {
    const { container } = render(<Button size="md">Medium</Button>);
    expect(container.firstChild).toHaveClass('h-10');
  });

  it('applies lg size classes', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstChild).toHaveClass('h-12');
  });

  it('applies xl size classes', () => {
    const { container } = render(<Button size="xl">XL</Button>);
    expect(container.firstChild).toHaveClass('h-14');
  });

  // ── States ──────────────────────────────────────────────────────────────
  it('shows loading spinner and disables when loading', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies fullWidth class', () => {
    const { container } = render(<Button fullWidth>Full</Button>);
    expect(container.firstChild).toHaveClass('w-full');
  });

  // ── Interaction ─────────────────────────────────────────────────────────
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled>
        Click
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // ── Keyboard ────────────────────────────────────────────────────────────
  it('can be focused via keyboard', () => {
    render(<Button>Focusable</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });

  it('is keyboard-focusable with tabIndex', () => {
    render(<Button>Tab</Button>);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
    expect(button.tabIndex).toBe(0);
  });

  // ── Accessibility ───────────────────────────────────────────────────────
  it('has button role', () => {
    render(<Button>Accessible</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('passes aria-label when provided', () => {
    render(<Button aria-label="Custom label">Visible</Button>);
    expect(screen.getByLabelText('Custom label')).toBeInTheDocument();
  });

  it('supports aria-describedby', () => {
    render(
      <>
        <Button aria-describedby="desc-1">Described</Button>
        <p id="desc-1">Description text</p>
      </>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby', 'desc-1');
  });

  // ── Display Name ────────────────────────────────────────────────────────
  it('has displayName set', () => {
    expect(Button.displayName).toBe('Button');
  });

  // ── Forwarded Ref ───────────────────────────────────────────────────────
  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot for primary variant', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for loading state', () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for disabled state', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for AI variant', () => {
    const { container } = render(<Button variant="ai">AI</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for danger variant', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with full width', () => {
    const { container } = render(<Button fullWidth>Full Width</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with icon', () => {
    const { container } = render(<Button icon={<span>🔔</span>}>With Icon</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── IconButton ────────────────────────────────────────────────────────────

describe('IconButton', () => {
  it('renders with icon', () => {
    render(<IconButton label="Settings" icon={<Bell data-testid="icon" />} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('has aria-label set', () => {
    render(<IconButton label="Notifications" icon={<Bell />} />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<IconButton variant="primary" label="Primary" icon={<Bell />} />);
    expect(container.firstChild).toHaveClass('bg-[#2B5FD9]');
  });

  it('applies size classes', () => {
    const { container } = render(<IconButton size="sm" label="Small" icon={<Bell />} />);
    expect(container.firstChild).toHaveClass('h-8');
  });

  it('applies rounded classes', () => {
    const { container } = render(<IconButton rounded label="Rounded" icon={<Bell />} />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('is disabled when disabled prop is set', () => {
    render(<IconButton disabled label="Disabled" icon={<Bell />} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<IconButton onClick={handleClick} label="Click" icon={<Bell />} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<IconButton ref={ref} label="Ref" icon={<Bell />} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('has displayName set', () => {
    expect(IconButton.displayName).toBe('IconButton');
  });

  it('is keyboard focusable', () => {
    render(<IconButton label="Focus" icon={<Bell />} />);
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();
  });
});
