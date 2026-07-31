// ──────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Components Stories
// BLD-003A Design System Quality & Documentation
// Covers: Tabs, NavBar, Sidebar, Breadcrumb, Search
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Home, BookOpen, Activity, User, Settings, Star, Bell } from 'lucide-react';
import React from 'react';
import {
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  NavBar,
  Sidebar,
  Breadcrumb,
  Search,
} from '../components/navigation/Navigation.js';

const meta: Meta = {
  title: 'Components/Navigation',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Navigation components: Tabs, NavBar, Sidebar, Breadcrumb, Search.',
      },
    },
  },
};

export default meta;

// ── Tabs ─────────────────────────────────────────────────────────────────

export const TabsBasic: StoryObj = {
  render: () => (
    <TabsRoot defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Account</TabsTrigger>
        <TabsTrigger value="tab2">Password</TabsTrigger>
        <TabsTrigger value="tab3">Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <div className="p-4 text-[14px] text-[#64748B]">Account settings</div>
      </TabsContent>
      <TabsContent value="tab2">
        <div className="p-4 text-[14px] text-[#64748B]">Password settings</div>
      </TabsContent>
      <TabsContent value="tab3">
        <div className="p-4 text-[14px] text-[#64748B]">Notification preferences</div>
      </TabsContent>
    </TabsRoot>
  ),
  name: 'Tabs — Basic',
};

export const TabsWithDisabled: StoryObj = {
  render: () => (
    <TabsRoot defaultValue="tab1">
      <TabsList>
        <TabsTrigger value="tab1">Active</TabsTrigger>
        <TabsTrigger value="tab2" disabled>
          Disabled
        </TabsTrigger>
        <TabsTrigger value="tab3">Another</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">
        <div className="p-4 text-[14px] text-[#64748B]">Active content</div>
      </TabsContent>
      <TabsContent value="tab2">
        <div className="p-4 text-[14px] text-[#64748B]">Disabled</div>
      </TabsContent>
      <TabsContent value="tab3">
        <div className="p-4 text-[14px] text-[#64748B]">Another tab</div>
      </TabsContent>
    </TabsRoot>
  ),
  name: 'Tabs — With Disabled Tab',
};

export const TabsDarkMode: StoryObj = {
  render: () => (
    <div className="dark bg-[#0F172A] p-8 rounded-[24px]">
      <TabsRoot defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">
          <div className="p-4 text-[14px] text-[#94A3B8]">Dark mode content</div>
        </TabsContent>
        <TabsContent value="tab2">
          <div className="p-4 text-[14px] text-[#94A3B8]">Tab 2</div>
        </TabsContent>
      </TabsRoot>
    </div>
  ),
  name: 'Tabs — Dark Mode',
};

// ── NavBar ────────────────────────────────────────────────────────────────

export const NavBarDefault: StoryObj = {
  render: () => (
    <NavBar
      logo={<span className="text-[18px] font-bold text-[#2B5FD9]">VedMoulya</span>}
      leftItems={
        <>
          <button className="px-3 py-2 text-[14px] font-medium text-[#64748B]">Dashboard</button>
          <button className="px-3 py-2 text-[14px] font-medium text-[#64748B]">Projects</button>
        </>
      }
      rightItems={
        <>
          <button className="p-2" aria-label="Notifications">
            <Bell className="h-5 w-5 text-[#64748B]" />
          </button>
        </>
      }
      onMobileMenuToggle={fn()}
    />
  ),
  name: 'NavBar',
};

// ── Sidebar ───────────────────────────────────────────────────────────────

const sidebarGroups = [
  {
    label: 'Main',
    items: [
      {
        id: 'dash',
        label: 'Dashboard',
        icon: <Home className="h-5 w-5" />,
        active: true,
        badge: 3,
        onClick: fn(),
      },
      { id: 'proj', label: 'Projects', icon: <BookOpen className="h-5 w-5" />, onClick: fn() },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: <Activity className="h-5 w-5" />,
        badge: 'New',
        onClick: fn(),
      },
    ],
  },
  {
    label: 'Personal',
    items: [
      { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" />, onClick: fn() },
      { id: 'settings', label: 'Settings', icon: <Settings className="h-5 w-5" />, onClick: fn() },
      {
        id: 'disabled',
        label: 'Disabled',
        icon: <Star className="h-5 w-5" />,
        disabled: true,
        onClick: fn(),
      },
    ],
  },
];

export const SidebarExpanded: StoryObj = {
  render: () => (
    <div className="h-[500px]">
      <Sidebar groups={sidebarGroups} collapsed={false} />
    </div>
  ),
  name: 'Sidebar — Expanded',
};

export const SidebarCollapsed: StoryObj = {
  render: () => (
    <div className="h-[500px]">
      <Sidebar groups={sidebarGroups} collapsed />
    </div>
  ),
  name: 'Sidebar — Collapsed',
};

// ── Breadcrumb ────────────────────────────────────────────────────────────

export const BreadcrumbDefault: StoryObj = {
  render: () => (
    <Breadcrumb
      items={[
        { label: 'Home', href: '/' },
        { label: 'Projects', href: '/projects' },
        { label: 'Design System' },
      ]}
    />
  ),
  name: 'Breadcrumb',
};

export const BreadcrumbLong: StoryObj = {
  render: () => (
    <Breadcrumb
      items={[
        { label: 'Home', href: '/' },
        { label: 'Products', href: '/products' },
        { label: 'SaaS', href: '/products/saas' },
        { label: 'Settings', href: '/products/saas/settings' },
        { label: 'Integrations' },
      ]}
    />
  ),
  name: 'Breadcrumb — Long Path',
};

// ── Search ────────────────────────────────────────────────────────────────

export const SearchDefault: StoryObj = {
  render: () => (
    <Search
      placeholder="Search..."
      recentSearches={['Design tokens', 'Button component', 'Dark mode']}
      onChange={fn()}
      onSearch={fn()}
    />
  ),
  name: 'Search',
};

export const SearchWithValue: StoryObj = {
  render: () => <Search value="design system" onChange={fn()} onSearch={fn()} />,
  name: 'Search — With Value',
};

export const SearchNoRecent: StoryObj = {
  render: () => <Search placeholder="Search..." onChange={fn()} onSearch={fn()} />,
  name: 'Search — No Recent Searches',
};
