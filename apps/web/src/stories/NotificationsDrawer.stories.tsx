// ──────────────────────────────────────────────────────────────────
// VedMoulya — NotificationsDrawer Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { NotificationsDrawer } from '../components/NotificationsDrawer.js';

const meta: Meta<typeof NotificationsDrawer> = {
  title: 'Life OS/NotificationsDrawer',
  component: NotificationsDrawer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Right-side notification drawer with type-based styling, filters, and action buttons.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationsDrawer>;

export const Closed: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-[14px] text-[#64748B]">
        Click the bell icon or trigger via Zustand store to open the notification panel.
      </p>
      <NotificationsDrawer />
    </div>
  ),
};
