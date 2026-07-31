// ──────────────────────────────────────────────────────────────────
// VedMoulya — IconButton Component
// Circular/rounded button containing only an icon
// Follows DES-001 Constitution v1.0 button rules
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── IconButton Variants ────────────────────────────────────────────────────

export const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'transition-all duration-150 ease-out',
    'select-none',
    'disabled:opacity-40 disabled:pointer-events-none',
    focusRing.base,
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-[#2B5FD9] text-white hover:bg-[#3B6FE3] active:bg-[#1E4AA8]',
        secondary:
          'bg-white text-[#374151] border border-[#CBD5E1] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
        ghost: 'bg-transparent text-[#374151] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
        danger: 'bg-transparent text-[#EF4444] hover:bg-[#FEF2F2] active:bg-[#FEE2E2]',
      },
      size: {
        sm: 'h-8 w-8 rounded-lg',
        md: 'h-10 w-10 rounded-xl',
        lg: 'h-12 w-12 rounded-xl',
      },
      rounded: {
        true: 'rounded-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
      rounded: false,
    },
  },
);

// ── IconButton Props ───────────────────────────────────────────────────────

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  label: string; // Required for accessibility
  icon: React.ReactNode;
}

// ── IconButton Component ───────────────────────────────────────────────────

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, rounded, label, icon, ...props }, ref) => {
    return (
      <button
        className={cn(iconButtonVariants({ variant, size, rounded }), className)}
        ref={ref}
        aria-label={label}
        type="button"
        {...props}
      >
        <span aria-hidden="true">{icon}</span>
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
