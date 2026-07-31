// ──────────────────────────────────────────────────────────────────
// VedMoulya — PrioritiesList Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { PrioritiesList } from '../app/sections/PrioritiesList.js';
import type { Priority } from '../app/sections/types.js';

const meta: Meta<typeof PrioritiesList> = {
  title: 'Dashboard/PrioritiesList',
  component: PrioritiesList,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PrioritiesList>;

const priorities: Priority[] = [
  {
    id: 'p1',
    title: 'Complete Q3 Strategy Project',
    description: 'Finalize the quarterly strategy document.',
    source: 'business',
    priority: 1,
    isBlocked: false,
    category: 'goal',
  },
  {
    id: 'p2',
    title: 'Advance TypeScript Skills',
    description: 'Complete advanced TypeScript learning path.',
    source: 'learning',
    priority: 2,
    isBlocked: false,
    category: 'learning',
  },
  {
    id: 'p3',
    title: 'Update Resume',
    description: 'Add recent achievements and projects.',
    source: 'career',
    priority: 3,
    isBlocked: true,
    category: 'career',
  },
];

export const WithPriorities: Story = { args: { priorities } };
export const Empty: Story = { args: { priorities: [] } };
