# State Components

## Usage

```tsx
import { EmptyState, ErrorState, OfflineState, SuccessState } from '@vedmoulya/ui';

// Empty state
<EmptyState
  title="No items found"
  description="Get started by creating your first item."
  action={{ label: 'Create Item', onClick: handleCreate }}
  secondaryAction={{ label: 'Learn more', onClick: handleLearn }}
/>

// Error state
<ErrorState
  title="Failed to load"
  message="Could not fetch data from the server."
  error={new Error('Network error')}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>

// Offline state
<OfflineState
  title="You're offline"
  message="Your data will sync when you reconnect."
  lastSynced="2 minutes ago"
  onReconnect={handleReconnect}
/>

// Success state
<SuccessState
  title="Saved!"
  message="Your changes have been saved successfully."
  action={{ label: 'View', onClick: handleView }}
  autoDismiss={3000}
  onDismiss={handleDismiss}
/>
```

## Props Overview

### EmptyState

| Prop            | Type                 | Default    | Description          |
| --------------- | -------------------- | ---------- | -------------------- |
| icon            | `React.ReactNode`    | Inbox icon | Custom icon element  |
| title           | `string` (required)  | —          | Main heading         |
| description     | `string`             | —          | Supporting text      |
| action          | `{ label, onClick }` | —          | Primary CTA button   |
| secondaryAction | `{ label, onClick }` | —          | Secondary CTA button |

### ErrorState

| Prop      | Type              | Default                             | Description                         |
| --------- | ----------------- | ----------------------------------- | ----------------------------------- |
| title     | `string`          | `'Something went wrong'`            | Error heading                       |
| message   | `string`          | `'An unexpected error occurred...'` | Error description                   |
| error     | `Error \| string` | —                                   | Technical error details (monospace) |
| onRetry   | `() => void`      | —                                   | Retry callback                      |
| onDismiss | `() => void`      | —                                   | Dismiss callback                    |

### OfflineState

| Prop        | Type         | Default            | Description              |
| ----------- | ------------ | ------------------ | ------------------------ |
| title       | `string`     | `"You're offline"` | Offline heading          |
| message     | `string`     | Contextual message | Description              |
| lastSynced  | `string`     | —                  | Last sync timestamp text |
| onReconnect | `() => void` | —                  | Reconnect callback       |

### SuccessState

| Prop        | Type                 | Default | Description               |
| ----------- | -------------------- | ------- | ------------------------- |
| title       | `string` (required)  | —       | Success heading           |
| message     | `string`             | —       | Success description       |
| action      | `{ label, onClick }` | —       | Optional action link      |
| autoDismiss | `number`             | —       | Auto-dismiss timeout (ms) |
| onDismiss   | `() => void`         | —       | Dismiss callback          |

## Best Practices

- Use **EmptyState** when a list or search has zero results — guide the user to take action
- Use **ErrorState** inline near the failed component for contextual errors
- Use **OfflineState** as a persistent banner during connectivity loss
- Use **SuccessState** as a transient notification (use `autoDismiss` for timed removal)
- Provide **actions** when possible to help users recover from empty/error states

## Accessibility

- ErrorState uses `<Card>` with `border-[#FECACA]` and `bg-[#FEF2F2]` visual distinction
- OfflineState has `role="alert"` for screen reader announcements
- SuccessState has `role="status"` for screen reader announcements
- All interactive elements (buttons, action links) are keyboard accessible
- Error details shown in `<p>` with monospace font for visual distinction

## Performance Notes

- SuccessState supports `autoDismiss` with proper cleanup via `useEffect` return
- All components are lightweight — no external dependencies beyond lucide-react icons
- ErrorState shows error details conditionally only when `error` prop is provided

## Engineering Notes

- EmptyState uses `Card variant="ghost"` for the dashed border container
- ErrorState uses `Card variant="standard"` with red accent classes
- OfflineState and SuccessState are standalone `<div>` elements (not Card-based)
- All components use `'use client'` directive for React hooks
- Icons from lucide-react are `aria-hidden="true"`

## Design References

- DES-010A/D07 Component Behaviour — State specifications
- Empty: ghost card with centered layout
- Error: red card with AlertCircle icon
- Offline: warning yellow with WifiOff icon
- Success: green with CheckCircle2 icon
