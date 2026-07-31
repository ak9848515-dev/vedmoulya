// ──────────────────────────────────────────────────────────────────
// VedMoulya — NotificationsPanel Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { NotificationsPanel } from '../app/sections/NotificationsPanel.js';
import type { Notification } from '../app/sections/types.js';

const meta: Meta<typeof NotificationsPanel> = {
  title: 'Dashboard/NotificationsPanel',
  component: NotificationsPanel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NotificationsPanel>;

const notifs: Notification[] = [
  {
    id: 'n1',
    type: 'info',
    title: 'Career insight available',
    message: 'New skill gap analysis ready for review',
    source: 'Career',
    isRead: false,
    isActionable: true,
    actionLabel: 'View',
    actionRoute: '/career',
    priority: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Learning streak at risk',
    message: "You haven't completed today's learning goal",
    source: 'Learning',
    isRead: false,
    isActionable: true,
    actionLabel: 'Start',
    actionRoute: '/learning',
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n3',
    type: 'success',
    title: 'Project milestone achieved',
    message: 'Q3 Strategy project is 75% complete',
    source: 'Business',
    isRead: true,
    isActionable: false,
    priority: 3,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

export const WithNotifications: Story = { args: { notifications: notifs, unreadCount: 2 } };
export const Empty: Story = { args: { notifications: [], unreadCount: 0 } };
export const AllRead: Story = {
  args: { notifications: notifs.map((n) => ({ ...n, isRead: true })), unreadCount: 0 },
};
