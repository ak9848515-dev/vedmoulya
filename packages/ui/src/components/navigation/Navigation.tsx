// ──────────────────────────────────────────────────────────────────
// VedMoulya — Navigation Components
// Tabs, NavBar, Sidebar, Breadcrumb, Search
// Follows DES-001/D07 Component System, DES-010A/D07 Component Behaviour
// ──────────────────────────────────────────────────────────────────

'use client';

import React, { forwardRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Search as SearchIcon, X, Menu, ChevronRight } from 'lucide-react';
import { cn } from '../../utilities/cn.js';
import { focusRing } from '../../utilities/accessibility.js';

// ── Tabs ───────────────────────────────────────────────────────────────────

export const TabsRoot = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex h-10 items-center gap-1 rounded-lg bg-[#F1F5F9] p-1', className)}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-[13px] font-medium',
      'transition-all duration-150 ease-out',
      'text-[#64748B] hover:text-[#1F2937]',
      'data-[state=active]:bg-white data-[state=active]:text-[#1F2937] data-[state=active]:shadow-sm',
      'disabled:pointer-events-none disabled:opacity-40',
      focusRing.base,
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

// ── Navigation Bar ─────────────────────────────────────────────────────────

export interface NavBarProps {
  logo?: React.ReactNode;
  leftItems?: React.ReactNode;
  rightItems?: React.ReactNode;
  /** Actions rendered on MOBILE viewports only (rightItems are desktop-only).
      Used for the AI Companion / Command Center trigger so founders on phones
      keep access to their opportunities (SPRINT-043E responsive cert). */
  mobileActions?: React.ReactNode;
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
  className?: string;
}

export function NavBar({
  logo,
  leftItems,
  rightItems,
  mobileActions,
  mobileMenuOpen,
  onMobileMenuToggle,
  className,
}: NavBarProps): React.JSX.Element {
  return (
    <header className={cn('h-16 border-b border-[#E2E8F0] bg-white', className)}>
      <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-6">
          {logo && <div className="shrink-0">{logo}</div>}
          <nav className="hidden md:flex items-center gap-1">{leftItems}</nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3">{rightItems}</div>
          {mobileActions && (
            <div className="md:hidden flex items-center gap-1">{mobileActions}</div>
          )}
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-[#374151]" />
            ) : (
              <Menu className="h-5 w-5 text-[#374151]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string | number;
  disabled?: boolean;
  onClick?: () => void;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  groups: SidebarGroup[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  _unused?: never;
  className?: string;
}

export function Sidebar({
  groups,
  collapsed = false,
  onToggleCollapse: _onToggleCollapse,
  className,
}: SidebarProps): React.JSX.Element {
  return (
    <aside
      className={cn(
        'h-full bg-[#F5F7FA] border-r border-[#E2E8F0] flex flex-col',
        'transition-all duration-250 ease-out',
        collapsed ? 'w-16' : 'w-[280px]',
        className,
      )}
    >
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase text-[#94A3B8] tracking-[0.05em]">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] font-medium',
                    'transition-all duration-150 ease-out',
                    'relative',
                    item.active
                      ? 'bg-[#EFF4FE] text-[#2B5FD9]'
                      : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1F2937]',
                    item.disabled && 'opacity-40 cursor-not-allowed',
                    collapsed && 'justify-center px-2',
                    focusRing.base,
                  )}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  {item.icon && (
                    <span
                      className={cn('shrink-0', item.active ? 'text-[#2B5FD9]' : 'text-[#64748B]')}
                    >
                      {item.icon}
                    </span>
                  )}
                  {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B]">
                      {item.badge}
                    </span>
                  )}
                  {item.active && !collapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#2B5FD9] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps): React.JSX.Element {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-[13px]', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.label}>
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-[#CBD5E1]" aria-hidden="true" />
            )}
            {isLast ? (
              <span className="text-[#1F2937] font-semibold">{item.label}</span>
            ) : (
              <a
                href={item.href || '#'}
                className="text-[#64748B] hover:text-[#2B5FD9] transition-colors"
              >
                {item.label}
              </a>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface SearchProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  onSearch?: (value: string) => void;
  recentSearches?: string[];
  className?: string;
}

export function Search({
  value,
  onChange,
  placeholder = 'Search...',
  onSearch,
  recentSearches,
  className,
}: SearchProps): React.JSX.Element {
  const [localValue, setLocalValue] = React.useState(value || '');
  const [showRecent, setShowRecent] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : localValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!isControlled) setLocalValue(e.target.value);
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      onSearch?.(currentValue);
      setShowRecent(false);
    }
  };

  const handleClear = (): void => {
    if (!isControlled) setLocalValue('');
    onChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <SearchIcon
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B] pointer-events-none"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={currentValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setShowRecent(true);
        }}
        onBlur={() =>
          setTimeout(() => {
            setShowRecent(false);
          }, 200)
        }
        placeholder={placeholder}
        className={cn(
          'w-full h-11 rounded-[16px] border border-[#CBD5E1] bg-white pl-10 pr-10',
          'text-[16px] text-[#1F2937] placeholder:text-[#4B5563]',
          'transition-all duration-150 ease-out',
          'focus:border-[#2B5FD9] focus:ring-[3px] focus:ring-[#2B5FD9] focus:ring-opacity-30',
          focusRing.base,
        )}
        aria-label={placeholder}
      />
      {currentValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Recent searches dropdown */}
      {showRecent && recentSearches && recentSearches.length > 0 && !currentValue && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-[8px] shadow-[0_1px_3px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.03)] p-2 z-10">
          <p className="text-[11px] font-semibold uppercase text-[#94A3B8] tracking-[0.05em] px-2 py-1">
            Recent
          </p>
          {recentSearches.map((search) => (
            <button
              key={search}
              onClick={() => {
                if (!isControlled) setLocalValue(search);
                onChange?.(search);
                onSearch?.(search);
              }}
              className="w-full text-left px-2 py-2 rounded-md text-[14px] text-[#374151] hover:bg-[#F1F5F9] transition-colors"
            >
              {search}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
