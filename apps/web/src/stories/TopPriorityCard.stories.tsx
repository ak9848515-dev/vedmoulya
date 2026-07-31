// ──────────────────────────────────────────────────────────────────
// VedMoulya — TopPriorityCard Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { TopPriorityCard } from '../app/sections/TopPriorityCard.js';
import type { Priority } from '../app/sections/types.js';

const meta: Meta<typeof TopPriorityCard> = {
  title: 'Dashboard/TopPriorityCard',
  component: TopPriorityCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Displays the highest-priority item from the priorities array with blocked/unblocked state.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TopPriorityCard>;

const activePriority: Priority = {
  id: 'p1',
  title: 'Complete Q3 Strategy Project',
  description: 'Finalize the quarterly strategy document and present to stakeholders.',
  source: 'business',
  priority: 1,
  isBlocked: false,
  deadline: '2026-08-15T00:00:00Z',
  category: 'goal',
};

const blockedPriority: Priority = {
  id: 'p2',
  title: 'Deploy Microservices Update',
  description: 'Roll out the latest microservices architecture update to production.',
  source: 'execution',
  priority: 2,
  isBlocked: true,
  category: 'execution',
};

const lowPriority: Priority = {
  id: 'p3',
  title: 'Update Learning Path',
  description: 'Review and update the TypeScript learning path.',
  source: 'learning',
  priority: 4,
  isBlocked: false,
  category: 'learning',
};

export const Active: Story = {
  args: { priority: activePriority },
};

export const Blocked: Story = {
  args: { priority: blockedPriority },
  parameters: {
    docs: {
      description: {
        story: 'Shows a blocked mission with warning icon and "Review Blockers" button.',
      },
    },
  },
};

export const LowPriority: Story = {
  args: { priority: lowPriority },
};

export const NoDeadline: Story = {
  args: { priority: { ...activePriority, deadline: undefined } },
};
