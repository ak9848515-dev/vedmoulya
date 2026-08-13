'use client';

/* eslint-disable security/detect-object-injection -- the option/status lookups
   below index local arrays by integer position and closed-union maps by the
   model status union — never attacker-controlled input; the rule is a false
   positive on these presentational maps (same convention as
   apps/web/src/app/brain/brain-panels.tsx). */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Search, Sparkles } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  name: string;
  /** Short capability labels (e.g. ['Reasoning', 'Coding']). */
  capabilities?: string[];
  status?: 'available' | 'limited' | 'offline' | 'deprecated' | 'local';
  freeToUse?: boolean;
}

export interface ModelSelectorProps {
  /** Every model this provider offers (never hardcoded — from registry). */
  models: ModelOption[];
  /** Currently selected model id (undefined = Auto). */
  selectedModelId: string | undefined;
  /** Called when the user selects a model id (or undefined for Auto). */
  onSelect: (modelId: string | undefined) => void;
  /** Provider name, for context. */
  providerName: string;
  /** Whether the provider is enabled. */
  enabled?: boolean;
  /** Max height of the dropdown before scrolling. */
  maxHeight?: number;
}

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  limited: 'Limited',
  offline: 'Offline',
  deprecated: 'Deprecated',
  local: 'Local',
};

const STATUS_CLASSES: Record<string, string> = {
  available: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  limited: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  offline: 'bg-slate-500/20 text-slate-500 dark:text-slate-400',
  deprecated: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
  local: 'bg-violet-500/20 text-violet-600 dark:text-violet-400',
};

// ── Component ───────────────────────────────────────────────────────────────

export function ModelSelector({
  models,
  selectedModelId,
  onSelect,
  providerName,
  enabled = true,
  maxHeight = 280,
}: ModelSelectorProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile for bottom-sheet behavior.
  useEffect(() => {
    const check = (): void => {
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return (): void => {
      window.removeEventListener('resize', check);
    };
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const isAuto = selectedModelId === undefined || selectedModelId === '';

  // Filtered list: Auto is always first, then matching models.
  const filtered = models.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.capabilities ?? []).some((c) => c.toLowerCase().includes(q))
    );
  });

  const options = [
    { id: '', name: 'Auto', capabilities: ['VedMoulya routing'], status: 'available' as const },
    ...filtered,
  ];

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      }
      if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault();
        const option = options[focusedIndex];
        if (option) {
          onSelect(option.id || undefined);
          setOpen(false);
        }
      }
    };
    const handleClickOutside = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, focusedIndex, options, onSelect]);

  // Scroll focused item into view.
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-index]');
    const item = items.item(focusedIndex) as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Focus the search input when dropdown opens.
  useEffect(() => {
    if (open && models.length > 5) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, models.length]);

  const handleOpen = useCallback(() => {
    if (!enabled) return;
    setOpen(true);
    setSearch('');
    setFocusedIndex(
      isAuto
        ? 0
        : Math.max(
            0,
            options.findIndex((o) => o.id === selectedModelId),
          ),
    );
  }, [enabled, isAuto, options, selectedModelId]);

  const handleSelect = useCallback(
    (id: string | undefined) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-[#94A3B8] cursor-default">
        <span className="truncate max-w-[120px]">{selectedModel?.name ?? 'Auto'}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </span>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleOpen();
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Select model for ${providerName}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] transition-colors cursor-pointer"
      >
        <span className="truncate max-w-[130px]">
          {isAuto ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#7C3AED]" />
              <span className="text-[#7C3AED] font-semibold">Auto</span>
            </span>
          ) : (
            (selectedModel?.name ?? 'Auto')
          )}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown / Bottom Sheet ──────────────────────────────────────── */}
      {open && (
        <>
          {/* Overlay for mobile bottom sheet */}
          {isMobile && (
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => {
                setOpen(false);
              }}
              aria-hidden="true"
            />
          )}

          <div
            className={`
              ${
                isMobile
                  ? 'fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white dark:bg-[#1E293B] shadow-2xl border-t border-[#E2E8F0] dark:border-[#334155] animate-slide-up'
                  : 'absolute top-full left-0 mt-1 z-50 w-64 rounded-xl bg-white dark:bg-[#1E293B] shadow-lg border border-[#E2E8F0] dark:border-[#334155]'
              }
            `}
            role="listbox"
            aria-label={`Models for ${providerName}`}
          >
            {/* Header */}
            {isMobile && (
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#F1F5F9] dark:border-[#334155]">
                <span className="text-[13px] font-semibold text-[#374151] dark:text-[#E2E8F0]">
                  {providerName} models
                </span>
                <button
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="text-[13px] text-[#2B5FD9] dark:text-[#6B8FEF] font-medium"
                >
                  Done
                </button>
              </div>
            )}

            {/* Search */}
            {models.length > 5 && (
              <div className={`px-3 pt-2 ${isMobile ? 'pb-2' : ''}`}>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
                  <Search className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setFocusedIndex(0);
                    }}
                    placeholder="Search models..."
                    className="flex-1 bg-transparent text-[12px] text-[#374151] dark:text-[#E2E8F0] placeholder:text-[#94A3B8] outline-none"
                    aria-label="Search models"
                  />
                </div>
              </div>
            )}

            {/* Model list */}
            <div
              ref={listRef}
              className={`overflow-y-auto ${isMobile ? 'max-h-[50vh] pb-6' : ''} py-1`}
              style={isMobile ? undefined : { maxHeight }}
            >
              {filtered.length === 0 && search.trim().length > 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-[#94A3B8]">
                  No models match your search.
                </div>
              ) : (
                options.map((model, idx) => {
                  const isSelected = isAuto ? model.id === '' : model.id === selectedModelId;
                  const status = model.status ?? 'available';
                  const statusClass = STATUS_CLASSES[status] ?? STATUS_CLASSES.available;
                  const statusLabel = STATUS_LABELS[status] ?? 'Available';

                  return (
                    <button
                      key={model.id}
                      data-index={idx}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        handleSelect(model.id || undefined);
                      }}
                      onMouseEnter={() => {
                        setFocusedIndex(idx);
                      }}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                        ${focusedIndex === idx ? 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40' : ''}
                        ${isSelected ? 'bg-[#EFF4FE] dark:bg-[#1E3A8A]/40' : ''}
                        hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]
                      `}
                    >
                      {/* Checkmark */}
                      <span className="w-4 shrink-0 flex items-center justify-center">
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 text-[#2B5FD9] dark:text-[#6B8FEF]" />
                        ) : null}
                      </span>

                      {/* Model info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {model.id === '' ? (
                            <Sparkles className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                          ) : null}
                          <span className="text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
                            {model.id === '' ? 'Auto (Recommended)' : model.name}
                          </span>
                        </div>
                        {model.capabilities && model.capabilities.length > 0 && model.id !== '' && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {model.capabilities.slice(0, 3).map((cap, capIdx) => (
                              <span
                                key={cap}
                                className="text-[10px] text-[#94A3B8] dark:text-[#64748B]"
                              >
                                {cap}
                                {capIdx < Math.min(model.capabilities?.length ?? 0, 3) - 1
                                  ? ' ·'
                                  : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {model.id === '' && (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">
                            VedMoulya chooses the best model for each task
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      {model.id !== '' && (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
