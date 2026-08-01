// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Navigation components tests
// Follows DES-001/D07 Component System
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  NavBar,
  Sidebar,
  Breadcrumb,
  Search,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
} from './Navigation.js';

describe('NavBar', () => {
  it('renders logo, left items, and right items', () => {
    render(
      <NavBar
        logo={<span data-testid="logo">Logo</span>}
        leftItems={<a href="/">Home</a>}
        rightItems={<button>Profile</button>}
      />,
    );
    expect(screen.getByTestId('logo')).toBeDefined();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Profile')).toBeDefined();
  });

  it('toggles the mobile menu icon and fires the toggle handler', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<NavBar onMobileMenuToggle={onToggle} mobileMenuOpen={false} />);
    const button = screen.getByLabelText('Open menu');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<NavBar onMobileMenuToggle={onToggle} mobileMenuOpen />);
    expect(screen.getByLabelText('Close menu')).toBeDefined();
  });
});

describe('Sidebar', () => {
  const groups = [
    {
      label: 'Main',
      items: [
        { id: 'home', label: 'Home', active: true },
        { id: 'settings', label: 'Settings', badge: 3 },
        { id: 'disabled', label: 'Disabled', disabled: true },
      ],
    },
  ];

  it('renders group labels and items', () => {
    render(<Sidebar groups={groups} />);
    expect(screen.getByText('Main')).toBeDefined();
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('fires item click handlers', () => {
    const onClick = vi.fn();
    render(<Sidebar groups={[{ label: 'G', items: [{ id: 'x', label: 'Click me', onClick }] }]} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides labels when collapsed and sets aria labels', () => {
    render(<Sidebar groups={groups} collapsed />);
    expect(screen.queryByText('Main')).toBeNull();
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.getByLabelText('Home')).toBeDefined();
    expect(screen.getByTitle('Home')).toBeDefined();
  });

  it('disables items marked disabled', () => {
    render(<Sidebar groups={groups} />);
    const disabled = screen.getByText('Disabled').closest('button');
    expect(disabled?.hasAttribute('disabled')).toBe(true);
  });
});

describe('Breadcrumb', () => {
  it('renders items with separators and highlights the last item', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Settings' }]} />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('renders a single item without a separator', () => {
    render(<Breadcrumb items={[{ label: 'Only' }]} />);
    expect(screen.getByText('Only')).toBeDefined();
  });

  it('renders an anchor for non-last items with href', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/home' }, { label: 'Page' }]} />);
    const link = screen.getByText('Home').closest('a');
    expect(link?.getAttribute('href')).toBe('/home');
  });
});

describe('Search', () => {
  it('renders the input with the given placeholder and value', () => {
    render(<Search value="query" placeholder="Find..." />);
    const input = screen.getByLabelText('Find...');
    expect((input as HTMLInputElement).value).toBe('query');
  });

  it('fires onChange while typing and onSearch on Enter', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(<Search onChange={onChange} onSearch={onSearch} />);
    const input = screen.getByLabelText('Search...');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('clears the value and refocuses when clear is clicked', () => {
    const onChange = vi.fn();
    render(<Search value="text" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows recent searches on focus when provided', () => {
    render(<Search recentSearches={['recent-a', 'recent-b']} />);
    const input = screen.getByLabelText('Search...');
    fireEvent.focus(input);
    expect(screen.getByText('Recent')).toBeDefined();
    expect(screen.getByText('recent-a')).toBeDefined();
  });

  it('selecting a recent search fires onChange and onSearch', () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(<Search recentSearches={['pick-me']} onChange={onChange} onSearch={onSearch} />);
    fireEvent.focus(screen.getByLabelText('Search...'));
    fireEvent.click(screen.getByText('pick-me'));
    expect(onChange).toHaveBeenCalledWith('pick-me');
    expect(onSearch).toHaveBeenCalledWith('pick-me');
  });
});

describe('Tabs primitives', () => {
  it('renders TabsList, TabsTrigger, and TabsContent inside a Root', () => {
    render(
      <TabsRoot defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Content A</TabsContent>
        <TabsContent value="b">Content B</TabsContent>
      </TabsRoot>,
    );
    expect(screen.getByText('Tab A')).toBeDefined();
    expect(screen.getByText('Tab B')).toBeDefined();
    expect(screen.getByText('Content A')).toBeDefined();
  });
});
