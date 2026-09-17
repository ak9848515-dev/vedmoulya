// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Providers overview (Screen 1)
// AI PROVIDER UX SIMPLIFICATION — "Expose decisions. Hide infrastructure."
//
// Two calm sections:
//   VEDMOULYA'S AI — the provider VedMoulya currently uses (Primary Brain),
//                    shown prominently with its model and connection status.
//   OTHER AI       — every other provider from the platform registry, as
//                    compact cards.
//
// Presentation only: all state and every action come from the existing
// provider experience view model + provider preferences service (passed in by
// the page). Endpoint, protocol, API version, capability ids, token limits and
// technical provider internals are deliberately NOT shown here.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Badge, EmptyState } from '@vedmoulya/ui';
import { MoreVertical, Settings2, Plus } from 'lucide-react';
import type { ProviderExperienceRowDTO, ProviderRuntimeStateDTO } from '../../lib/api-client.js';
import { ProviderMark } from './ProviderMark.js';
import { AddAIDialog, type AddAIOption } from './AddAIDialog.js';
import {
  isProviderActive,
  providerIdentity,
  providerStatusDisplay,
  type ProviderStatusDisplay,
} from './provider-ux.js';

/**
 * The Primary Brain every VedMoulya account starts with. Mirrors the domain
 * default in @vedmoulya/providers (DEFAULT_PRIMARY_BRAIN_PROVIDER_ID) — the
 * web bundle must not import that package's runtime values, so the id is
 * mirrored here and always resolved against the real provider registry.
 */
export const DEFAULT_PRIMARY_PROVIDER_ID = 'google';

/** Preference fields this screen reads (owner-scoped, non-secret). */
export interface ProviderOverviewPreferences {
  preferredProviderId?: string;
  preferredModelId?: string;
  disabledProviderIds: string[];
}

export interface ProvidersOverviewProps {
  userId: string;
  providers: ProviderExperienceRowDTO[];
  runtimeByFamily: Map<string, ProviderRuntimeStateDTO>;
  preferences: ProviderOverviewPreferences | undefined;
  /** Provider whose toggle is in flight (disables its own controls). */
  updatingProviderId: string | null;
  /** Open the Configure AI experience for a provider. */
  onConfigure: (providerId: string) => void;
  /** Open the full provider detail (registry intelligence) view. */
  onOpenDetails: (providerId: string) => void;
  onToggle: (providerId: string, enabled: boolean) => void;
  onSetPrimary: (providerId: string) => void;
  addAIOpen: boolean;
  onAddAIOpenChange: (open: boolean) => void;
}

// ── The ⋮ actions menu (keyboard + screen-reader accessible) ────────────────

interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Explanation shown when the action is not available. */
  disabledReason?: string;
}

function ProviderMenu({
  providerName,
  items,
}: {
  providerName: string;
  items: MenuItem[];
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  // Keyboard users land inside the menu when it opens and return to the
  // trigger when it closes (WCAG 2.1 — predictable focus movement).
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return (): void => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        ref={triggerRef}
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More actions for ${providerName}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${providerName}`}
          className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-1 shadow-lg"
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              ref={index === 0 ? firstItemRef : undefined}
              role="menuitem"
              aria-disabled={item.disabled ?? false}
              title={item.disabled ? item.disabledReason : undefined}
              disabled={item.disabled ?? false}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-[#374151] dark:text-[#E2E8F0] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Status line ─────────────────────────────────────────────────────────────

function ConnectionStatus({
  status,
  active,
  className = '',
}: {
  status: ProviderStatusDisplay;
  active: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${status.connection.tone}`}
        title={status.connection.hint}
      >
        <span aria-hidden="true">{status.connection.symbol}</span>
        {status.connection.label}
      </span>
      {active ? (
        <Badge variant="success" size="sm" className="gap-1">
          <span aria-hidden="true">●</span>
          ACTIVE
        </Badge>
      ) : null}
    </span>
  );
}

// ── Primary provider card ───────────────────────────────────────────────────

