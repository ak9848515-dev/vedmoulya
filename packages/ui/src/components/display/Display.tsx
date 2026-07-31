// ──────────────────────────────────────────────────────────────────
// VedMoulya — Display Components
// Badge, Avatar, Progress, Loading, Skeleton, Divider
// Follows DES-001 Constitution and DES-010A/D07 Component Behaviour
// ──────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utilities/cn.js';

// ── Badge ──────────────────────────────────────────────────────────────────

export const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[#F1F5F9] text-[#64748B]',
        success: 'bg-[#F0FDF4] text-[#22C55E]',
        warning: 'bg-[#FFFBEB] text-[#F59E0B]',
        danger: 'bg-[#FEF2F2] text-[#EF4444]',
        info: 'bg-[#EFF6FF] text-[#3B82F6]',
        ai: 'bg-[#F5F3FF] text-[#7C3AED]',
        premium: 'bg-[#FFFBEB] text-[#C89B3C]',
        draft: 'bg-[#F1F5F9] text-[#94A3B8]',
        published: 'bg-[#F0FDF4] text-[#22C55E]',
        archived: 'bg-[#F1F5F9] text-[#94A3B8]',
        beta: 'bg-[#F5F3FF] text-[#7C3AED]',
        new: 'bg-[#EFF4FE] text-[#2B5FD9]',
      },
      size: {
        sm: 'text-[11px] px-1.5 py-0.5 h-[22px]',
        md: 'text-[12px] px-2 py-0.5 h-[26px]',
        lg: 'text-[13px] px-2.5 py-1 h-[30px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

// ── Avatar ─────────────────────────────────────────────────────────────────

export interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

export function Avatar({
  src,
  alt,
  size = 'md',
  fallback,
  status,
  className,
}: AvatarProps): React.JSX.Element {
  const sizeMap = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12', xl: 'h-16 w-16' };
  const fontMap = { sm: 'text-[11px]', md: 'text-[13px]', lg: 'text-[15px]', xl: 'text-[20px]' };
  const statusColors = {
    online: 'bg-[#22C55E]',
    offline: 'bg-[#CBD5E1]',
    away: 'bg-[#F59E0B]',
    busy: 'bg-[#EF4444]',
  };
  const statusSizes = { sm: 'h-2.5 w-2.5', md: 'h-3 w-3', lg: 'h-3.5 w-3.5', xl: 'h-4 w-4' };
  const initials =
    fallback ||
    alt
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className={cn('relative shrink-0', className)}>
      {src ? (
        <img src={src} alt={alt} className={cn('rounded-full object-cover', sizeMap[size])} />
      ) : (
        <div
          className={cn(
            'rounded-full bg-[#EFF4FE] text-[#2B5FD9] flex items-center justify-center font-medium',
            sizeMap[size],
            fontMap[size],
          )}
          aria-label={alt}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            statusColors[status],
            statusSizes[size],
          )}
          aria-label={status}
        />
      )}
    </div>
  );
}

// ── Progress ───────────────────────────────────────────────────────────────

export interface ProgressProps {
  value: number; // 0-100
  variant?: 'default' | 'success' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function Progress({
  value,
  variant = 'default',
  size = 'md',
  showLabel,
  className,
}: ProgressProps): React.JSX.Element {
  const clampedValue = Math.max(0, Math.min(100, value));
  const fillColors = {
    default: 'bg-[#2B5FD9]',
    success: 'bg-[#22C55E]',
    ai: 'bg-[#7C3AED]',
  };
  const heights = { sm: 'h-1', md: 'h-1.5', lg: 'h-2' };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 rounded-full bg-[#E2E8F0] overflow-hidden', heights[size])}>
        <div
          className={cn(
            'rounded-full transition-all duration-300 ease-out',
            heights[size],
            fillColors[variant],
          )}
          style={{ width: `${String(clampedValue)}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <span className="text-[12px] font-medium text-[#64748B] shrink-0">
          {String(clampedValue)}%
        </span>
      )}
    </div>
  );
}

// ── Loading Spinner ────────────────────────────────────────────────────────

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function Loading({ size = 'md', label, className }: LoadingProps): React.JSX.Element {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

  return (
    <div className={cn('flex items-center gap-2', className)} role="status">
      <svg
        className={cn('animate-spin text-[#2B5FD9]', sizes[size])}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="text-[14px] text-[#64748B]">{label}</span>}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

export interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const skeletonRadius = {
  sm: 'rounded-[4px]',
  md: 'rounded-[8px]',
  lg: 'rounded-[16px]',
  xl: 'rounded-[24px]',
  full: 'rounded-full',
};

export function Skeleton({
  width = '100%',
  height = '20px',
  rounded = 'md',
  className,
}: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={cn('animate-pulse bg-[#E2E8F0]', skeletonRadius[rounded], className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// ── Divider ────────────────────────────────────────────────────────────────

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  className?: string;
}

export function Divider({
  orientation = 'horizontal',
  label,
  className,
}: DividerProps): React.JSX.Element {
  if (orientation === 'vertical') {
    return <div className={cn('w-px h-full bg-[#E2E8F0]', className)} role="separator" />;
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)} role="separator">
        <div className="flex-1 h-px bg-[#E2E8F0]" />
        <span className="text-[12px] text-[#94A3B8] whitespace-nowrap">{label}</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>
    );
  }

  return <div className={cn('h-px w-full bg-[#E2E8F0]', className)} role="separator" />;
}
