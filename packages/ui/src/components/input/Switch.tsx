// ──────────────────────────────────────────────────────────────────
// VedMoulya — Switch Component
// Radix UI Switch with custom styling
// Follows DES-001 Motion — 200ms bg transition
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../utilities/cn.js';

export interface SwitchProps {
  id?: string;
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ id, label, checked, defaultChecked, onCheckedChange, disabled, className }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <SwitchPrimitive.Root
          id={id}
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={cn(
            'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
            'transition-colors duration-200 ease-out',
            'data-[state=checked]:bg-[#2B5FD9] data-[state=unchecked]:bg-[#CBD5E1]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-40',
            className,
          )}
          aria-label={label}
        >
          <SwitchPrimitive.Thumb
            className={cn(
              'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0',
              'transition-transform duration-200 ease-out',
              'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
            )}
          />
        </SwitchPrimitive.Root>
        {label && (
          <label
            htmlFor={id}
            className="text-[14px] text-[#374151] cursor-pointer select-none leading-[20px]"
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Switch.displayName = 'Switch';
