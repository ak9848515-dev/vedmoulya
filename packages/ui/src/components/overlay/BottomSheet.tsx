// ──────────────────────────────────────────────────────────────────
// VedMoulya — BottomSheet Component
// Mobile-friendly bottom sheet using Radix Dialog
// Slides up from bottom on mobile
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export const BottomSheet = DialogPrimitive.Root;
export const BottomSheetTrigger = DialogPrimitive.Trigger;

export const BottomSheetOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = 'BottomSheetOverlay';

export interface BottomSheetContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  maxHeight?: string;
}

export const BottomSheetContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, maxHeight = '85vh', ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      'fixed z-[100] bottom-0 left-0 right-0',
      'bg-white rounded-t-[28px] shadow-[0_-4px_6px_rgba(15,23,42,0.04)]',
      'p-8 overflow-y-auto',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      'duration-250',
      className,
    )}
    style={{ maxHeight }}
    {...props}
  >
    {/* Drag handle */}
    <div className="mx-auto w-10 h-1 rounded-full bg-[#CBD5E1] mb-6" aria-hidden="true" />
    <DialogPrimitive.Close
      className={cn(
        'absolute right-6 top-6 rounded-sm opacity-70 transition-opacity hover:opacity-100',
        focusRing.base,
      )}
    >
      <X className="h-4 w-4 text-[#64748B]" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
    {children}
  </DialogPrimitive.Content>
));
BottomSheetContent.displayName = 'BottomSheetContent';
