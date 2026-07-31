// ──────────────────────────────────────────────────────────────────
// VedMoulya — Drawer Component
// Side panel that slides from right
// Width: 400px standard / 600px large
// Follows DES-010A/D07 Component Behaviour
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Re-export Root from Dialog ─────────────────────────────────────────────

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;

// ── Drawer Overlay ─────────────────────────────────────────────────────────

export const DrawerOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = 'DrawerOverlay';

// ── Drawer Content ─────────────────────────────────────────────────────────

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

export const DrawerContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ className, children, side = 'right', size = 'md', ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      'fixed z-[100] top-0 h-full bg-white shadow-[0_10px_15px_rgba(15,23,42,0.07),0_4px_6px_rgba(15,23,42,0.04)]',
      'overflow-y-auto',
      side === 'right' ? 'right-0' : 'left-0',
      size === 'sm' && 'w-80',
      size === 'md' && 'w-[400px]',
      size === 'lg' && 'w-[600px]',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      side === 'right'
        ? 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
        : 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
      'duration-250',
      className,
    )}
    {...props}
  >
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <DialogPrimitive.Title className="text-[20px] font-semibold text-[#111827]">
          {props['aria-label'] || 'Drawer'}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          className={cn(
            'rounded-sm opacity-70 transition-opacity hover:opacity-100',
            'disabled:pointer-events-none',
            focusRing.base,
          )}
        >
          <X className="h-4 w-4 text-[#64748B]" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
      {children}
    </div>
  </DialogPrimitive.Content>
));
DrawerContent.displayName = 'DrawerContent';
