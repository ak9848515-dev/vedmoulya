// ──────────────────────────────────────────────────────────────────
// VedMoulya — Checkbox Component
// Radix UI Checkbox with custom styling
// Follows DES-001 Constitution — rounded properly
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export interface CheckboxProps {
  id?: string;
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ id, label, checked, defaultChecked, onCheckedChange, disabled, error, className }, ref) => {
    return (
      <div className="flex items-center gap-2">
        <CheckboxPrimitive.Root
          id={id}
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150',
            error
              ? 'border-[#EF4444]'
              : 'border-[#CBD5E1] data-[state=checked]:bg-[#2B5FD9] data-[state=checked]:border-[#2B5FD9]',
            'disabled:cursor-not-allowed disabled:opacity-40',
            focusRing.base,
            className,
          )}
          aria-label={label}
        >
          <CheckboxPrimitive.Indicator className="text-white">
            <Check className="h-3.5 w-3.5 stroke-[3]" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
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

Checkbox.displayName = 'Checkbox';
