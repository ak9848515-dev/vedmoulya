// ──────────────────────────────────────────────────────────────────
// VedMoulya — Input Components Stories
// BLD-003A Design System Quality & Documentation
// Covers: TextField, Textarea, Select, Checkbox, RadioGroup, Switch
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { Search, EyeOff } from 'lucide-react';
import React from 'react';
import { TextField } from '../components/input/TextField.js';
import { Textarea } from '../components/input/Textarea.js';
import { Select } from '../components/input/Select.js';
import { Checkbox } from '../components/input/Checkbox.js';
import { RadioGroup } from '../components/input/Radio.js';
import { Switch } from '../components/input/Switch.js';

const meta: Meta<typeof TextField> = {
  title: 'Components/Input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Input components: TextField, Textarea, Select, Checkbox, RadioGroup, Switch.',
      },
    },
  },
};

export default meta;

// ── TextField ─────────────────────────────────────────────────────────────

export const TextFieldDefault: StoryObj = {
  render: () => <TextField label="Name" placeholder="Enter your name" />,
  name: 'TextField — Default',
};

export const TextFieldWithHint: StoryObj = {
  render: () => (
    <TextField
      label="Email"
      placeholder="you@example.com"
      hint="We\'ll never share your email."
      type="email"
    />
  ),
  name: 'TextField — With Hint',
};

export const TextFieldWithError: StoryObj = {
  render: () => (
    <TextField
      label="Email"
      placeholder="you@example.com"
      error="Please enter a valid email address"
      value="invalid"
    />
  ),
  name: 'TextField — With Error',
};

export const TextFieldSuccess: StoryObj = {
  render: () => <TextField label="Username" placeholder="johndoe" success value="johndoe" />,
  name: 'TextField — Success State',
};

export const TextFieldDisabled: StoryObj = {
  render: () => <TextField label="Disabled" placeholder="Cannot edit" disabled value="Read-only" />,
  name: 'TextField — Disabled',
};

export const TextFieldWithIcons: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <TextField label="Search" placeholder="Search..." leftIcon={<Search className="h-4 w-4" />} />
      <TextField
        label="Password"
        placeholder="Enter password"
        type="password"
        rightIcon={<EyeOff className="h-4 w-4" />}
      />
    </div>
  ),
  name: 'TextField — With Icons',
};

export const TextFieldLarge: StoryObj = {
  render: () => <TextField label="Full Name" placeholder="Enter your full name" size="lg" />,
  name: 'TextField — Large Size',
};

// ── Textarea ──────────────────────────────────────────────────────────────

export const TextareaDefault: StoryObj = {
  render: () => <Textarea label="Message" placeholder="Write your message..." />,
  name: 'Textarea — Default',
};

export const TextareaWithError: StoryObj = {
  render: () => <Textarea label="Bio" error="Bio must be at least 10 characters." value="Short" />,
  name: 'Textarea — With Error',
};

export const TextareaDisabled: StoryObj = {
  render: () => <Textarea label="Disabled" disabled value="This textarea is disabled." />,
  name: 'Textarea — Disabled',
};

export const TextareaSuccess: StoryObj = {
  render: () => <Textarea label="Description" success value="Everything looks good!" />,
  name: 'Textarea — Success State',
};

// ── Select ────────────────────────────────────────────────────────────────

const selectOptions = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
  { value: 'disabled', label: 'Disabled Option', disabled: true },
];

export const SelectDefault: StoryObj = {
  render: () => <Select label="Choose an option" options={selectOptions} placeholder="Select..." />,
  name: 'Select — Default',
};

export const SelectWithError: StoryObj = {
  render: () => (
    <Select
      label="Country"
      options={selectOptions}
      error="Please select a country."
      placeholder="Select..."
    />
  ),
  name: 'Select — With Error',
};

export const SelectDisabled: StoryObj = {
  render: () => (
    <Select label="Disabled" options={selectOptions} disabled placeholder="Select..." />
  ),
  name: 'Select — Disabled',
};

// ── Checkbox ──────────────────────────────────────────────────────────────

export const CheckboxUnchecked: StoryObj = {
  render: () => <Checkbox label="Accept terms and conditions" />,
  name: 'Checkbox — Unchecked',
};

export const CheckboxChecked: StoryObj = {
  render: () => <Checkbox label="Accept terms" checked />,
  name: 'Checkbox — Checked',
};

export const CheckboxDisabled: StoryObj = {
  render: () => <Checkbox label="Disabled option" disabled />,
  name: 'Checkbox — Disabled',
};

export const CheckboxError: StoryObj = {
  render: () => <Checkbox label="Required field" error />,
  name: 'Checkbox — Error State',
};

export const CheckboxGroup: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Checkbox label="Option A" />
      <Checkbox label="Option B" checked />
      <Checkbox label="Option C" />
      <Checkbox label="Option D (disabled)" disabled />
    </div>
  ),
  name: 'Checkbox — 📋 Group',
};

// ── RadioGroup ────────────────────────────────────────────────────────────

const radioOptions = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
  { value: 'c', label: 'Option C' },
];

export const RadioVertical: StoryObj = {
  render: () => (
    <RadioGroup name="rg1" label="Select an option" options={radioOptions} direction="vertical" />
  ),
  name: 'Radio — Vertical',
};

export const RadioHorizontal: StoryObj = {
  render: () => (
    <RadioGroup
      name="rg2"
      label="Select size"
      options={[
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ]}
      direction="horizontal"
    />
  ),
  name: 'Radio — Horizontal',
};

export const RadioDisabled: StoryObj = {
  render: () => (
    <RadioGroup
      name="rg3"
      label="Disabled group"
      options={radioOptions}
      disabled
      direction="vertical"
    />
  ),
  name: 'Radio — Disabled',
};

export const RadioWithError: StoryObj = {
  render: () => (
    <RadioGroup
      name="rg4"
      label="Selection required"
      options={radioOptions}
      error="Please select an option."
      direction="vertical"
    />
  ),
  name: 'Radio — With Error',
};

// ── Switch ────────────────────────────────────────────────────────────────

export const SwitchOff: StoryObj = {
  render: () => <Switch label="Notifications" />,
  name: 'Switch — Off',
};

export const SwitchOn: StoryObj = {
  render: () => <Switch label="Dark mode" checked />,
  name: 'Switch — On',
};

export const SwitchDisabled: StoryObj = {
  render: () => <Switch label="Disabled" disabled />,
  name: 'Switch — Disabled',
};

export const SwitchGroup: StoryObj = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Switch label="Push notifications" />
      <Switch label="Email notifications" checked />
      <Switch label="Legacy alerts (disabled)" disabled />
    </div>
  ),
  name: 'Switch — 📋 Group',
};
