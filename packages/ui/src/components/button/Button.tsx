// ──────────────────────────────────────────────────────────────────
// VedMoulya — Button Component
// Follows DES-001 Constitution v1.0, DES-010A/D07 Component Behaviour
// Variants: primary, secondary, ghost, danger, AI
// Sizes: sm, md, lg, xl | Radius: 14px ALL variants
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Button Variants ────────────────────────────────────────────────────────

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium',
    'transition-all duration-150 ease-out',
    'select-none whitespace-nowrap',
    'disabled:opacity-40 disabled:pointer-events-none disabled:select-none',
    focusRing.base,
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-[#2B5FD9] text-white hover:bg-[#3B6FE3] active:bg-[#1E4AA8] shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.03)]',
        secondary:
          'bg-white text-[#111827] border border-[#CBD5E1] hover:bg-[#F1F5F9] hover:border-[#94A3B8] active:bg-[#E2E8F0]',
        ghost: 'bg-transparent text-[#374151] hover:bg-[#F1F5F9] active:bg-[#E2E8F0]',
        danger: 'bg-[#EF4444] text-white hover:bg-[#DC2626] active:bg-[#B91C1C]',
        ai: 'bg-[#7C3AED] text-white hover:bg-[#8B5CF6] active:bg-[#6D28D9] shadow-[0_0_20px_rgba(124,58,237,0.15)] hover:shadow-[0_0_25px_rgba(124,58,237,0.25)]',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] rounded-[14px]',
        md: 'h-10 px-4 text-[14px] rounded-[14px]',
        lg: 'h-12 px-5 text-[15px] rounded-[14px]',
        xl: 'h-14 px-6 text-[16px] rounded-[14px]',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

// ── Button Props ───────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

// ── Button Component ───────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      icon,
      iconPosition = 'left',
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : icon && iconPosition === 'left' ? (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children && <span>{children}</span>}
        {!loading && icon && iconPosition === 'right' && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
