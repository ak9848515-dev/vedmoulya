// ──────────────────────────────────────────────────────────────────
// VedMoulya — Tooltip Component
// Radix UI Tooltip — radius 8px (Constitution v1.0)
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utilities/cn.js';

// ── Tooltip Provider ───────────────────────────────────────────────────────

export function TooltipProvider({
  children,
  delayDuration = 300,
  ...props
}: TooltipPrimitive.TooltipProviderProps): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

// ── Tooltip Root ───────────────────────────────────────────────────────────

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

// ── Tooltip Content ────────────────────────────────────────────────────────

export const TooltipContent = forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-[300] overflow-hidden rounded-[8px] bg-[#1F2937] px-3 py-1.5 text-[13px] text-white shadow-md',
      'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
      'duration-150',
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = 'TooltipContent';
