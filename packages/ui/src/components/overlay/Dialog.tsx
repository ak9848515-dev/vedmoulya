// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dialog Component
// Follows DES-001 Constitution — 28px radius, Level 4 shadow
// Overlay: rgba(15, 23, 42, 0.5), padding: space-8 (40px)
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Dialog Root ────────────────────────────────────────────────────────────

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

// ── Dialog Portal ──────────────────────────────────────────────────────────

export function DialogPortal({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <DialogPrimitive.Portal>{children}</DialogPrimitive.Portal>;
}

// ── Dialog Overlay ─────────────────────────────────────────────────────────

export const DialogOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)] backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

// ── Dialog Content ─────────────────────────────────────────────────────────

export interface DialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  size?: 'sm' | 'md' | 'lg';
}

export const DialogContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, size = 'md', ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      'fixed z-[100] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]',
      'bg-white rounded-[28px] shadow-[0_10px_15px_rgba(15,23,42,0.07),0_4px_6px_rgba(15,23,42,0.04)]',
      'p-10 max-h-[85vh] overflow-y-auto',
      'w-full',
      size === 'sm' && 'max-w-sm',
      size === 'md' && 'max-w-lg',
      size === 'lg' && 'max-w-2xl',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
      'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
      'duration-200',
      className,
    )}
    {...props}
  >
    {children}
    <DialogPrimitive.Close
      className={cn(
        'absolute right-6 top-6 rounded-sm opacity-70 transition-opacity hover:opacity-100',
        'disabled:pointer-events-none',
        focusRing.base,
      )}
    >
      <X className="h-4 w-4 text-[#64748B]" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
));
DialogContent.displayName = 'DialogContent';

// ── Dialog Header ──────────────────────────────────────────────────────────

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1.5 mb-6', className)} {...props} />;
}

// ── Dialog Title ───────────────────────────────────────────────────────────

export const DialogTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[20px] font-semibold text-[#111827] leading-[28px]', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

// ── Dialog Description ─────────────────────────────────────────────────────

export const DialogDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[14px] text-[#64748B] leading-[20px]', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

// ── Dialog Footer ──────────────────────────────────────────────────────────

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 mt-8 pt-6 border-t border-[#E8EDF5]',
        className,
      )}
      {...props}
    />
  );
}
