# Button & IconButton

## Usage

```tsx
import { Button, IconButton } from '@vedmoulya/ui';
import { Settings, Bell } from 'lucide-react';

// Primary action
<Button variant="primary" size="md" onClick={handleClick}>
  Submit
</Button>

// With icon
<Button variant="secondary" icon={<Settings className="h-4 w-4" />}>
  Settings
</Button>

// Loading state
<Button variant="primary" loading>
  Saving...
</Button>

// Icon button (requires aria-label)
<IconButton label="Notifications" icon={<Bell />} variant="ghost" />
```

## Props

### Button

| Prop         | Type                                                      | Default     | Description                          |
| ------------ | --------------------------------------------------------- | ----------- | ------------------------------------ |
| variant      | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'ai'` | `'primary'` | Visual style variant                 |
| size         | `'sm' \| 'md' \| 'lg' \| 'xl'`                            | `'md'`      | Button size                          |
| fullWidth    | `boolean`                                                 | `false`     | Stretch to full width                |
| loading      | `boolean`                                                 | `false`     | Show loading spinner, sets aria-busy |
| disabled     | `boolean`                                                 | `false`     | Disable the button                   |
| icon         | `React.ReactNode`                                         | —           | Icon element                         |
| iconPosition | `'left' \| 'right'`                                       | `'left'`    | Icon placement                       |

### IconButton

| Prop    | Type                                              | Default   | Description                   |
| ------- | ------------------------------------------------- | --------- | ----------------------------- |
| variant | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'ghost'` | Visual style                  |
| size    | `'sm' \| 'md' \| 'lg'`                            | `'md'`    | Button size                   |
| rounded | `boolean`                                         | `false`   | Make fully rounded (circular) |
| label   | `string` (required)                               | —         | aria-label for accessibility  |
| icon    | `React.ReactNode` (required)                      | —         | Icon element                  |

## Variants

| Variant       | Use Case                                  |
| ------------- | ----------------------------------------- |
| **primary**   | Main call-to-action (blue bg, white text) |
| **secondary** | Alternative actions (white bg, bordered)  |
| **ghost**     | Low emphasis actions (transparent)        |
| **danger**    | Destructive actions (red bg)              |
| **ai**        | AI-powered actions (purple with glow)     |

## Sizes

| Size | Height      | Padding | Font |
| ---- | ----------- | ------- | ---- |
| sm   | 32px (h-8)  | px-3    | 13px |
| md   | 40px (h-10) | px-4    | 14px |
| lg   | 48px (h-12) | px-5    | 15px |
| xl   | 56px (h-14) | px-6    | 16px |

## Best Practices

- **Always provide `aria-label`** on IconButton since it has no visible text
- Use **loading state** for async operations to prevent double-clicks
- Prefer **primary** for the main action per screen
- Use **danger** for irreversible actions (delete, remove)
- Use **fullWidth** sparingly — typically only on mobile layouts
- Maintain **14px border-radius** on all variants (DES-001 Constitution)

## Accessibility

- All buttons have native `<button>` role
- Loading state sets `aria-busy="true"` and disables the button
- IconButton requires `label` prop → becomes `aria-label`
- Focus-visible ring using `outline-2 outline-offset-2 outline-[#2B5FD9]`
- Supports keyboard activation (Enter, Space)

## Performance Notes

- `Button` uses `forwardRef` for ref forwarding
- Class variance authority (`cva`) ensures minimal CSS overhead
- Loading state replaces `children` with a `Loader2` spinner icon

## Engineering Notes

- Both components use `'use client'` directive for Next.js App Router
- Styled with Tailwind CSS v4 via class-variance-authority
- IconButton sizes: sm (32px), md (40px), lg (48px)
- Disabled state applies `opacity-40` and `pointer-events-none`

## Design References

- DES-001 Constitution v1.0 — Button section
- DES-010A/D07 Component Behaviour — Button specifications
- Radius: 14px ALL button variants (FROZEN)
