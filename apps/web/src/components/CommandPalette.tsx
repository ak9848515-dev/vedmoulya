/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VisuallyHidden } from '@vedmoulya/ui';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search,
  Command,
  Briefcase,
  BookOpen,
  BarChart3,
  Store,
  LayoutDashboard,
  Lightbulb,
  Settings,
  User,
  X,
  Sparkles,
} from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { useRouter } from 'next/navigation.js';

interface SearchResult {
  id: string;
  category: string;
  title: string;
  description: string;
  route: string;
  icon: React.ReactNode;
}

/**
 * Command Palette navigation results — routes must match the one navigation
 * model in `lib/navigation-model.ts`. Every entry is a real, deep-linkable
 * route that resolves to an existing page.
 */
const STATIC_RESULTS: SearchResult[] = [
  {
    id: 'home',
    category: 'Navigation',
    title: 'Home',
    description: 'Your Life OS overview',
    route: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    id: 'missions',
    category: 'Navigation',
    title: 'Missions',
    description: 'Your goals, missions and execution',
    route: '/autonomous-builder',
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    id: 'progress',
    category: 'Navigation',
    title: 'Progress',
    description: 'What is changing in your life',
    route: '/progress',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'life',
    category: 'Navigation',
    title: 'Life',
    description: 'Career, learning and business',
    route: '/life',
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    id: 'career',
    category: 'Navigation',
    title: 'Career',
    description: 'Your career goals and progress',
    route: '/career',
    icon: <Briefcase className="h-4 w-4" />,
  },
  {
    id: 'learning',
    category: 'Navigation',
    title: 'Learning',
    description: 'What you are learning next',
    route: '/learning',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'business',
    category: 'Navigation',
    title: 'Business',
    description: 'Ventures, clients and results',
    route: '/business',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'ai',
    category: 'Navigation',
    title: 'AI',
    description: 'Providers, intelligence, memory and knowledge',
    route: '/ai',
    icon: <Store className="h-4 w-4" />,
  },
  {
    id: 'providers',
    category: 'Navigation',
    title: 'Providers',
    description: 'Connect and manage AI providers',
    route: '/providers',
    icon: <Store className="h-4 w-4" />,
  },
  {
    id: 'marketplace',
    category: 'Navigation',
    title: 'Marketplace',
    description: 'Capabilities and skills you can add',
    route: '/marketplace',
    icon: <Store className="h-4 w-4" />,
  },
  {
    id: 'settings',
    category: 'Navigation',
    title: 'Settings',
    description: 'Account, appearance, notifications and security',
    route: '/settings',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: 'profile',
    category: 'User',
    title: 'Profile',
    description: 'Your identity, goals and public presence',
    route: '/settings?tab=profile',
    icon: <User className="h-4 w-4" />,
  },
];

export function CommandPalette(): React.JSX.Element {
  const { globalSearchOpen, setGlobalSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredResults = query
    ? STATIC_RESULTS.filter(
        (r) =>
          r.title.toLowerCase().includes(query.toLowerCase()) ||
          r.description.toLowerCase().includes(query.toLowerCase()) ||
          r.category.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  // No query → show the primary destinations as a starting point (browse);
  // with a query → the matching real routes. There is no fabricated "recent"
  // history here: the palette performs no AI call and stores no search history.
  const displayItems = query ? filteredResults : STATIC_RESULTS.slice(0, 5);

  const handleClose = useCallback(() => {
    setGlobalSearchOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, [setGlobalSearchOpen]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      router.push(item.route);
      handleClose();
    },
    [router, handleClose],
  );

  useEffect(() => {
    if (globalSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [globalSearchOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalSearchOpen, setGlobalSearchOpen]);

  const handleKeyNavigation = (e: React.KeyboardEvent): void => {
    const maxIndex = displayItems.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && displayItems[selectedIndex]) {
          handleSelect(displayItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  };

  function handleClearQuery(): void {
    setQuery('');
    setSelectedIndex(0);
    inputRef.current?.focus();
  }

  return (
    <DialogPrimitive.Root
      open={globalSearchOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[150] bg-[rgba(15,23,42,0.5)] backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed z-[200] left-[50%] top-[10%] translate-x-[-50%] w-[calc(100vw-24px)] max-w-[640px] bg-white rounded-[20px] shadow-[0_25px_50px_rgba(15,23,42,0.15)] overflow-hidden border border-[#E2E8F0]"
          onKeyDown={handleKeyNavigation}
        >
          <VisuallyHidden>
            <h2>Command Palette</h2>
          </VisuallyHidden>
          {/* Search Input */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#E2E8F0]">
            <Search className="h-5 w-5 text-[#94A3B8] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search anything..."
              className="flex-1 text-[16px] text-[#1F2937] placeholder:text-[#94A3B8] bg-transparent border-none outline-none focus:outline-none"
              aria-label="Search"
            />
            {query && (
              <button
                onClick={handleClearQuery}
                aria-label="Clear search"
                className="p-1 rounded-md hover:bg-[#F1F5F9] transition-colors"
              >
                <X className="h-4 w-4 text-[#94A3B8]" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#94A3B8] bg-[#F1F5F9] rounded-md">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            <>
              {query && filteredResults.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <Search className="h-8 w-8 text-[#CBD5E1] mx-auto mb-2" />
                  <p className="text-[14px] text-[#94A3B8]">No results for &quot;{query}&quot;</p>
                  <p className="text-[12px] text-[#CBD5E1] mt-1">Try a different search term</p>
                </div>
              )}
              {displayItems.length > 0 && (
                <>
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase text-[#94A3B8] tracking-[0.05em]">
                    {query ? 'Results' : 'Go to'}
                  </p>
                  {displayItems.map((result, i) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        handleSelect(result);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${i === selectedIndex ? 'bg-[#EFF4FE]' : 'hover:bg-[#F1F5F9]'}`}
                    >
                      <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                        {result.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={`text-[14px] font-medium ${i === selectedIndex ? 'text-[#2B5FD9]' : 'text-[#374151]'}`}
                        >
                          {result.title}
                        </p>
                        <p className="text-[12px] text-[#94A3B8]">{result.description}</p>
                      </div>
                      <span className="text-[11px] text-[#CBD5E1]">{result.category}</span>
                    </button>
                  ))}
                </>
              )}
            </>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-5 py-3 border-t border-[#E2E8F0] text-[11px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#F1F5F9] rounded text-[10px] font-medium">↑↓</kbd>{' '}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#F1F5F9] rounded text-[10px] font-medium">↵</kbd>{' '}
              Open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#F1F5F9] rounded text-[10px] font-medium">Esc</kbd>{' '}
              Close
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#7C3AED]" /> Search VedMoulya
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
