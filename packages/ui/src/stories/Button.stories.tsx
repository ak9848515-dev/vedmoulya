// ──────────────────────────────────────────────────────────────────
// VedMoulya — Button Stories
// BLD-003A Design System Quality & Documentation
// Covers: all variants, sizes, states, light/dark, responsive,
//         accessibility, interaction, loading, error, empty examples
// ──────────────────────────────────────────────────────────────────

import type React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Bell, Plus, Settings, Send, Trash2 } from 'lucide-react';
import { Button } from '../components/button/index.js';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger', 'ai'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Button size',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to full width',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading spinner',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
    iconPosition: {
      control: 'select',
      options: ['left', 'right'],
      description: 'Icon placement relative to text',
    },
    children: {
      control: 'text',
      description: 'Button label content',
    },
  },
  args: {
    onClick: fn(),
    children: 'Click me',
  },
  parameters: {
    docs: {
      description: {
        component:
          'Primary action component with 5 variants, 4 sizes, and loading state. All variants use 14px border-radius per DES-001 Constitution.',
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'button-name', enabled: true },
          { id: 'color-contrast', enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ── Variants ───────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: { variant: 'primary', children: 'Primary Button' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Secondary Button' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ghost Button' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete' },
};

export const AI: Story = {
  args: { variant: 'ai', children: 'Ask AI' },
};

// ── Sizes ──────────────────────────────────────────────────────────────────

export const SizeSm: Story = {
  args: { size: 'sm', children: 'Small' },
};

export const SizeMd: Story = {
  args: { size: 'md', children: 'Medium' },
};

export const SizeLg: Story = {
  args: { size: 'lg', children: 'Large' },
};

export const SizeXl: Story = {
  args: { size: 'xl', children: 'Extra Large' },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4 flex-wrap">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
  name: '📐 All Sizes',
};

// ── States ─────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: { disabled: true, children: 'Disabled' },
};

export const Loading: Story = {
  args: { loading: true, children: 'Loading...' },
};

export const FullWidth: Story = {
  args: { fullWidth: true, children: 'Full Width Button' },
};

export const DisabledAllVariants: Story = {
  render: () => (
    <div className="flex gap-3 flex-wrap">
      <Button variant="primary" disabled>
        Primary
      </Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
      <Button variant="danger" disabled>
        Danger
      </Button>
      <Button variant="ai" disabled>
        AI
      </Button>
    </div>
  ),
  name: '🔒 Disabled — All Variants',
};

// ── With Icons ─────────────────────────────────────────────────────────────

export const WithLeftIcon: Story = {
  args: { children: 'Settings', icon: <Settings className="h-4 w-4" />, iconPosition: 'left' },
};

export const WithRightIcon: Story = {
  args: { children: 'Send', icon: <Send className="h-4 w-4" />, iconPosition: 'right' },
};

export const IconOnly: Story = {
  args: { children: undefined, icon: <Plus className="h-4 w-4" />, 'aria-label': 'Add item' },
};

// ── Responsive ─────────────────────────────────────────────────────────────

export const ResponsiveExample: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-[12px] text-[#64748B]">Resize viewport to see responsive behavior</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button fullWidth className="sm:w-auto" variant="primary">
          Mobile Full Width
        </Button>
        <Button fullWidth className="sm:w-auto" variant="secondary">
          Also Full on Mobile
        </Button>
      </div>
    </div>
  ),
  name: '📱 Responsive Example',
};

// ── Accessibility ──────────────────────────────────────────────────────────

export const AccessibilityExample: Story = {
  render: () => (
    <div className="space-y-4">
      <Button aria-describedby="btn-desc-1" variant="primary">
        Submit Form
      </Button>
      <p id="btn-desc-1" className="text-[12px] text-[#64748B]">
        This button submits the form after validation — described by this text via aria-describedby.
      </p>
      <div className="flex gap-3 mt-4">
        <Button variant="ghost" aria-label="Close dialog" icon={<Trash2 className="h-4 w-4" />} />
        <Button variant="ghost" aria-label="Notifications" icon={<Bell className="h-4 w-4" />} />
      </div>
    </div>
  ),
  name: '♿ Accessibility Example',
};

// ── Dark Mode ──────────────────────────────────────────────────────────────

export const DarkMode: Story = {
  decorators: [
    (Story): React.JSX.Element => (
      <div className="dark bg-[#0F172A] p-8 rounded-[24px]">
        <Story />
      </div>
    ),
  ],
  args: { variant: 'primary', children: 'Dark Mode Button' },
};

// ── All Variants Grid ──────────────────────────────────────────────────────

export const AllVariantsGrid: Story = {
  render: () => (
    <div className="space-y-6">
      {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <div key={size} className="flex gap-3 items-center flex-wrap">
          <span className="text-[12px] text-[#64748B] w-10 font-mono">{size}</span>
          <Button size={size} variant="primary">
            Primary
          </Button>
          <Button size={size} variant="secondary">
            Secondary
          </Button>
          <Button size={size} variant="ghost">
            Ghost
          </Button>
          <Button size={size} variant="danger">
            Danger
          </Button>
          <Button size={size} variant="ai">
            AI
          </Button>
        </div>
      ))}
    </div>
  ),
  name: '📊 All Variants × Sizes',
};
