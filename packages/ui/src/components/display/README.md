# Display Components

## Usage

```tsx
import { Badge, Avatar, Progress, Loading, Skeleton, Divider } from '@vedmoulya/ui';

// Badge — 12 variants, 3 sizes
<Badge variant="success" size="md">Published</Badge>
<Badge variant="ai" size="sm">AI Generated</Badge>
<Badge variant="new">New!</Badge>

// Avatar — with image or initials
<Avatar src="https://example.com/photo.jpg" alt="John Doe" size="lg" status="online" />
<Avatar alt="Sarah Johnson" size="md" /> {/* Shows "SJ" initials */}
<Avatar alt="Profile" fallback="👤" size="xl" />

// Progress bar
<Progress value={75} variant="default" size="md" showLabel />

// Loading spinner
<Loading size="md" label="Loading..." />

// Skeleton placeholder
<Skeleton width="100%" height="16px" rounded="md" />
<Skeleton width="48px" height="48px" rounded="full" /> {/* Avatar skeleton */}

// Divider
<Divider />
<Divider label="Section" />
<Divider orientation="vertical" />
```

## Props Overview

### Badge

| Prop    | Type                   | Default     | Description                                                                                 |
| ------- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| variant | `12 variants`          | `'default'` | default, success, warning, danger, info, ai, premium, draft, published, archived, beta, new |
| size    | `'sm' \| 'md' \| 'lg'` | `'md'`      | Height: 22px / 26px / 30px                                                                  |

### Avatar

| Prop     | Type                                        | Default | Description                   |
| -------- | ------------------------------------------- | ------- | ----------------------------- |
| src      | `string`                                    | —       | Image URL                     |
| alt      | `string` (required)                         | —       | Alt text / initials source    |
| size     | `'sm' \| 'md' \| 'lg' \| 'xl'`              | `'md'`  | Dimensions: 32/40/48/64px     |
| fallback | `string`                                    | —       | Custom fallback (emoji, etc.) |
| status   | `'online' \| 'offline' \| 'away' \| 'busy'` | —       | Status indicator dot          |

### Progress

| Prop      | Type                             | Default     | Description              |
| --------- | -------------------------------- | ----------- | ------------------------ |
| value     | `number` (0-100) (required)      | —           | Progress value (clamped) |
| variant   | `'default' \| 'success' \| 'ai'` | `'default'` | Color variant            |
| size      | `'sm' \| 'md' \| 'lg'`           | `'md'`      | Height: 4px / 6px / 8px  |
| showLabel | `boolean`                        | `false`     | Show percentage label    |

### Loading

| Prop  | Type                   | Default | Description              |
| ----- | ---------------------- | ------- | ------------------------ |
| size  | `'sm' \| 'md' \| 'lg'` | `'md'`  | Spinner size: 16/24/32px |
| label | `string`               | —       | Accessible label text    |

### Skeleton

| Prop    | Type                                     | Default  | Description   |
| ------- | ---------------------------------------- | -------- | ------------- |
| width   | `string`                                 | `'100%'` | CSS width     |
| height  | `string`                                 | `'20px'` | CSS height    |
| rounded | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'`   | Border radius |

### Divider

| Prop        | Type                         | Default        | Description             |
| ----------- | ---------------------------- | -------------- | ----------------------- |
| orientation | `'horizontal' \| 'vertical'` | `'horizontal'` | Direction               |
| label       | `string`                     | —              | Optional centered label |

## Best Practices

- Use **Badge** for status indicators, counts, and labels (not for actions)
- Use **Avatar** with `src` for real user images; initials fallback for missing images
- Prefer **Progress** with `showLabel` for important completion metrics
- Use **Skeleton** for initial page loads; avoid for subsequent data refreshes
- Use **Divider** with `label` to group related sections

## Accessibility

- Progress has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Loading has `role="status"` and the SVG is `aria-hidden="true"`
- Skeleton is `aria-hidden="true"` (purely decorative)
- Divider has `role="separator"` (semi-hidden from accessibility tree)
- Badge uses `<span>` with appropriate color contrast

## Performance Notes

- All components are lightweight and stateless
- Skeleton uses `animate-pulse` CSS animation (no JS)
- Loading uses inline SVG for the spinner (no external assets)

## Engineering Notes

- Badge uses class-variance-authority (`cva`) with 12 color variants
- Avatar initials computed as `alt.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)`
- Progress value is clamped between 0-100 with `Math.max(0, Math.min(100, value))`
- Skeleton supports any CSS dimension string via inline styles
- Divider with label renders as flex container with separator lines

## Design References

- DES-001 Constitution v1.0 — Display components
- DES-010A/D07 Component Behaviour — Loading states
- Avatar: fully rounded, status indicator as border-2 white dot
