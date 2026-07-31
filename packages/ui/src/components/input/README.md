# Input Components

## Usage

```tsx
import { TextField, Textarea, Select, Checkbox, RadioGroup, Switch } from '@vedmoulya/ui';

// Text input with label and error
<TextField
  label="Email"
  type="email"
  placeholder="you@example.com"
  error="Please enter a valid email"
  leftIcon={<Mail className="h-4 w-4" />}
/>

// Textarea
<Textarea label="Bio" placeholder="Tell us about yourself..." rows={4} />

// Select
<Select
  label="Country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ]}
  placeholder="Select..."
/>

// Checkbox
<Checkbox label="Accept terms and conditions" />

// Radio group
<RadioGroup
  label="Plan"
  options={[
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
  ]}
  direction="vertical"
/>

// Switch toggle
<Switch label="Enable notifications" />
```

## Props Overview

### TextField

| Prop      | Type              | Default | Description                            |
| --------- | ----------------- | ------- | -------------------------------------- |
| label     | `string`          | —       | Input label                            |
| hint      | `string`          | —       | Helper text below input                |
| error     | `string`          | —       | Error message (also sets aria-invalid) |
| success   | `boolean`         | —       | Green border state                     |
| size      | `'md' \| 'lg'`    | `'md'`  | Input height (44px / 52px)             |
| leftIcon  | `React.ReactNode` | —       | Icon on left side                      |
| rightIcon | `React.ReactNode` | —       | Icon on right side                     |

### Textarea — same as TextField without size/icon props. Min-height: 80px.

### Select

| Prop        | Type                        | Default | Description                          |
| ----------- | --------------------------- | ------- | ------------------------------------ |
| options     | `SelectOption[]` (required) | —       | Array of { value, label, disabled? } |
| placeholder | `string`                    | —       | Placeholder option                   |
| label       | `string`                    | —       | Select label                         |
| error       | `string`                    | —       | Error message                        |
| size        | `'md' \| 'lg'`              | `'md'`  | Select height                        |

### Checkbox

| Prop            | Type                         | Default | Description              |
| --------------- | ---------------------------- | ------- | ------------------------ |
| label           | `string`                     | —       | Checkbox label           |
| checked         | `boolean`                    | —       | Controlled checked state |
| defaultChecked  | `boolean`                    | —       | Initial unchecked state  |
| onCheckedChange | `(checked: boolean) => void` | —       | Change handler           |
| disabled        | `boolean`                    | —       | Disable the checkbox     |
| error           | `boolean`                    | —       | Error styling            |

### RadioGroup

| Prop          | Type                         | Default      | Description                          |
| ------------- | ---------------------------- | ------------ | ------------------------------------ |
| options       | `RadioOption[]` (required)   | —            | Array of { value, label, disabled? } |
| direction     | `'vertical' \| 'horizontal'` | `'vertical'` | Layout direction                     |
| value         | `string`                     | —            | Controlled value                     |
| onValueChange | `(value: string) => void`    | —            | Change handler                       |
| error         | `string`                     | —            | Error message                        |

### Switch

| Prop            | Type                         | Default | Description              |
| --------------- | ---------------------------- | ------- | ------------------------ |
| label           | `string`                     | —       | Toggle label             |
| checked         | `boolean`                    | —       | Controlled checked state |
| onCheckedChange | `(checked: boolean) => void` | —       | Change handler           |
| disabled        | `boolean`                    | —       | Disable the switch       |

## Best Practices

- Always provide a **label** for form fields for accessibility
- Use **hint** for helpful context, **error** for validation feedback
- Combine **leftIcon** with text fields for search, email, etc.
- Use **RadioGroup** for 2-5 options; use Select for more
- Use **Switch** for binary settings, not as a substitute for Checkbox

## Accessibility

- All inputs use `<label>` with `htmlFor`/`id` association
- Error states set `aria-invalid="true"` and use `role="alert"` on messages
- Inputs with hints use `aria-describedby` to link hint text
- Checkbox, RadioGroup, and Switch use Radix UI primitives for ARIA compliance
- Switch has `role="switch"` with `aria-checked`

## Performance Notes

- All components use `useId()` for stable SSR-compatible IDs
- Inputs forward refs for form library integration (react-hook-form, etc.)
- Radix UI primitives handle focus management and keyboard navigation

## Engineering Notes

- Height: 44px (md) / 52px (lg) — matches Select
- Border-radius: 16px (DES-001 Constitution)
- TextField and Textarea use `'use client'` directive
- Icons are `aria-hidden="true"` to avoid screen reader distraction

## Design References

- DES-001 Constitution v1.0 — Input section
- DES-010A/D07 Component Behaviour — Input specifications
- Radius: 16px, Label: 14px font-medium
