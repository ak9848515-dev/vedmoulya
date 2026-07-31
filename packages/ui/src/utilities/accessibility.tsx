// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utility: Accessibility helpers
// Follows DES-001/D10 Accessibility Standards, DES-010A/D13 Accessibility
// ──────────────────────────────────────────────────────────────────

import React from 'react';
import { cn } from './cn.js';

// ── Focus Ring Classes ─────────────────────────────────────────────────────

export const focusRing = {
  base: 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B5FD9]',
  within: 'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2B5FD9]',
  none: 'focus:outline-none',
} as const;

/**
 * Merge interactive states into a className string with focus ring
 */
export function interactiveClass(...classes: string[]): string {
  return cn(focusRing.base, ...classes);
}

// ── ARIA Props Generators ──────────────────────────────────────────────────

export interface AriaLabelProps {
  label: string;
  describedBy?: string;
  hidden?: boolean;
}

/**
 * Generate accessible aria props for an element
 */
export function ariaLabel({ label, describedBy, hidden }: AriaLabelProps): Record<string, unknown> {
  return {
    'aria-label': label,
    'aria-describedby': describedBy,
    'aria-hidden': hidden,
  };
}

/**
 * Generate props for a controlled toggle (checkbox, switch, radio)
 */
export function ariaToggle(
  checked: boolean,
  onChange: (checked: boolean) => void,
  label: string,
): Record<string, unknown> {
  return {
    role: 'switch',
    'aria-checked': checked,
    'aria-label': label,
    onClick: (): void => {
      onChange(!checked);
    },
    onKeyDown: (e: React.KeyboardEvent): void => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange(!checked);
      }
    },
    tabIndex: 0,
  };
}

// ── Skip Link ──────────────────────────────────────────────────────────────

export function SkipLink({ href = '#main-content' }: { href?: string }): React.JSX.Element {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#2B5FD9] focus:text-white focus:rounded-[14px] focus:outline-none"
    >
      Skip to main content
    </a>
  );
}

// ── Visually Hidden (screen reader only) ───────────────────────────────────

export function VisuallyHidden({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span className="sr-only">{children}</span>;
}
