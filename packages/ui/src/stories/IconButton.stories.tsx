// ──────────────────────────────────────────────────────────────────
// VedMoulya — IconButton Stories (separate file)
// BLD-003A Design System Quality & Documentation
// ──────────────────────────────────────────────────────────────────

import type React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Bell, Settings, Share2, Trash2, Heart } from 'lucide-react';
import { IconButton } from '../components/button/index.js';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    rounded: { control: 'boolean' },
    label: { control: 'text', description: 'Required for accessibility (aria-label)' },
  },
  args: {
    onClick: fn(),
    label: 'Icon button',
    icon: <Bell className="h-5 w-5" />,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Circular or rounded button containing only an icon. Requires `label` prop for screen readers.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Primary: Story = {
  args: { variant: 'primary', label: 'Notifications' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
};

export const Ghost: Story = {
  args: { variant: 'ghost', label: 'Share', icon: <Share2 className="h-5 w-5" /> },
};

export const Danger: Story = {
  args: { variant: 'danger', label: 'Delete', icon: <Trash2 className="h-5 w-5" /> },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <IconButton size="sm" label="Small" icon={<Bell className="h-4 w-4" />} />
      <IconButton size="md" label="Medium" icon={<Bell className="h-5 w-5" />} />
      <IconButton size="lg" label="Large" icon={<Bell className="h-6 w-6" />} />
    </div>
  ),
  name: '📐 All Sizes',
};

export const Rounded: Story = {
  render: () => (
    <div className="flex gap-3">
      <IconButton rounded label="Rounded" icon={<Heart className="h-5 w-5" />} />
      <IconButton rounded={false} label="Not Rounded" icon={<Heart className="h-5 w-5" />} />
    </div>
  ),
  name: '⭕ Rounded vs Square',
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Disabled' },
  name: '🔒 Disabled',
};

export const DarkMode: Story = {
  args: { variant: 'ghost', label: 'Dark mode' },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="dark bg-[#0F172A] p-8 rounded-[24px]">
        <Story />
      </div>
    ),
  ],
};
