// ──────────────────────────────────────────────────────────────────
// VedMoulya — Radio Component
// Radix UI Radio Group with custom styling
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: RadioOption[];
  direction?: 'vertical' | 'horizontal';
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    {
      name,
      value,
      defaultValue,
      onValueChange,
      options,
      direction = 'vertical',
      label,
      error,
      disabled,
      className,
    },
    ref,
  ) => {
    return (
      <div className="flex flex-col gap-1.5" ref={ref}>
        {label && (
          <span className="text-[14px] font-medium text-[#374151] leading-[18px] tracking-[0.02em]">
            {label}
          </span>
        )}
        <RadioGroupPrimitive.Root
          name={name}
          value={value}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          disabled={disabled}
          className={cn(
            'flex gap-3',
            direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
            className,
          )}
          aria-label={label}
        >
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupPrimitive.Item
                value={opt.value}
                disabled={opt.disabled || disabled}
                id={`radio-${opt.value}`}
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-150',
                  'border-[#CBD5E1] data-[state=checked]:border-[#2B5FD9]',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                  focusRing.base,
                )}
              >
                <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#2B5FD9]" />
                </RadioGroupPrimitive.Indicator>
              </RadioGroupPrimitive.Item>
              <label
                htmlFor={`radio-${opt.value}`}
                className="text-[14px] text-[#374151] cursor-pointer select-none leading-[20px]"
              >
                {opt.label}
              </label>
            </div>
          ))}
        </RadioGroupPrimitive.Root>
        {error && (
          <p className="text-[14px] text-[#EF4444] leading-[20px]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

RadioGroup.displayName = 'RadioGroup';
