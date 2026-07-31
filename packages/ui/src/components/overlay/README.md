# Overlay Components

## Usage

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@vedmoulya/ui';
import { Drawer, DrawerTrigger, DrawerContent, DrawerOverlay } from '@vedmoulya/ui';
import { BottomSheet, BottomSheetTrigger, BottomSheetContent } from '@vedmoulya/ui';
import { ToastProvider, useToast, Snackbar } from '@vedmoulya/ui';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vedmoulya/ui';

// Dialog
<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent size="md">
      <DialogHeader>
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description text</DialogDescription>
      </DialogHeader>
      {/* Content here */}
      <DialogFooter>
        <DialogTrigger asChild><Button variant="secondary">Cancel</Button></DialogTrigger>
        <Button variant="primary">Save</Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal>
</Dialog>

// Drawer (slides from right)
<Drawer>
  <DrawerTrigger asChild><Button>Open</Button></DrawerTrigger>
  <DrawerOverlay />
  <DrawerContent side="right" size="md">
    <div>Drawer content</div>
  </DrawerContent>
</Drawer>

// Toast
<ToastProvider>
  <ToastTrigger />
</ToastProvider>

// Snackbar (inline)
<Snackbar message="Saved!" type="success" action={{ label: 'Undo', onClick: handleUndo }} />

// Tooltip
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button>Hover</Button></TooltipTrigger>
    <TooltipContent>Tooltip text</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Props Overview

### DialogContent

| Prop | Type                   | Default | Description                                |
| ---- | ---------------------- | ------- | ------------------------------------------ |
| size | `'sm' \| 'md' \| 'lg'` | `'md'`  | Max-width: sm(384px), md(512px), lg(672px) |

### DrawerContent

| Prop | Type                   | Default   | Description                            |
| ---- | ---------------------- | --------- | -------------------------------------- |
| side | `'left' \| 'right'`    | `'right'` | Slide direction                        |
| size | `'sm' \| 'md' \| 'lg'` | `'md'`    | Width: sm(320px), md(400px), lg(600px) |

### Snackbar

| Prop    | Type                                             | Default     | Description            |
| ------- | ------------------------------------------------ | ----------- | ---------------------- |
| message | `string` (required)                              | —           | Notification text      |
| type    | `'default' \| 'success' \| 'error' \| 'warning'` | `'default'` | Visual style           |
| action  | `{ label: string; onClick: () => void }`         | —           | Optional action button |

## Accessibility

- Dialog uses Radix UI Dialog with focus trapping, escape key, and overlay click to close
- Close buttons have `sr-only` "Close" text for screen readers
- DialogContent uses `DialogTitle` and `DialogDescription` for ARIA labelling
- BottomSheet includes a drag handle for visual affordance
- Snackbar has `role="alert"` for screen reader announcements
- Tooltip uses Radix UI Tooltip with keyboard hover support

## Best Practices

- Use **Dialog** for critical confirmations or forms that require attention
- Use **Drawer** for side panels (settings, details, filters)
- Use **BottomSheet** on mobile for action sheets or pickers
- Use **Toast** for temporary notifications (auto-dismiss 5s)
- Wrap your app in `<TooltipProvider>` at the root level

## Performance Notes

- All overlays use Radix UI primitives with portal-based rendering
- Animations use CSS `data-[state]` attributes for enter/exit transitions
- Toast system uses context-based state management

## Engineering Notes

- Dialog: 28px radius, Level 4 shadow, padding: 40px (space-8)
- Overlay: rgba(15, 23, 42, 0.5) with backdrop-blur-sm
- Drawer: slides with CSS transform animations (250ms)
- BottomSheet: 85vh max-height, slides up with drag handle
- Toast: 400px width, auto-dismiss 5 seconds
- Tooltip: 8px radius, 300ms delay

## Design References

- DES-001 Constitution v1.0 — Overlay section
- DES-010A/D07 Component Behaviour — Modal, Drawer, Toast specs
- Dialog radius: 28px (FROZEN)
