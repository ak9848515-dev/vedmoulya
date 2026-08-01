/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Toast Component
// Radix UI Toast with custom styling
// Width: 400px, auto-dismiss 4-8 seconds
// Follows DES-010A/D07 Component Behaviour
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef, createContext, useContext, useState, useCallback } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Toast Context ──────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ── Toast Provider ─────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast-${String(Date.now())}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => {
              removeToast(toast.id);
            }}
          />
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// ── Toast Item ─────────────────────────────────────────────────────────────

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-[#22C55E]" />,
  error: <AlertCircle className="h-5 w-5 text-[#EF4444]" />,
  warning: <AlertTriangle className="h-5 w-5 text-[#F59E0B]" />,
  info: <Info className="h-5 w-5 text-[#3B82F6]" />,
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <ToastPrimitive.Root
      className={cn(
        'group pointer-events-auto relative flex w-full max-w-[400px] items-start gap-3',
        'rounded-[16px] bg-white p-4 shadow-[0_20px_25px_rgba(15,23,42,0.09),0_8px_10px_rgba(15,23,42,0.05)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
        'data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full',
      )}
    >
      <div className="shrink-0 mt-0.5">{toastIcons[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-[14px] font-medium text-[#1F2937]">
          {toast.title}
        </ToastPrimitive.Title>
        {toast.description && (
          <ToastPrimitive.Description className="text-[13px] text-[#64748B] mt-0.5">
            {toast.description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close
        onClick={onClose}
        className={cn(
          'shrink-0 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity',
          focusRing.base,
        )}
      >
        <X className="h-4 w-4 text-[#94A3B8]" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

// ── Toast Viewport ─────────────────────────────────────────────────────────

export const ToastViewport = forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    data-testid="toast-viewport"
    className={cn(
      'fixed top-0 right-0 z-[200] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

// ── Snackbar (Simplified inline toast) ─────────────────────────────────────

export interface SnackbarProps {
  message: string;
  type?: 'default' | 'success' | 'error' | 'warning';
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function Snackbar({
  message,
  type = 'default',
  action,
  className,
}: SnackbarProps): React.JSX.Element {
  const typeStyles = {
    default: 'bg-[#1F2937] text-white',
    success: 'bg-[#22C55E] text-white',
    error: 'bg-[#EF4444] text-white',
    warning: 'bg-[#F59E0B] text-white',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[16px] px-4 py-3 shadow-[0_4px_6px_rgba(15,23,42,0.06),0_2px_4px_rgba(15,23,42,0.04)]',
        'animate-in slide-in-from-bottom-5 fade-in-0 duration-200',
        typeStyles[type],
        className,
      )}
      role="alert"
    >
      <span className="text-[14px] flex-1">{message}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="text-[13px] font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
