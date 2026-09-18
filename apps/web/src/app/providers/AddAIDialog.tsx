// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Add AI
// AI PROVIDER UX SIMPLIFICATION — Screen 1, "+ Add AI"
//
// "Connect an AI to VedMoulya." The list is the platform provider registry
// (the same catalog the provider experience view model is built from) — never a
// hard-coded provider list. Choosing a built-in provider opens its existing
// configuration experience, where VedMoulya already knows the endpoint,
// protocol and models. Only "+ Custom AI" asks for technical details, and it
// reuses the existing custom-provider panel untouched.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@vedmoulya/ui';
import { ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import { ProviderMark } from './ProviderMark.js';
import { providerIdentity } from './provider-ux.js';
import { AddProviderPanel } from './AddProviderPanel.js';

export interface AddAIOption {
  /** Provider family id from the platform registry. */
  family: string;
  /** Registry name for the provider. */
  name: string;
  /** True when the provider is already configured in this deployment. */
  connected: boolean;
}

export function AddAIDialog({
  open,
  onOpenChange,
  options,
  userId,
  onSelect,
  onProviderAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: AddAIOption[];
  userId: string;
  /** Open the existing configuration experience for a chosen provider. */
  onSelect: (family: string) => void;
  /** Fired after a custom provider is registered. */
  onProviderAdded?: () => void;
}): React.JSX.Element {
  const [customOpen, setCustomOpen] = useState(false);

  const handleOpenChange = (next: boolean): void => {
    if (!next) setCustomOpen(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{customOpen ? 'Custom AI' : 'Add AI'}</DialogTitle>
          <DialogDescription>
            {customOpen ? 'Your own endpoint, protocol and model.' : 'Connect an AI to VedMoulya'}
          </DialogDescription>
        </DialogHeader>

        {customOpen ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
              }}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All providers
            </button>
            <AddProviderPanel
              embedded
              userId={userId}
              onCancel={() => {
                setCustomOpen(false);
              }}
              onProviderAdded={onProviderAdded}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {options.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[#64748B] dark:text-[#94A3B8]">
                VedMoulya is still loading its provider registry. Try again in a moment.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="add-ai-options">
                {options.map((option) => {
                  const identity = providerIdentity(option.family, option.name);
                  return (
                    <li key={option.family}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(option.family);
                        }}
                        className="w-full flex items-center gap-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3.5 py-3 text-left hover:border-[#2B5FD9]/40 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
                        data-testid={`add-ai-option-${option.family}`}
                      >
                        <ProviderMark family={option.family} name={option.name} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                            {identity.name}
                          </span>
                          <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8] truncate">
                            {identity.vendor}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-[12px] font-medium ${
                            option.connected
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-[#64748B] dark:text-[#94A3B8]'
                          }`}
                        >
                          {option.connected ? '✓ Connected' : '○ Not connected'}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => {
                setCustomOpen(true);
              }}
              data-testid="add-ai-custom"
              className="w-full flex items-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] dark:border-[#334155] px-3.5 py-3 text-left hover:border-[#2B5FD9]/50 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFF4FE] dark:bg-[#1E3A8A]/40 text-[#2B5FD9] dark:text-[#6B8FEF]">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#111827] dark:text-[#F8FAFC]">
                  Custom AI
                </span>
                <span className="block text-[12px] text-[#64748B] dark:text-[#94A3B8]">
                  Bring your own endpoint
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]"
                aria-hidden="true"
              />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
