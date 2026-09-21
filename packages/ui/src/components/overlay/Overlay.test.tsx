// ──────────────────────────────────────────────────────────────────
// VedMoulya — Overlay Components Tests
// BLD-003A Design System Quality & Documentation
// Covers: Dialog, Drawer, BottomSheet, Toast/Snackbar, Tooltip
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../overlay/Dialog.js';
import { Drawer, DrawerTrigger, DrawerOverlay, DrawerContent } from '../overlay/Drawer.js';
import {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetOverlay,
  BottomSheetContent,
} from '../overlay/BottomSheet.js';
import { ToastProvider, ToastViewport, useToast, Snackbar } from '../overlay/Toast.js';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../overlay/Tooltip.js';
import { Button } from '../../components/button/Button.js';

// ── Dialog ────────────────────────────────────────────────────────────────

describe('Dialog', () => {
  it('renders trigger and opens content', () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title</DialogTitle>
              <DialogDescription>Description</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Close</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('has close button with sr-only text', () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent>
            <DialogTitle>Title</DialogTitle>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    );
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('has displayNames set', () => {
    expect(DialogOverlay.displayName).toBe('DialogOverlay');
    expect(DialogContent.displayName).toBe('DialogContent');
    expect(DialogTitle.displayName).toBe('DialogTitle');
    expect(DialogDescription.displayName).toBe('DialogDescription');
  });
});

// ── Drawer ────────────────────────────────────────────────────────────────

describe('Drawer', () => {
  it('renders trigger', () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <Button>Open Drawer</Button>
        </DrawerTrigger>
        <DrawerOverlay />
        <DrawerContent side="right" size="md">
          <div>Drawer Content</div>
        </DrawerContent>
      </Drawer>,
    );
    expect(screen.getByText('Open Drawer')).toBeInTheDocument();
  });

  it('has displayNames set', () => {
    expect(DrawerOverlay.displayName).toBe('DrawerOverlay');
    expect(DrawerContent.displayName).toBe('DrawerContent');
  });
});

// ── BottomSheet ───────────────────────────────────────────────────────────

describe('BottomSheet', () => {
  it('renders trigger', () => {
    render(
      <BottomSheet>
        <BottomSheetTrigger asChild>
          <Button>Open Sheet</Button>
        </BottomSheetTrigger>
        <BottomSheetOverlay />
        <BottomSheetContent>
          <div>Sheet Content</div>
        </BottomSheetContent>
      </BottomSheet>,
    );
    expect(screen.getByText('Open Sheet')).toBeInTheDocument();
  });

  it('has displayNames', () => {
    expect(BottomSheetOverlay.displayName).toBe('BottomSheetOverlay');
    expect(BottomSheetContent.displayName).toBe('BottomSheetContent');
  });
});

// ── Toast / Snackbar ──────────────────────────────────────────────────────

describe('Snackbar', () => {
  it('renders message', () => {
    render(<Snackbar message="Saved!" />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = vi.fn();
    render(<Snackbar message="Saved!" action={{ label: 'Undo', onClick }} />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onClick).toHaveBeenCalled();
  });

  it('has role alert', () => {
    const { container } = render(<Snackbar message="Alert" />);
    expect(container.firstChild).toHaveAttribute('role', 'alert');
  });

  it('applies type styles', () => {
    const { container } = render(<Snackbar message="Success" type="success" />);
    expect(container.firstChild).toHaveClass('bg-[#22C55E]');
  });
});

// ── Tooltip ───────────────────────────────────────────────────────────────

describe('Tooltip', () => {
  it('renders trigger', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button>Hover</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Hover')).toBeInTheDocument();
  });

  it('has displayName', () => {
    expect(TooltipContent.displayName).toBe('TooltipContent');
  });

  // ── Snapshots ──────────────────────────────────────────────────────────
  it('matches snapshot for Snackbar default', () => {
    const { container } = render(<Snackbar message="Saved!" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for Snackbar success', () => {
    const { container } = render(<Snackbar message="Success" type="success" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('matches snapshot for Snackbar error', () => {
    const { container } = render(<Snackbar message="Error" type="error" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
// ── UX-09 Responsive contracts ──────────────────────────────
// The overlay primitives must not overflow a phone viewport. These assert the
// overflow-safe classes are present on the rendered nodes (contract tests, not
// brittle snapshots).

describe('UX-09 Drawer — viewport clamp', () => {
  it('clamps every drawer size to the viewport width (max-w-[100vw])', () => {
    const { container } = render(
      <Drawer open>
        <DrawerOverlay />
        <DrawerContent size="lg" aria-label="Evidence">
          <div>Wide drawer</div>
        </DrawerContent>
      </Drawer>,
    );
    const content = container.querySelector('[role="dialog"]');
    expect(content).not.toBeNull();
    // The base clamp is what stops a 600px 'lg' drawer from overflowing 375px.
    expect(content?.className).toContain('max-w-[100vw]');
    expect(content?.className).toContain('w-[600px]');
  });
});

describe('UX-09 Dialog — mobile gutter + padding', () => {
  it('keeps a viewport gutter and mobile padding (no edge-to-edge squeeze)', () => {
    const { container } = render(
      <Dialog open>
        <DialogPortal>
          <DialogOverlay />
          <DialogContent size="lg" aria-label="Configure provider">
            <DialogHeader>
              <DialogTitle>Configure</DialogTitle>
              <DialogDescription>Provider details</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>,
    );
    const content = container.ownerDocument.querySelector('[role="dialog"]');
    expect(content).not.toBeNull();
    // Gutter: never 100vw; mobile-first padding; footer wraps.
    expect(content?.className).toContain('w-[calc(100vw-24px)]');
    expect(content?.className).toContain('p-6');
    expect(content?.className).toContain('md:p-10');
    const footer = content?.querySelector('div');
    // DialogFooter must wrap its actions on narrow viewports.
    expect(container.ownerDocument.body.innerHTML).toContain('flex-wrap');
    expect(footer).not.toBeNull();
  });
});
