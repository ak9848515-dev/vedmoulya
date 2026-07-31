// ──────────────────────────────────────────────────────────────────
// VedMoulya — MemoryTimeline Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { MemoryTimeline } from '../app/sections/MemoryTimeline.js';
import type { MemorySummary } from '../app/sections/types.js';

const meta: Meta<typeof MemoryTimeline> = {
  title: 'Dashboard/MemoryTimeline',
  component: MemoryTimeline,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MemoryTimeline>;

const withMemories: MemorySummary = {
  totalMemories: 142,
  recentCount: 5,
  importantEvents: 3,
  aiObservations: [
    'You have several significant memories from this period.',
    'Your memories span diverse areas of life.',
  ],
  reflectionPrompts: [
    'What patterns do you notice in your recent memories?',
    'What are you most grateful for today?',
  ],
};
const empty: MemorySummary = {
  totalMemories: 0,
  recentCount: 0,
  importantEvents: 0,
  aiObservations: [],
  reflectionPrompts: [],
};

export const WithMemories: Story = { args: { memory: withMemories } };
export const Empty: Story = { args: { memory: empty } };
