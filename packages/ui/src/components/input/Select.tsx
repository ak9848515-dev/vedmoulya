// ──────────────────────────────────────────────────────────────────
// VedMoulya — Select Component
// Follows DES-001 Constitution — same height as text input
// Uses native select for accessibility and simplicity
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  size?: 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className: _className,
      label,
      hint,
      error,
      options,
      placeholder,
      size = 'md',
      disabled,
      id: externalId,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const selectClasses = cn(
      'w-full appearance-none rounded-[16px] border bg-white text-[#1F2937]',
      'transition-all duration-150 ease-out',
      'cursor-pointer',
      error
        ? 'border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444] focus:ring-[3px] focus:ring-opacity-30'
        : 'border-[#CBD5E1] focus:border-[#2B5FD9] focus:ring-[#2B5FD9] focus:ring-[3px] focus:ring-opacity-30',
      disabled && 'bg-[#E2E8F0] text-[#CBD5E1] cursor-not-allowed',
      focusRing.base,
      size === 'md' ? 'h-11 px-3 pr-10 text-[16px]' : 'h-[52px] px-4 pr-10 text-[16px]',
    );

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-[14px] font-medium text-[#374151] leading-[18px] tracking-[0.02em]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={id}
            ref={ref}
            className={selectClasses}
            disabled={disabled}
            aria-invalid={!!error}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none"
            aria-hidden="true"
          />
        </div>
        {error && (
          <p id={errorId} className="text-[14px] text-[#EF4444] leading-[20px]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-[14px] text-[#64748B] leading-[20px]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
