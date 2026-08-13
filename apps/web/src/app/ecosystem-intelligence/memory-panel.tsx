// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Ecosystem Intelligence: Intelligence Memory panel
// EPIC-015 — Evidence + lifecycle state persist with full provenance:
//   DISCOVERED → VERIFIED → SECURITY_REVIEWED → RECOMMENDED → USER_APPROVED →
//   CONFIGURED → VALIDATED → ACTIVE → STALE → DEPRECATED → BLOCKED.
// Deprecated models/providers/repos are NEVER silently deleted — preserved
// with provenance. Notifications are relevance-gated: only meaningful events
// surface (a better provider, a new free model, a security warning…), never
// every ecosystem event.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge, Loading, EmptyState } from '@vedmoulya/ui';
import { Database, Bell, ShieldAlert, Sparkles, CheckCheck } from 'lucide-react';
import {
  useIntelligenceListLifecycle,
  useIntelligenceListNotifications,
  useIntelligenceMarkNotificationRead,
} from '../../lib/api-client.js';
import {
  LIFECYCLE_COLORS,
  NOTIFICATION_LABELS,
  formatDateTime,
  formatHuman,
} from './intelligence-ui.js';

export function IntelligenceMemoryPanel({ userId }: { userId: string }): React.JSX.Element {
  const lifecycle = useIntelligenceListLifecycle(userId);
  const notifications = useIntelligenceListNotifications(userId);
  const markRead = useIntelligenceMarkNotificationRead();

  async function handleMarkRead(id: string): Promise<void> {
    try {
      await markRead.mutateAsync({ userId, id });
      void notifications.refetch();
    } catch {
      /* non-fatal */
    }
  }

  const unread = (notifications.data ?? []).filter((n) => !n.read).length;
  const records = lifecycle.data ?? [];
  const items = notifications.data ?? [];

  return (
    <div className="space-y-4">
      {/* ── Notifications (relevance-gated) ───────────────────────────── */}
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F59E0B]" />
            <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
              Meaningful intelligence notifications
            </h3>
            {unread > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[#F59E0B] text-white text-[10px] font-bold">
                {String(unread)} unread
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Relevance-gated — never one notification per ecosystem event.
          </p>
        </div>

        {notifications.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loading label="Loading notifications…" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="No meaningful events yet"
            description="Notifications surface only for meaningful, relevant events: a materially better provider, a new free model, a quota increase, a security warning — never every ecosystem event."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border transition-colors ${
                  notification.read
                    ? 'border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] opacity-70'
                    : 'border-[#F59E0B]/30 dark:border-[#F59E0B]/40 bg-amber-50/50 dark:bg-[#451A03]/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert
                      className={`h-4 w-4 shrink-0 ${notification.read ? 'text-[#94A3B8]' : 'text-[#F59E0B]'}`}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#111827] dark:text-[#F8FAFC] truncate">
                        {notification.title}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {notification.body}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline px-1.5 py-px rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-medium text-[#64748B] dark:text-[#CBD5E1]">
                      {NOTIFICATION_LABELS[notification.kind] ?? formatHuman(notification.kind)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">
                      {formatDateTime(notification.createdAt)}
                    </span>
                    {!notification.read && (
                      <button
                        onClick={() => {
                          void handleMarkRead(notification.id);
                        }}
                        disabled={markRead.isPending}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#2B5FD9] dark:text-[#6B8FEF] hover:underline"
                      >
                        <CheckCheck className="h-3 w-3" /> Mark read
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 max-w-[120px] rounded-full bg-[#E2E8F0] dark:bg-[#334155] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#F59E0B]"
                      style={{ width: `${Math.max(0, Math.min(100, notification.relevance))}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#94A3B8]">
                    relevance {String(Math.round(notification.relevance))}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Lifecycle records ─────────────────────────────────────────── */}
      <Card variant="standard" padding="lg" className="dark:bg-[#1E293B]">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[#2B5FD9]" />
          <h3 className="text-[14px] font-heading font-semibold text-[#111827] dark:text-[#F8FAFC]">
            Intelligence memory — lifecycle with provenance
          </h3>
          {records.length > 0 && (
            <Badge variant="info" size="sm">
              {String(records.length)} record(s)
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[#94A3B8]">
          Deprecated models, providers and repositories are never silently deleted — every
          transition keeps its evidence, timestamp and reason.
        </p>

        {lifecycle.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loading label="Loading intelligence memory…" />
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={<Database className="h-6 w-6" />}
            title="No lifecycle records yet"
            description="Run task intelligence, assess a repository, or respond to a recommendation — every meaningful intelligence event is recorded here with its evidence and provenance."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {records.map((record) => (
              <div
                key={record.resourceId}
                className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="h-3.5 w-3.5 text-[#7C3AED] shrink-0" />
                    <p className="text-[12px] font-medium text-[#111827] dark:text-[#F8FAFC] font-mono truncate">
                      {record.resourceId}
                    </p>
                    <span className="px-1.5 py-px rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-medium text-[#64748B] dark:text-[#CBD5E1]">
                      {record.resourceKind}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${LIFECYCLE_COLORS[record.state] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {formatHuman(record.state)}
                    </span>
                    <span className="text-[9px] text-[#94A3B8]">
                      {formatDateTime(record.updatedAt)}
                    </span>
                  </div>
                </div>

                {record.evidence.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {record.evidence.map((e) => (
                      <li
                        key={e}
                        className="text-[10px] text-[#64748B] dark:text-[#94A3B8] flex items-start gap-1.5"
                      >
                        <span className="text-[#2B5FD9]">•</span> {e}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Provenance history */}
                {record.history.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
                    <p className="text-[9px] font-semibold text-[#94A3B8] uppercase tracking-wide">
                      Provenance
                    </p>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {record.history.map((h, idx) => (
                        <React.Fragment key={`${h.at}-${h.state}`}>
                          {idx > 0 && (
                            <span className="text-[9px] text-[#CBD5E1] dark:text-[#475569]">→</span>
                          )}
                          <span
                            className="px-1.5 py-px rounded bg-[#F1F5F9] dark:bg-[#334155] text-[9px] font-medium text-[#64748B] dark:text-[#CBD5E1]"
                            title={`${formatDateTime(h.at)} — ${h.reason}`}
                          >
                            {formatHuman(h.state)}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
