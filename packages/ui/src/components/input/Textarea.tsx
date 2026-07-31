// ──────────────────────────────────────────────────────────────────
// VedMoulya — Textarea Component
// Follows DES-001 Constitution — min-height 80px, radius 16px
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef, useId } from 'react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, success, disabled, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId || generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const textareaClasses = cn(
      'w-full min-h-[80px] rounded-[16px] border bg-white p-3 text-[16px] text-[#1F2937] placeholder:text-[#4B5563]',
      'transition-all duration-150 ease-out',
      'resize-y',
      error
        ? 'border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444] focus:ring-[3px] focus:ring-opacity-30'
        : success
          ? 'border-[#22C55E] focus:ring-[#22C55E] focus:ring-[3px] focus:ring-opacity-30'
          : 'border-[#CBD5E1] focus:border-[#2B5FD9] focus:ring-[#2B5FD9] focus:ring-[3px] focus:ring-opacity-30',
      disabled && 'bg-[#E2E8F0] text-[#CBD5E1] cursor-not-allowed',
      focusRing.base,
      className,
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
        <textarea
          id={id}
          ref={ref}
          className={textareaClasses}
          disabled={disabled}
          aria-invalid={!!error}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
