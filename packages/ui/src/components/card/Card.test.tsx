// ──────────────────────────────────────────────────────────────────
// VedMoulya — Card Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: Card, AICard, KnowledgeCard, MemoryCard, CareerCard,
//         BusinessCard, MarketplaceCard, LifeOSCard
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Card,
  AICard,
  KnowledgeCard,
  MemoryCard,
  CareerCard,
  BusinessCard,
  MarketplaceCard,
  LifeOSCard,
} from './index.js';

// ── Card ──────────────────────────────────────────────────────────────────

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies standard variant by default', () => {
    const { container } = render(<Card>Standard</Card>);
    expect(container.firstChild).toHaveClass('bg-white');
  });

  it('applies elevated variant', () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    expect(container.firstChild).toHaveClass(
      'shadow-[0_10px_15px_rgba(15,23,42,0.07),0_4px_6px_rgba(15,23,42,0.04)]',
    );
  });

  it('applies ghost variant', () => {
    const { container } = render(<Card variant="ghost">Ghost</Card>);
    expect(container.firstChild).toHaveClass('bg-transparent');
  });

  it('applies interactive variant', () => {
    const { container } = render(<Card variant="interactive">Interactive</Card>);
    expect(container.firstChild).toHaveClass('cursor-pointer');
  });

  it('applies padding classes', () => {
    const { container } = render(<Card padding="sm">Padding</Card>);
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('renders as article when as prop is article', () => {
    const { container } = render(<Card as="article">Article</Card>);
    expect(container.querySelector('article')).toBeInTheDocument();
  });

  it('renders as section when as prop is section', () => {
    const { container } = render(<Card as="section">Section</Card>);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('handles onClick on interactive card', () => {
    const handleClick = vi.fn();
    render(
      <Card variant="interactive" onClick={handleClick}>
        Click
      </Card>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('sets role="button" when onClick is provided', () => {
    render(<Card onClick={vi.fn()}>Button</Card>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('supports keyboard Enter on interactive card', () => {
    const handleClick = vi.fn();
    render(
      <Card variant="interactive" onClick={handleClick}>
        Key
      </Card>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(handleClick).toHaveBeenCalled();
  });

  it('supports keyboard Space on interactive card', () => {
    const handleClick = vi.fn();
    render(
      <Card variant="interactive" onClick={handleClick}>
        Key
      </Card>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(handleClick).toHaveBeenCalled();
  });

  it('has displayName', () => {
    expect(Card.displayName).toBe('Card');
  });

  // ── Snapshots ─────────────────────────────────────────────────────────
  it('matches snapshot for standard variant', () => {
    const { container } = render(<Card variant="standard">Standard</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for elevated variant', () => {
    const { container } = render(<Card variant="elevated">Elevated</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for ghost variant', () => {
    const { container } = render(<Card variant="ghost">Ghost</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for interactive variant', () => {
    const { container } = render(<Card variant="interactive">Interactive</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with sm padding', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot with lg padding', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── AI Card ───────────────────────────────────────────────────────────────

describe('AICard', () => {
  it('renders children', () => {
    render(<AICard>AI content</AICard>);
    expect(screen.getByText('AI content')).toBeInTheDocument();
  });

  it('shows AI Coach label', () => {
    render(<AICard>Content</AICard>);
    expect(screen.getByText('AI Coach')).toBeInTheDocument();
  });

  it('shows confidence indicator', () => {
    render(<AICard confidence={80}>Content</AICard>);
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  it('shows source when provided', () => {
    render(<AICard source="Test Source">Content</AICard>);
    expect(screen.getByText(/Source: Test Source/)).toBeInTheDocument();
  });

  it('calls onTalk when Talk button clicked', () => {
    const onTalk = vi.fn();
    render(<AICard onTalk={onTalk}>Content</AICard>);
    fireEvent.click(screen.getByText('Talk'));
    expect(onTalk).toHaveBeenCalled();
  });

  it('calls onDismiss when Dismiss button clicked', () => {
    const onDismiss = vi.fn();
    render(<AICard onDismiss={onDismiss}>Content</AICard>);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onWhy when Why button clicked', () => {
    const onWhy = vi.fn();
    render(<AICard onWhy={onWhy}>Content</AICard>);
    fireEvent.click(screen.getByText('Why?'));
    expect(onWhy).toHaveBeenCalled();
  });

  it('has displayName', () => {
    expect(AICard.displayName).toBe('AICard');
  });
});

// ── Knowledge Card ────────────────────────────────────────────────────────

describe('KnowledgeCard', () => {
  it('renders title and summary', () => {
    render(<KnowledgeCard title="Test Title" summary="Test summary content" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test summary content')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<KnowledgeCard title="T" summary="S" tags={['tag1', 'tag2']} />);
    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
  });

  it('shows connection count', () => {
    render(<KnowledgeCard title="T" summary="S" connections={5} />);
    expect(screen.getByText('5 connections')).toBeInTheDocument();
  });

  it('calls onExpand when clicked', () => {
    const onExpand = vi.fn();
    render(<KnowledgeCard title="T" summary="S" onExpand={onExpand} />);
    fireEvent.click(screen.getByText('Expand'));
    expect(onExpand).toHaveBeenCalled();
  });
});

// ── Memory Card ───────────────────────────────────────────────────────────

describe('MemoryCard', () => {
  it('renders title and content', () => {
    render(<MemoryCard title="Memory" content="Content" timestamp="2h ago" />);
    expect(screen.getByText('Memory')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows timestamp', () => {
    render(<MemoryCard title="M" content="C" timestamp="2h ago" />);
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('calls onSave when clicked', () => {
    const onSave = vi.fn();
    render(<MemoryCard title="M" content="C" timestamp="2h" onSave={onSave} />);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalled();
  });
});

// ── Career Card ───────────────────────────────────────────────────────────

describe('CareerCard', () => {
  it('renders title and organization', () => {
    render(<CareerCard title="Engineer" organization="ACME" />);
    expect(screen.getByText('Engineer')).toBeInTheDocument();
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('shows trust score', () => {
    render(<CareerCard title="E" trustScore={88} />);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('renders skills', () => {
    render(<CareerCard title="E" skills={['React', 'TypeScript']} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });
});

// ── Business Card ─────────────────────────────────────────────────────────

describe('BusinessCard', () => {
  it('renders title and venture', () => {
    render(<BusinessCard title="SaaS" venture="Startup Inc" />);
    expect(screen.getByText('SaaS')).toBeInTheDocument();
    expect(screen.getByText('Startup Inc')).toBeInTheDocument();
  });
});

// ── Marketplace Card ──────────────────────────────────────────────────────

describe('MarketplaceCard', () => {
  it('renders title, provider, and price', () => {
    render(<MarketplaceCard title="Service" provider="Provider Co" price="$49" />);
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Provider Co')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
  });

  it('shows rating stars', () => {
    render(<MarketplaceCard title="S" provider="P" price="$" rating={4.5} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });
});

// ── Life OS Card ──────────────────────────────────────────────────────────

describe('LifeOSCard', () => {
  it('renders title and state', () => {
    render(<LifeOSCard title="Routine" state="morning" />);
    expect(screen.getByText('Routine')).toBeInTheDocument();
    expect(screen.getByText('morning mode')).toBeInTheDocument();
  });

  it('shows progress', () => {
    render(<LifeOSCard title="R" progress={65} />);
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('shows daily score', () => {
    render(<LifeOSCard title="R" dailyScore={82} />);
    expect(screen.getByText('82')).toBeInTheDocument();
  });
});
