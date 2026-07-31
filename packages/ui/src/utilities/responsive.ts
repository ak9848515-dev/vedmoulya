// ──────────────────────────────────────────────────────────────────
// VedMoulya — Utility: Responsive helpers
// Follows DES-001/D05 Layout & Grid, DES-010A/D06 Layout and Grid
// ──────────────────────────────────────────────────────────────────

import { cn } from './cn.js';

/**
 * Create responsive className string based on breakpoints
 */
export function responsive(base: string, tablet?: string, desktop?: string): string {
  return cn(base, tablet && `md:${tablet}`, desktop && `lg:${desktop}`);
}

/**
 * Get column span class based on grid system
 */
export function colSpan(columns: number, breakpoint?: 'md' | 'lg' | 'xl'): string {
  const prefix = breakpoint ? `${breakpoint}:` : '';
  return `${prefix}col-span-${String(columns)}`;
}

/**
 * Hide on mobile (show on tablet+)
 */
export const hideOnMobile = 'hidden md:block';

/**
 * Show only on mobile (hide on tablet+)
 */
export const showOnMobile = 'block md:hidden';

/**
 * Container styles following VedMoulya layout system
 */
export const containerStyles = 'mx-auto w-full max-w-[1280px] px-4 md:px-8 lg:px-16';

/**
 * Page section padding
 */
export const sectionPadding = 'py-8 md:py-10 lg:py-12';
