// ──────────────────────────────────────────────────────────────────
// VedMoulya — Card Component
// Follows DES-001 Constitution v1.0 — 24px radius, #E8EDF5 border
// Standard shadow: 0 8px 30px rgba(15,23,42,0.06)
// Variants: standard, elevated, ghost, interactive
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Card Variants ──────────────────────────────────────────────────────────

export const cardVariants = cva(
  ['rounded-[24px]', 'transition-all duration-250 ease-out'].join(' '),
  {
    variants: {
      variant: {
        standard: 'bg-white border border-[#E8EDF5] shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
        elevated:
          'bg-white shadow-[0_10px_15px_rgba(15,23,42,0.07),0_4px_6px_rgba(15,23,42,0.04)] border-none',
        ghost: 'bg-transparent border border-dashed border-[#E8EDF5]',
        interactive:
          'bg-white border border-[#E8EDF5] shadow-[0_8px_30px_rgba(15,23,42,0.06)] cursor-pointer hover:shadow-[0_4px_6px_rgba(15,23,42,0.06),0_2px_4px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 active:shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.03)] active:-translate-y-0',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'standard',
      padding: 'md',
    },
  },
);

// ── Card Props ─────────────────────────────────────────────────────────────

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {
  as?: 'div' | 'article' | 'section';
}

// ── Card Component ─────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, variant, padding, as: Component = 'div', children, onClick, ...props },
    ref,
  ): React.JSX.Element => {
    const interactive = variant === 'interactive';

    return (
      <Component
        className={cn(cardVariants({ variant, padding }), interactive && focusRing.base, className)}
        ref={ref}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e: React.KeyboardEvent): void => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Card.displayName = 'Card';
