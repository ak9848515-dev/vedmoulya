// ──────────────────────────────────────────────────────────────────
// VedMoulya — ModuleStatusGrid Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { ModuleStatusGrid } from '../app/sections/ModuleStatusGrid.js';
import type { ModuleSummary } from '../app/sections/types.js';

const meta: Meta<typeof ModuleStatusGrid> = {
  title: 'Dashboard/ModuleStatusGrid',
  component: ModuleStatusGrid,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ModuleStatusGrid>;

const available: ModuleSummary = {
  module: 'career',
  status: 'available',
  summary: 'Career module operational',
  metrics: { score: 78 },
  lastUpdated: '',
  hasNotifications: false,
  notificationCount: 0,
};
const withNotifs: ModuleSummary = {
  module: 'learning',
  status: 'available',
  summary: 'Learning module operational',
  metrics: { progress: 65, streak: 5 },
  lastUpdated: '',
  hasNotifications: true,
  notificationCount: 2,
};
const degraded: ModuleSummary = {
  module: 'business',
  status: 'degraded',
  summary: 'Business module experiencing delays',
  metrics: { risk: 23 },
  lastUpdated: '',
  hasNotifications: false,
  notificationCount: 0,
};
const unavailable: ModuleSummary = {
  module: 'marketplace',
  status: 'unavailable',
  summary: 'Marketplace module unavailable',
  metrics: {},
  lastUpdated: '',
  hasNotifications: false,
  notificationCount: 0,
};

export const AllAvailable: Story = {
  args: {
    career: available,
    learning: withNotifs,
    business: { ...degraded, status: 'available' as const },
    marketplace: { ...unavailable, status: 'available' as const },
  },
};
export const MixedStatus: Story = {
  args: { career: available, learning: withNotifs, business: degraded, marketplace: unavailable },
};
