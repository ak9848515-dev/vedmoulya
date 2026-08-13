// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World Drawer (the discovery bell panel)
// EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence (§8)
//
// Premium, minimal, uncluttered. Answers in seconds:
//   WHAT happened? → title + summary
//   WHY does it matter? → recommendation + relevance reasons
//   SHOULD I do something? → actions (Configure / Watch / Dismiss / Open)
// Sections: 🔥 Important · ⭐ Recommended · 🧩 GitHub · 📰 AI Updates + the
// concise "AI WORLD — TODAY" digest. The full experience lives at /ai-world.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, DrawerOverlay, DrawerContent } from '@vedmoulya/ui';
import { Radar, RefreshCw, CheckCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store.js';
import { useUIStore } from '../../stores/ui-store.js';
import {
  useAIWorldWorld,
  useAIWorldDigest,
  useAIWorldList,
  useAIWorldMarkRead,
  useAIWorldMarkAllRead,
  useAIWorldSetAction,
  useAIWorldRunDiscovery,
} from '../../lib/api-client.js';
import type { DiscoveryItem, DiscoveryItemAction } from '@vedmoulya/ai-world';
import { DiscoveryItemCard } from './DiscoveryItemCard.js';

const SECTION_LIMIT = 4;

function Section({
  title,
  items,
  readByItem,
  onConfigure,
  onMarkRead,
  onAction,
}: {
  title: string;
  items: DiscoveryItem[];
  readByItem: ReadonlyMap<string, boolean>;
  onConfigure: (item: DiscoveryItem) => void;
  onMarkRead: (itemId: string) => void;
  onAction: (itemId: string, action: DiscoveryItemAction) => void;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8] mb-2">
        {title}
      </h3>
      <div className="space-y-2">
        {items.slice(0, SECTION_LIMIT).map((item) => (
          <DiscoveryItemCard
            key={item.id}
            item={item}
            variant="compact"
            read={readByItem.get(item.id) ?? false}
            onMarkRead={() => {
              onMarkRead(item.id);
            }}
            onSetAction={(action) => {
              onAction(item.id, action);
            }}
            onConfigure={() => {
              onConfigure(item);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIWorldDrawer(): React.JSX.Element {
  const { aiWorldPanelOpen, setAIWorldPanelOpen } = useUIStore();
  const { user } = useAuthStore();
  const userId = user?.userId ?? '';
  const router = useRouter();

  const { data, isLoading, refetch } = useAIWorldWorld(userId);
  const { data: digest, refetch: refetchDigest } = useAIWorldDigest(userId);
  const { data: listViews, refetch: refetchList } = useAIWorldList(userId);
  const readByItem = new Map((listViews ?? []).map((v) => [v.item.id, v.read]));
  const markRead = useAIWorldMarkRead();
  const markAllRead = useAIWorldMarkAllRead();
  const setAction = useAIWorldSetAction();
  const runDiscovery = useAIWorldRunDiscovery();
  const [refreshing, setRefreshing] = useState(false);

  const world = data?.world;

  function close(): void {
    setAIWorldPanelOpen(false);
  }

  function goTo(path: string): void {
    close();
    // router.push returns void in the App Router — no Promise to discard.
    router.push(path);
  }

  function configure(item: DiscoveryItem): void {
    const family = item.modelFacts?.suggestedFamily;
    goTo(family ? `/providers?provider=${encodeURIComponent(family)}` : '/providers');
  }

  // Every mutation invalidates ALL three queries that drive this panel
  // (world = sections + unread count, digest = "AI World — Today", list =
  // per-item read state), so the drawer never shows stale read styling.
  async function refreshAll(): Promise<void> {
    await Promise.all([refetch(), refetchDigest(), refetchList()]);
  }

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      await runDiscovery.mutateAsync({ userId });
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    await markAllRead.mutateAsync({ userId });
    await refreshAll();
  }

  async function handleMarkRead(itemId: string): Promise<void> {
    await markRead.mutateAsync({ userId, itemId });
    await refreshAll();
  }

  async function handleAction(itemId: string, action: DiscoveryItemAction): Promise<void> {
    await setAction.mutateAsync({ userId, itemId, action });
    await refreshAll();
  }

  return (
    <Drawer
      open={aiWorldPanelOpen}
      onOpenChange={(open) => {
        setAIWorldPanelOpen(open);
      }}
    >
      <DrawerOverlay />
      <DrawerContent
        size="lg"
        aria-label="AI World"
        className="dark:bg-[#0F172A] dark:border-l dark:border-[#334155]"
      >
        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between -mt-2 mb-3">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-[#7C3AED]" />
            <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              What changed in AI — and what matters to you
            </span>
          </div>
          <div className="flex items-center gap-1">
            {world && world.unreadCount > 0 && (
              <button
                onClick={() => {
                  void handleMarkAllRead();
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => {
                void handleRefresh();
              }}
              disabled={refreshing || Boolean(data?.runAvailableAt)}
              title={
                data?.runAvailableAt
                  ? `Next refresh available at ${new Date(data.runAvailableAt).toLocaleTimeString()}`
                  : 'Refresh discoveries'
              }
              className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors disabled:opacity-40"
              aria-label="Refresh discoveries"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 pb-4">
          {isLoading && !world && (
            <p className="text-[12px] text-[#64748B] dark:text-[#94A3B8] py-8 text-center">
              Exploring the AI world…
            </p>
          )}

          {world && world.unreadCount === 0 && (
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] p-3 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
              All caught up on the AI world.
            </div>
          )}

          {/* ── Today's digest ─────────────────────────────────────────── */}
          {digest && digest.entries.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] p-3">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[#111827] dark:text-[#F8FAFC]">
                AI World — Today
              </h3>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">{digest.summary}</p>
              <ul className="mt-2 space-y-1">
                {digest.entries.slice(0, 3).map((entry) => (
                  <li key={entry.item.id} className="flex items-start gap-2 text-[11px]">
                    <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-[#2B5FD9] dark:bg-[#6B8FEF]" />
                    <span className="text-[#374151] dark:text-[#E2E8F0]">
                      {entry.item.title}
                      <span className="text-[#94A3B8]"> — {entry.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Sections ───────────────────────────────────────────────── */}
          {world && (
            <>
              <Section
                title="🔥 Important for VedMoulya"
                items={world.important}
                readByItem={readByItem}
                onConfigure={configure}
                onMarkRead={(itemId) => {
                  void handleMarkRead(itemId);
                }}
                onAction={(itemId, action) => {
                  void handleAction(itemId, action);
                }}
              />
              <Section
                title="⭐ Recommended for You"
                items={world.recommended}
                readByItem={readByItem}
                onConfigure={configure}
                onMarkRead={(itemId) => {
                  void handleMarkRead(itemId);
                }}
                onAction={(itemId, action) => {
                  void handleAction(itemId, action);
                }}
              />
              <Section
                title="🧩 New GitHub Projects"
                items={world.github}
                readByItem={readByItem}
                onConfigure={configure}
                onMarkRead={(itemId) => {
                  void handleMarkRead(itemId);
                }}
                onAction={(itemId, action) => {
                  void handleAction(itemId, action);
                }}
              />
              <Section
                title="📰 AI Updates"
                items={world.updates}
                readByItem={readByItem}
                onConfigure={configure}
                onMarkRead={(itemId) => {
                  void handleMarkRead(itemId);
                }}
                onAction={(itemId, action) => {
                  void handleAction(itemId, action);
                }}
              />
            </>
          )}

          {world &&
            world.important.length === 0 &&
            world.recommended.length === 0 &&
            world.github.length === 0 &&
            world.updates.length === 0 && (
              <p className="text-[12px] text-[#94A3B8] text-center py-6">
                Nothing new that matters right now. Discovery runs on a bounded schedule.
              </p>
            )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#334155] -mx-6 px-6">
          {data?.runAvailableAt ? (
            <span className="text-[11px] text-[#94A3B8]">
              Next refresh · {new Date(data.runAvailableAt).toLocaleTimeString()}
            </span>
          ) : (
            <span />
          )}
          <button
            onClick={() => {
              goTo('/ai-world');
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
          >
            Open AI World
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