function PrimaryProviderCard({
  provider,
  status,
  active,
  menuItems,
  onConfigure,
}: {
  provider: ProviderExperienceRowDTO;
  status: ProviderStatusDisplay;
  active: boolean;
  menuItems: MenuItem[];
  onConfigure: () => void;
}): React.JSX.Element {
  const identity = providerIdentity(provider.family, provider.name);
  return (
    <div
      className="rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-5 sm:p-6"
      data-testid={`primary-provider-${provider.providerId}`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <ProviderMark family={provider.family} name={provider.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[18px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
            {identity.name}
          </h3>
          <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8]">{identity.vendor}</p>
          <p className="mt-3 text-[14px] font-medium text-[#374151] dark:text-[#E2E8F0] truncate">
            {provider.selectedModel?.name ?? 'Automatic model selection'}
          </p>
          <ConnectionStatus status={status} active={active} className="mt-1.5" />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3.5 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
          aria-label={`Configure ${identity.name}`}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
          Configure
        </button>
        <ProviderMenu providerName={identity.name} items={menuItems} />
      </div>
    </div>
  );
}

// ── Compact provider card (Other AI) ────────────────────────────────────────

function ProviderCard({
  provider,
  status,
  active,
  menuItems,
  onConfigure,
}: {
  provider: ProviderExperienceRowDTO;
  status: ProviderStatusDisplay;
  active: boolean;
  menuItems: MenuItem[];
  onConfigure: () => void;
}): React.JSX.Element {
  const identity = providerIdentity(provider.family, provider.name);
  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-4 py-3.5 sm:px-5"
      data-testid={`provider-card-${provider.providerId}`}
    >
      <ProviderMark family={provider.family} name={provider.name} size="md" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
          {identity.name}
        </h3>
        <p className="text-[12.5px] text-[#64748B] dark:text-[#94A3B8] truncate">
          {provider.selectedModel?.name ?? identity.vendor}
        </p>
        <ConnectionStatus status={status} active={active} className="mt-1" />
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3.5 text-[13px] font-medium text-[#374151] dark:text-[#E2E8F0] hover:border-[#2B5FD9]/40 hover:text-[#2B5FD9] dark:hover:text-[#6B8FEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5FD9] transition-colors"
          aria-label={`Configure ${identity.name}`}
        >
          Configure
        </button>
        <ProviderMenu providerName={identity.name} items={menuItems} />
      </div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

export function ProvidersOverview({
  userId,
  providers,
  runtimeByFamily,
  preferences,
  updatingProviderId,
  onConfigure,
  onOpenDetails,
  onToggle,
  onSetPrimary,
  addAIOpen,
  onAddAIOpenChange,
}: ProvidersOverviewProps): React.JSX.Element {
  // The provider VedMoulya is currently using: the user's choice, or the
  // domain default (Gemini) when they never chose — resolved against the REAL
  // registry, never assumed to exist.
  const preferredId = preferences?.preferredProviderId ?? DEFAULT_PRIMARY_PROVIDER_ID;
  const primary = providers.find((p) => p.providerId === preferredId) ?? providers[0];
  const primaryId = primary?.providerId;

  const statusOf = (provider: ProviderExperienceRowDTO): ProviderStatusDisplay =>
    providerStatusDisplay(
      runtimeByFamily.get(provider.family)?.status,
      providerIdentity(provider.family, provider.name).name,
    );

  const menuItemsFor = (provider: ProviderExperienceRowDTO): MenuItem[] => {
    const isPrimary = provider.providerId === preferredId;
    const busy = updatingProviderId === provider.providerId;
    // Disabling is refused by the server while this provider is the last
    // enabled one or the current Primary AI — the reason is surfaced verbatim.
    const cannotDisable = provider.enabled && Boolean(provider.switchDisabledReason);
    return [
      {
        label: provider.enabled ? 'Turn off for now' : 'Use this AI',
        onSelect: (): void => {
          onToggle(provider.providerId, !provider.enabled);
        },
        disabled: busy || cannotDisable,
        ...(provider.switchDisabledReason ? { disabledReason: provider.switchDisabledReason } : {}),
      },
      {
        label: isPrimary ? 'Primary AI' : 'Use as primary AI',
        onSelect: (): void => {
          onSetPrimary(provider.providerId);
        },
        disabled: busy || isPrimary || !provider.enabled,
        ...(!provider.enabled ? { disabledReason: 'Turn this AI on first.' } : {}),
      },
      {
        label: 'Provider details',
        onSelect: (): void => {
          onOpenDetails(provider.providerId);
        },
      },
    ];
  };

  const options: AddAIOption[] = providers.map((provider) => ({
    family: provider.family,
    name: provider.name,
    connected: statusOf(provider).configured,
  }));

  if (providers.length === 0) {
    return (
      <EmptyState
        icon={<Plus className="h-8 w-8" />}
        title="No AI connected yet"
        description="Connect an AI to VedMoulya — the rest is handled for you."
      />
    );
  }

  const others = providers.filter((provider) => provider.providerId !== primaryId);
  const primaryStatus = primary ? statusOf(primary) : undefined;

  return (
    <div className="space-y-7">
      <section aria-labelledby="vedmoulyas-ai-heading" className="space-y-3">
        <h2
          id="vedmoulyas-ai-heading"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-[#94A3B8]"
        >
          VedMoulya&apos;s AI
        </h2>
        {primary && primaryStatus ? (
          <PrimaryProviderCard
            provider={primary}
            status={primaryStatus}
            active={isProviderActive(primary.enabled, primaryStatus)}
            menuItems={menuItemsFor(primary)}
            onConfigure={() => {
              onConfigure(primary.providerId);
            }}
          />
        ) : null}
      </section>

      {others.length > 0 ? (
        <section aria-labelledby="other-ai-heading" className="space-y-3">
          <h2
            id="other-ai-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-[#94A3B8]"
          >
            Other AI
          </h2>
          <div className="space-y-2.5">
            {others.map((provider) => {
              const status = statusOf(provider);
              return (
                <ProviderCard
                  key={provider.providerId}
                  provider={provider}
                  status={status}
                  active={isProviderActive(provider.enabled, status)}
                  menuItems={menuItemsFor(provider)}
                  onConfigure={() => {
                    onConfigure(provider.providerId);
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      <AddAIDialog
        open={addAIOpen}
        onOpenChange={onAddAIOpenChange}
        options={options}
        userId={userId}
        onSelect={(family) => {
          onAddAIOpenChange(false);
          onConfigure(family);
        }}
        onProviderAdded={() => {
          onAddAIOpenChange(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
