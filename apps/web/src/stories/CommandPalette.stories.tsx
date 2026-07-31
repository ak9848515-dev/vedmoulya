// ──────────────────────────────────────────────────────────────────
// VedMoulya — CommandPalette Stories
// BLD-016C — Storybook Component Library
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from '../components/CommandPalette.js';

const meta: Meta<typeof CommandPalette> = {
  title: 'Life OS/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Ctrl+K global search modal with keyboard navigation, categorized results, recent searches, and AI-powered suggestions.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommandPalette>;

export const Closed: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-[14px] text-[#64748B]">
        Press Ctrl+K or click the button to open the command palette.
      </p>
      <CommandPalette />
    </div>
  ),
};

export const OpenWithSearch: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The command palette renders as a modal overlay with search input, categorized results, and keyboard navigation hints.',
      },
    },
  },
  render: () => (
    <div className="space-y-4">
      <p className="text-[14px] text-[#64748B]">
        Note: The palette is controlled by Zustand store state.
      </p>
      <CommandPalette />
    </div>
  ),
};
