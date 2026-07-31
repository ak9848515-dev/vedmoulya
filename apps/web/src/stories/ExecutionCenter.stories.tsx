// ──────────────────────────────────────────────────────────────────
// VedMoulya — ExecutionCenter Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { ExecutionCenter } from '../app/sections/ExecutionCenter.js';
import type { ExecutionSummary } from '../app/sections/types.js';

const meta: Meta<typeof ExecutionCenter> = {
  title: 'Dashboard/ExecutionCenter',
  component: ExecutionCenter,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ExecutionCenter>;

const active: ExecutionSummary = {
  activePlans: 4,
  blockedPlans: 0,
  completedToday: 3,
  totalEstimatedMinutes: 180,
  recoverySuggestions: [],
};
const blocked: ExecutionSummary = {
  activePlans: 3,
  blockedPlans: 2,
  completedToday: 1,
  totalEstimatedMinutes: 120,
  recoverySuggestions: ['Unblock deployment pipeline', 'Review resource allocation'],
};
const empty: ExecutionSummary = {
  activePlans: 0,
  blockedPlans: 0,
  completedToday: 0,
  totalEstimatedMinutes: 0,
  recoverySuggestions: [],
};

export const Active: Story = { args: { execution: active } };
export const WithBlocked: Story = {
  args: { execution: blocked },
  parameters: {
    docs: {
      description: {
        story: 'Shows blocked plans with warning indicators and recovery suggestions.',
      },
    },
  },
};
export const Empty: Story = { args: { execution: empty } };
