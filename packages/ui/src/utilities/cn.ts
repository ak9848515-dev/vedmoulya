// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utility: cn (class merge)
// Combines clsx with tailwind-merge for conflict-free class merging
// ──────────────────────────────────────────────────────────────────

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution
 * @example cn('px-4 py-2', isActive && 'bg-primary-600', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
