// ──────────────────────────────────────────────────────────────────
// VedMoulya — State Components
// EmptyState, ErrorState, OfflineState, SuccessState
// Follows DES-010A/D07 Component Behaviour specifications
// ──────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Inbox, AlertCircle, WifiOff, CheckCircle2 } from 'lucide-react';
import { Card } from '../card/Card.js';
import { Button } from '../button/Button.js';
import { cn } from '../../utilities/cn.js';

// ── Empty State ────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <Card variant="ghost" padding="lg" className={cn('text-center', className)}>
      <div className="flex flex-col items-center gap-4 py-8">
        {icon || <Inbox className="h-12 w-12 text-[#CBD5E1]" aria-hidden="true" />}
        <div>
          <h3 className="text-[18px] font-semibold text-[#1F2937] mb-1">{title}</h3>
          {description && (
            <p className="text-[14px] text-[#64748B] max-w-sm mx-auto leading-[22px]">
              {description}
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-2">
          {action && (
            <Button variant="primary" size="md" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="secondary" size="md" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Error State ────────────────────────────────────────────────────────────

export interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  error,
  onRetry,
  onDismiss,
  className,
}: ErrorStateProps): React.JSX.Element {
  return (
    <Card
      variant="standard"
      padding="md"
      className={cn('border-[#FECACA] bg-[#FEF2F2]', className)}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-[#EF4444] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-[14px] font-medium text-[#EF4444]">{title}</h4>
          <p className="text-[13px] text-[#DC2626] mt-0.5 leading-[20px]">{message}</p>
          {error && typeof error === 'object' && 'message' in error && (
            <p className="text-[12px] text-[#FCA5A5] mt-1 font-mono">{error.message}</p>
          )}
          <div className="flex gap-2 mt-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-[13px] font-medium text-[#EF4444] hover:text-[#DC2626] underline underline-offset-2 transition-colors"
              >
                Try again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-[13px] text-[#FCA5A5] hover:text-[#FECACA] transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Offline State ──────────────────────────────────────────────────────────

export interface OfflineStateProps {
  title?: string;
  message?: string;
  lastSynced?: string;
  onReconnect?: () => void;
  className?: string;
}

export function OfflineState({
  title = "You're offline",
  message = 'Some features may be unavailable. Your data will sync when you reconnect.',
  lastSynced,
  onReconnect,
  className,
}: OfflineStateProps): React.JSX.Element {
  return (
    <div
      className={cn('bg-[#FFFBEB] border border-[#FDE68A] rounded-[16px] px-4 py-3', className)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <WifiOff className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[#92400E]">{title}</p>
          <p className="text-[13px] text-[#A16207] mt-0.5">{message}</p>
          {lastSynced && (
            <p className="text-[12px] text-[#D97706] mt-1">Last synced: {lastSynced}</p>
          )}
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="text-[13px] font-medium text-[#D97706] hover:text-[#92400E] underline underline-offset-2 transition-colors mt-2"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Success State ──────────────────────────────────────────────────────────

export interface SuccessStateProps {
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoDismiss?: number; // milliseconds
  onDismiss?: () => void;
  className?: string;
}

export function SuccessState({
  title,
  message,
  action,
  autoDismiss,
  onDismiss,
  className,
}: SuccessStateProps): React.JSX.Element | null {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, autoDismiss);
      return (): void => {
        clearTimeout(timer);
      };
    }
    return;
  }, [autoDismiss, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn('bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] px-4 py-3', className)}
      role="status"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-[#22C55E] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-[#166534]">{title}</p>
          {message && <p className="text-[13px] text-[#15803D] mt-0.5">{message}</p>}
          {action && (
            <button
              onClick={action.onClick}
              className="text-[13px] font-medium text-[#15803D] hover:text-[#166534] underline underline-offset-2 transition-colors mt-1"
            >
              {action.label}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={() => {
              setVisible(false);
              onDismiss();
            }}
            className="text-[#86EFAC] hover:text-[#4ADE80] transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
