// ──────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: Tabs, NavBar, Sidebar, Breadcrumb, Search
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  NavBar,
  Sidebar,
  Breadcrumb,
  Search,
} from './index.js';

// ── Tabs ──────────────────────────────────────────────────────────────────

describe('Tabs', () => {
  it('has displayNames', () => {
    expect(TabsList.displayName).toBe('TabsList');
    expect(TabsTrigger.displayName).toBe('TabsTrigger');
    expect(TabsContent.displayName).toBe('TabsContent');
  });
});

// ── NavBar ────────────────────────────────────────────────────────────────

describe('NavBar', () => {
  it('renders logo', () => {
    render(<NavBar logo={<span>Logo</span>} />);
    expect(screen.getByText('Logo')).toBeInTheDocument();
  });

  it('renders left items', () => {
    render(<NavBar leftItems={<button>Dashboard</button>} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders right items', () => {
    render(<NavBar rightItems={<button>Profile</button>} />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('calls onMobileMenuToggle when hamburger clicked', () => {
    const onToggle = vi.fn();
    render(<NavBar onMobileMenuToggle={onToggle} />);
    const menuButton = screen.getByLabelText('Open menu');
    fireEvent.click(menuButton);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows close label when menu is open', () => {
    render(<NavBar mobileMenuOpen onMobileMenuToggle={vi.fn()} />);
    expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
  });
});

// ── Sidebar ───────────────────────────────────────────────────────────────

describe('Sidebar', () => {
  const groups = [
    {
      label: 'Main',
      items: [
        { id: 'dash', label: 'Dashboard', onClick: vi.fn() },
        { id: 'prof', label: 'Profile', active: true, onClick: vi.fn() },
        { id: 'dis', label: 'Disabled', disabled: true, onClick: vi.fn() },
      ],
    },
  ];

  it('renders group labels', () => {
    render(<Sidebar groups={groups} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('renders all items', () => {
    render(<Sidebar groups={groups} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('calls onClick when item clicked', () => {
    const onClick = vi.fn();
    render(
      <Sidebar groups={[{ label: 'Main', items: [{ id: 'item', label: 'Item', onClick }] }]} />,
    );
    fireEvent.click(screen.getByText('Item'));
    expect(onClick).toHaveBeenCalled();
  });

  it('applies collapsed width', () => {
    const { container } = render(<Sidebar groups={groups} collapsed />);
    expect(container.firstChild).toHaveClass('w-16');
  });

  it('hides group labels when collapsed', () => {
    render(<Sidebar groups={groups} collapsed />);
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
  });
});

// ── Breadcrumb ────────────────────────────────────────────────────────────

describe('Breadcrumb', () => {
  it('renders all items', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Page' }]} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Page')).toBeInTheDocument();
  });

  it('renders last item as bold (span)', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />);
    const current = screen.getByText('Current');
    expect(current.tagName).toBe('SPAN');
  });

  it('has nav with aria-label', () => {
    render(<Breadcrumb items={[{ label: 'Home' }]} />);
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot', () => {
    const { container } = render(
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Page' }]} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ── Search ────────────────────────────────────────────────────────────────

describe('Search', () => {
  it('renders input', () => {
    render(<Search />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const handleChange = vi.fn();
    render(<Search onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalledWith('test');
  });

  it('calls onSearch on Enter', () => {
    const handleSearch = vi.fn();
    render(<Search onSearch={handleSearch} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'query' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleSearch).toHaveBeenCalledWith('query');
  });

  it('shows clear button when value exists', () => {
    render(<Search value="test" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('calls onChange with empty on clear', () => {
    const handleChange = vi.fn();
    render(<Search value="test" onChange={handleChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('shows recent searches on focus', () => {
    render(<Search recentSearches={['recent1', 'recent2']} />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('recent1')).toBeInTheDocument();
    expect(screen.getByText('recent2')).toBeInTheDocument();
  });

  it('has aria-label set to placeholder', () => {
    render(<Search placeholder="Find..." />);
    expect(screen.getByLabelText('Find...')).toBeInTheDocument();
  });
});
