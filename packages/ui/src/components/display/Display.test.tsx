// ──────────────────────────────────────────────────────────────────
// VedMoulya — Display Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: Badge, Avatar, Progress, Loading, Skeleton, Divider
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, Avatar, Progress, Loading, Skeleton, Divider } from './index.js';

// ── Badge ─────────────────────────────────────────────────────────────────

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies default variant by default', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass('bg-[#F1F5F9]');
  });

  it('applies success variant', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    expect(container.firstChild).toHaveClass('bg-[#F0FDF4]');
  });

  it('applies danger variant', () => {
    const { container } = render(<Badge variant="danger">Danger</Badge>);
    expect(container.firstChild).toHaveClass('bg-[#FEF2F2]');
  });

  it('applies ai variant', () => {
    const { container } = render(<Badge variant="ai">AI</Badge>);
    expect(container.firstChild).toHaveClass('bg-[#F5F3FF]');
  });

  it('applies premium variant', () => {
    const { container } = render(<Badge variant="premium">Premium</Badge>);
    expect(container.firstChild).toHaveClass('bg-[#FFFBEB]');
  });

  it('applies size classes', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    expect(container.firstChild).toHaveClass('h-[22px]');
  });

  it('applies lg size classes', () => {
    const { container } = render(<Badge size="lg">Large</Badge>);
    expect(container.firstChild).toHaveClass('h-[30px]');
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot for default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for success variant', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for danger variant', () => {
    const { container } = render(<Badge variant="danger">Danger</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Avatar ────────────────────────────────────────────────────────────────

describe('Avatar', () => {
  it('renders initials when no src', () => {
    render(<Avatar alt="John Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders image when src provided', () => {
    render(<Avatar src="https://example.com/avatar.jpg" alt="John Doe" />);
    const img = screen.getByAltText('John Doe');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('applies size classes', () => {
    const { container } = render(<Avatar alt="User" size="xl" />);
    const inner = container.querySelector('.rounded-full');
    expect(inner?.className).toContain('h-16');
  });

  it('shows status indicator', () => {
    const { container } = render(<Avatar alt="User" status="online" />);
    expect(container.querySelector('[aria-label="online"]')).toBeInTheDocument();
  });

  it('uses custom fallback', () => {
    render(<Avatar alt="JD" fallback="👤" />);
    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('computes initials from alt text', () => {
    render(<Avatar alt="Sarah Johnson" />);
    expect(screen.getByText('SJ')).toBeInTheDocument();
  });
});

// ── Progress ──────────────────────────────────────────────────────────────

describe('Progress', () => {
  it('renders progress bar', () => {
    const { container } = render(<Progress value={50} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('clamps value to 0-100', () => {
    const { container } = render(<Progress value={150} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows label when showLabel is true', () => {
    render(<Progress value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Progress value={50} variant="success" />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.className).toContain('bg-[#22C55E]');
  });

  it('applies size classes', () => {
    const { container } = render(<Progress value={50} size="lg" />);
    const wrapper = container.firstChild?.firstChild;
    expect(wrapper?.className).toContain('h-2');
  });
});

// ── Loading ───────────────────────────────────────────────────────────────

describe('Loading', () => {
  it('renders spinner', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('has role status', () => {
    const { container } = render(<Loading />);
    expect(container.firstChild).toHaveAttribute('role', 'status');
  });

  it('shows label when provided', () => {
    render(<Loading label="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies size classes', () => {
    const { container } = render(<Loading size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-8');
  });
});

// ── Skeleton ──────────────────────────────────────────────────────────────

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild;
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: '100%', height: '20px' });
  });

  it('applies custom dimensions', () => {
    const { container } = render(<Skeleton width="200px" height="48px" />);
    expect(container.firstChild).toHaveStyle({ width: '200px', height: '48px' });
  });

  it('applies rounded classes', () => {
    const { container } = render(<Skeleton rounded="full" />);
    expect(container.firstChild).toHaveClass('rounded-full');
  });

  it('has aria-hidden', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('has animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});

// ── Divider ───────────────────────────────────────────────────────────────

describe('Divider', () => {
  it('renders horizontal divider', () => {
    const { container } = render(<Divider />);
    expect(container.firstChild).toHaveClass('h-px');
    expect(container.firstChild).toHaveAttribute('role', 'separator');
  });

  it('renders vertical divider', () => {
    const { container } = render(<Divider orientation="vertical" />);
    expect(container.firstChild).toHaveClass('w-px');
  });

  it('renders with label', () => {
    render(<Divider label="Section" />);
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('has role separator', () => {
    const { container } = render(<Divider label="Label" />);
    expect(container.firstChild).toHaveAttribute('role', 'separator');
  });
});
