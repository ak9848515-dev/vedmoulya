// ──────────────────────────────────────────────────────────────────
// VedMoulya — Overlay Components Stories
// BLD-003A Design System Quality & Documentation
// Covers: Dialog, Drawer, BottomSheet, Toast/Snackbar, Tooltip
// ──────────────────────────────────────────────────────────────────

import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
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
} from '../components/overlay/Dialog.js';
import {
  Drawer,
  DrawerTrigger,
  DrawerOverlay,
  DrawerContent,
} from '../components/overlay/Drawer.js';
import {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetOverlay,
  BottomSheetContent,
} from '../components/overlay/BottomSheet.js';
import { ToastProvider, useToast, Snackbar } from '../components/overlay/Toast.js';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../components/overlay/Tooltip.js';
import { Button } from '../components/button/Button.js';

const meta: Meta = {
  title: 'Components/Overlay',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Overlay components: Dialog, Drawer, BottomSheet, Toast/Snackbar, Tooltip.',
      },
    },
  },
};

export default meta;

// ── Dialog ────────────────────────────────────────────────────────────────

export const DialogBasic: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when done.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-10 rounded-[16px] border border-[#CBD5E1] px-3 flex items-center text-[14px] text-[#64748B]">
              Name: John Doe
            </div>
            <div className="h-10 rounded-[16px] border border-[#CBD5E1] px-3 flex items-center text-[14px] text-[#64748B]">
              Email: john@example.com
            </div>
          </div>
          <DialogFooter>
            <DialogTrigger asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogTrigger>
            <Button variant="primary">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  ),
  name: 'Dialog',
};

export const DialogSmall: StoryObj = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">Small Dialog</Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogTrigger asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogTrigger>
            <Button variant="danger">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  ),
  name: 'Dialog — Small',
};

// ── Drawer ────────────────────────────────────────────────────────────────

export const DrawerRight: StoryObj = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerOverlay />
      <DrawerContent side="right" size="md">
        <div className="space-y-4">
          <p className="text-[14px] text-[#64748B]">Drawer content</p>
          <Button fullWidth>Action</Button>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  name: 'Drawer — Right',
};

export const DrawerLeft: StoryObj = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary">Left Drawer</Button>
      </DrawerTrigger>
      <DrawerOverlay />
      <DrawerContent side="left" size="sm">
        <div>
          <p className="text-[14px] text-[#64748B]">Left drawer</p>
        </div>
      </DrawerContent>
    </Drawer>
  ),
  name: 'Drawer — Left',
};

// ── BottomSheet ───────────────────────────────────────────────────────────

export const BottomSheetDefault: StoryObj = {
  render: () => (
    <BottomSheet>
      <BottomSheetTrigger asChild>
        <Button variant="secondary">Show Bottom Sheet</Button>
      </BottomSheetTrigger>
      <BottomSheetOverlay />
      <BottomSheetContent>
        <h3 className="text-[18px] font-semibold text-[#1F2937] mb-4">Sheet Title</h3>
        <p className="text-[14px] text-[#64748B] mb-4">Mobile-friendly bottom sheet.</p>
        <Button fullWidth>Primary Action</Button>
      </BottomSheetContent>
    </BottomSheet>
  ),
  name: 'BottomSheet',
};

// ── Toast ─────────────────────────────────────────────────────────────────

function ToastTrigger({
  type,
  title,
  description,
}: {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
}): React.JSX.Element {
  const { addToast } = useToast();
  return (
    <Button
      onClick={() => {
        addToast({ type, title, description });
      }}
    >
      Show {type} toast
    </Button>
  );
}

export const ToastSuccess: StoryObj = {
  render: () => (
    <ToastProvider>
      <ToastTrigger type="success" title="Saved!" description="Changes saved." />
    </ToastProvider>
  ),
  name: 'Toast — Success',
};

export const ToastError: StoryObj = {
  render: () => (
    <ToastProvider>
      <ToastTrigger type="error" title="Error!" description="Something went wrong." />
    </ToastProvider>
  ),
  name: 'Toast — Error',
};

// ── Snackbar ──────────────────────────────────────────────────────────────

export const SnackbarDefault: StoryObj = {
  render: () => <Snackbar message="File saved." action={{ label: 'Undo', onClick: fn() }} />,
  name: 'Snackbar',
};

export const SnackbarSuccess: StoryObj = {
  render: () => <Snackbar message="Profile updated!" type="success" />,
  name: 'Snackbar — Success',
};

export const SnackbarError: StoryObj = {
  render: () => (
    <Snackbar message="Upload failed." type="error" action={{ label: 'Retry', onClick: fn() }} />
  ),
  name: 'Snackbar — Error',
};

// ── Tooltip ───────────────────────────────────────────────────────────────

export const TooltipBasic: StoryObj = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost">Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Tooltip content</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  name: 'Tooltip',
};

export const TooltipAllSides: StoryObj = {
  render: () => (
    <TooltipProvider>
      <div className="flex gap-8 items-center justify-center p-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Top</Button>
          </TooltipTrigger>
          <TooltipContent side="top">Top tooltip</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Bottom</Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bottom tooltip</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Left</Button>
          </TooltipTrigger>
          <TooltipContent side="left">Left tooltip</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Right</Button>
          </TooltipTrigger>
          <TooltipContent side="right">Right tooltip</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  name: 'Tooltip — All Sides',
};
