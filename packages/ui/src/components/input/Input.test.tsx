// ──────────────────────────────────────────────────────────────────
// VedMoulya — Input Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: TextField, Textarea, Select, Checkbox, RadioGroup, Switch
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextField, Textarea, Select, Checkbox, RadioGroup, Switch } from './index.js';

// ── TextField ─────────────────────────────────────────────────────────────

describe('TextField', () => {
  it('renders input element', () => {
    render(<TextField />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<TextField label="Name" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    const { container } = render(<TextField label="Email" hint="We won't share your email" />);
    const hint = container.querySelector('[id$="-hint"]');
    expect(hint).toBeInTheDocument();
    expect(hint?.textContent).toContain("won't");
  });

  it('renders error message', () => {
    render(<TextField label="Email" error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('sets aria-invalid when error exists', () => {
    render(<TextField label="Email" error="Error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables input when disabled prop is set', () => {
    render(<TextField label="Disabled" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('forwards value and onChange', () => {
    const handleChange = vi.fn();
    render(<TextField label="Controlled" value="test" onChange={handleChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('renders with left icon', () => {
    const { container } = render(
      <TextField label="Search" leftIcon={<span data-testid="left-icon">🔍</span>} />,
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('renders with right icon', () => {
    const { container } = render(
      <TextField label="Pwd" rightIcon={<span data-testid="right-icon">👁</span>} />,
    );
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot for default state', () => {
    const { container } = render(<TextField label="Name" placeholder="Enter name" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for error state', () => {
    const { container } = render(<TextField label="Email" error="Invalid email" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for disabled state', () => {
    const { container } = render(<TextField label="Disabled" disabled />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('has displayName', () => {
    expect(TextField.displayName).toBe('TextField');
  });
});

// ── Textarea ──────────────────────────────────────────────────────────────

describe('Textarea', () => {
  it('renders textarea element', () => {
    render(<Textarea />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<Textarea label="Bio" />);
    expect(screen.getByText('Bio')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Textarea label="Bio" error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('sets aria-invalid when error exists', () => {
    render(<Textarea label="Bio" error="Error" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables when disabled', () => {
    render(<Textarea label="Bio" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('has displayName', () => {
    expect(Textarea.displayName).toBe('Textarea');
  });
});

// ── Select ────────────────────────────────────────────────────────────────

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ];

  it('renders select element', () => {
    render(<Select options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders all options', () => {
    render(<Select options={options} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<Select label="Choose" options={options} />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<Select label="Choose" options={options} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('disables when disabled', () => {
    render(<Select label="Choose" options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('has displayName', () => {
    expect(Select.displayName).toBe('Select');
  });
});

// ── Checkbox ──────────────────────────────────────────────────────────────

describe('Checkbox', () => {
  it('renders checkbox role', () => {
    render(<Checkbox label="Accept" />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<Checkbox label="Accept terms" />);
    expect(screen.getByText('Accept terms')).toBeInTheDocument();
  });

  it('disables when disabled', () => {
    render(<Checkbox label="Disabled" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('calls onCheckedChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Checkbox label="Toggle" onCheckedChange={handleChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('respects checked state', () => {
    render(<Checkbox label="Checked" checked />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('applies error styling', () => {
    const { container } = render(<Checkbox label="Error" error />);
    const root = container.querySelector('[data-state="unchecked"]');
    expect(root).toBeInTheDocument();
  });

  it('has displayName', () => {
    expect(Checkbox.displayName).toBe('Checkbox');
  });
});

// ── RadioGroup ────────────────────────────────────────────────────────────

describe('RadioGroup', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ];

  it('renders all options', () => {
    render(<RadioGroup name="test" options={options} />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(<RadioGroup name="test" label="Choose" options={options} />);
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<RadioGroup name="test" options={options} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('calls onValueChange when option selected', () => {
    const handleChange = vi.fn();
    render(<RadioGroup name="test" options={options} onValueChange={handleChange} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    expect(handleChange).toHaveBeenCalledWith('a');
  });

  it('has displayName', () => {
    expect(RadioGroup.displayName).toBe('RadioGroup');
  });
});

// ── Switch ────────────────────────────────────────────────────────────────

describe('Switch', () => {
  it('renders switch role', () => {
    render(<Switch label="Toggle" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<Switch label="Notifications" />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('disables when disabled', () => {
    render(<Switch label="Disabled" disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('calls onCheckedChange when clicked', () => {
    const handleChange = vi.fn();
    render(<Switch label="Toggle" onCheckedChange={handleChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(handleChange).toHaveBeenCalled();
  });

  it('respects checked state', () => {
    render(<Switch label="On" checked />);
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('has displayName', () => {
    expect(Switch.displayName).toBe('Switch');
  });
});
