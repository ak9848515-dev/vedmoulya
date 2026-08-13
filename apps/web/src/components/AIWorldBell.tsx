// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI World Bell (top-right)
// EPIC-012C — the discovery bell: opens the AI WORLD panel (not a generic
// notification center). A dedicated bell next to the LifeOS notifications
// bell — the existing notification center is fully preserved.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Radar } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store.js';
import { useUIStore } from '../stores/ui-store.js';
import { useAIWorldWorld } from '../lib/api-client.js';

export function AIWorldBell(): React.JSX.Element {
  const { user } = useAuthStore();
  const { setAIWorldPanelOpen } = useUIStore();
  const userId = user?.userId ?? '';
  // The bell shares the world query with the drawer — react-query dedupes by
  // key, so this is the single source of truth for the unread badge.
  const { data } = useAIWorldWorld(userId);
  const unread = data?.world.unreadCount ?? 0;

  return (
    <button
      onClick={() => {
        setAIWorldPanelOpen(true);
      }}
      className="p-2 rounded-lg hover:bg-[#F5F3FF] dark:hover:bg-[#1E293B] transition-colors relative"
      aria-label={`AI World${unread > 0 ? ` — ${unread} unread` : ''}`}
      title="AI World"
    >
      <Radar className="h-5 w-5 text-[#7C3AED]" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
