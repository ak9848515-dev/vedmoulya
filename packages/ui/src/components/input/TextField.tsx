// ──────────────────────────────────────────────────────────────────
// VedMoulya — TextField Component
// Follows DES-001 Constitution — height 44px MD, radius 16px, label 14px
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef, useId } from 'react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  success?: boolean;
  size?: 'md' | 'lg';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      className: _className,
      label,
      hint,
      error,
      success,
      size = 'md',
      leftIcon,
      rightIcon,
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

    const inputClasses = cn(
      'w-full rounded-[16px] border bg-white text-[#1F2937] placeholder:text-[#4B5563]',
      'transition-all duration-150 ease-out',
      error
        ? 'border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444] focus:ring-[3px] focus:ring-opacity-30'
        : success
          ? 'border-[#22C55E] focus:ring-[#22C55E] focus:ring-[3px] focus:ring-opacity-30'
          : 'border-[#CBD5E1] focus:border-[#2B5FD9] focus:ring-[#2B5FD9] focus:ring-[3px] focus:ring-opacity-30',
      disabled && 'bg-[#E2E8F0] text-[#CBD5E1] cursor-not-allowed',
      focusRing.base,
      size === 'md' ? 'h-11 px-3 text-[16px]' : 'h-[52px] px-4 text-[16px]',
      leftIcon && 'pl-10',
      rightIcon && 'pr-10',
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
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}
          <input
            id={id}
            ref={ref}
            className={inputClasses}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />
          {rightIcon && !error && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}
          {error && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#EF4444]"
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          )}
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

TextField.displayName = 'TextField';
