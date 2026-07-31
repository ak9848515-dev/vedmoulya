// ──────────────────────────────────────────────────────────────────
// VedMoulya — JourneyOverview Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { JourneyOverview } from '../app/sections/JourneyOverview.js';

const meta: Meta<typeof JourneyOverview> = {
  title: 'Dashboard/JourneyOverview',
  component: JourneyOverview,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof JourneyOverview>;

export const Active: Story = {
  args: {
    execution: { completedToday: 3, activePlans: 4, totalEstimatedMinutes: 180 },
    metrics: {
      lifeScore: 76,
      streak: 5,
      weeklyCompletion: 4,
      monthlyCompletion: 15,
      consistency: 70,
      momentum: 65,
    },
  },
};

export const JustStarting: Story = {
  args: {
    execution: { completedToday: 0, activePlans: 0, totalEstimatedMinutes: 0 },
    metrics: { lifeScore: 0 },
  },
};
