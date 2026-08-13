'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerOverlay, DrawerContent, VisuallyHidden } from '@vedmoulya/ui';
import {
  Bell,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useUIStore } from '../stores/ui-store.js';
import { Badge } from '@vedmoulya/ui';
import { useAuthStore } from '../stores/auth-store.js';
import {
  useIntelligenceListNotifications,
  useIntelligenceMarkNotificationRead,
} from '../lib/api-client.js';

type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'reminder';

/** Human label for the EPIC-015 notification kinds (source chip + a11y). */
const KIND_LABELS: Record<string, string> = {
  BETTER_PROVIDER_DISCOVERED: 'Provider Intelligence',
  NEW_FREE_MODEL: 'AI World',
  FREE_QUOTA_INCREASED: 'AI World',
  PROVIDER_UNAVAILABLE: 'Provider Status',
  PROVIDER_RETIRED: 'Provider Status',
  USEFUL_GITHUB_PROJECT: 'GitHub',
  SECURITY_WARNING: 'Security',
  LICENSE_CONCERN: 'License',
  LOCAL_MODEL_SUITABLE: 'Local Models',
  PAID_TOOL_MATERIALLY_BETTER: 'Intelligence',
  CONFIGURED_PROVIDER_CHANGED: 'Configuration',
  NEW_OPPORTUNITY: 'Opportunities',
};

/** kind → drawer type (visual tone). Defaults to info — never crashes on a new kind. */
const KIND_TYPES: Record<string, NotificationType> = {
  BETTER_PROVIDER_DISCOVERED: 'info',
  NEW_FREE_MODEL: 'success',
  FREE_QUOTA_INCREASED: 'success',
  PROVIDER_UNAVAILABLE: 'error',
  PROVIDER_RETIRED: 'warning',
  USEFUL_GITHUB_PROJECT: 'info',
  SECURITY_WARNING: 'error',
  LICENSE_CONCERN: 'warning',
  LOCAL_MODEL_SUITABLE: 'info',
  PAID_TOOL_MATERIALLY_BETTER: 'warning',
  CONFIGURED_PROVIDER_CHANGED: 'reminder',
  NEW_OPPORTUNITY: 'info',
};

/** Kinds that always deserve a deep-link action (AI World / Providers / Brain). */
const ACTIONABLE_KINDS = new Set([
  'BETTER_PROVIDER_DISCOVERED',
  'NEW_FREE_MODEL',
  'FREE_QUOTA_INCREASED',
  'USEFUL_GITHUB_PROJECT',
  'LOCAL_MODEL_SUITABLE',
  'PAID_TOOL_MATERIALLY_BETTER',
  'NEW_OPPORTUNITY',
]);

/** Per-kind deep-link override. Default is /ai-world (discovery surface). */
const KIND_ROUTES: Record<string, string> = {
  NEW_OPPORTUNITY: '/brain',
};

interface DrawerNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  source: string;
  isRead: boolean;
  isActionable: boolean;
  actionLabel?: string;
  actionRoute?: string;
  priority: number;
  createdAt: string;
}

const TYPE_STYLES: Record<NotificationType, { bg: string; icon: React.ReactNode; dot: string }> = {
  info: {
    bg: 'bg-[#EFF6FF]',
    icon: <Lightbulb className="h-4 w-4 text-[#3B82F6]" />,
    dot: 'bg-[#3B82F6]',
  },
  warning: {
    bg: 'bg-[#FFFBEB]',
    icon: <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />,
    dot: 'bg-[#F59E0B]',
  },
  error: {
    bg: 'bg-[#FEF2F2]',
    icon: <AlertTriangle className="h-4 w-4 text-[#EF4444]" />,
    dot: 'bg-[#EF4444]',
  },
  success: {
    bg: 'bg-[#F0FDF4]',
    icon: <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />,
    dot: 'bg-[#22C55E]',
  },
  reminder: {
    bg: 'bg-[#F5F3FF]',
    icon: <Clock className="h-4 w-4 text-[#7C3AED]" />,
    dot: 'bg-[#7C3AED]',
  },
};

export function NotificationsDrawer(): React.JSX.Element {
  const { notificationsPanelOpen, setNotificationsPanelOpen } = useUIStore();
  const userId = useAuthStore((s) => s.user?.userId ?? '');
  const [filter, setFilter] = useState<'all' | 'unread' | 'actionable'>('all');

  const notificationsQuery = useIntelligenceListNotifications(userId);
  const markRead = useIntelligenceMarkNotificationRead();

  const notifications: DrawerNotification[] = useMemo(() => {
    const items = notificationsQuery.data ?? [];
    return items.map((n) => {
      const type = KIND_TYPES[n.kind] ?? 'info';
      const isActionable = ACTIONABLE_KINDS.has(n.kind) || Boolean(n.itemId);
      return {
        id: n.id,
        type,
        title: n.title,
        message: n.body,
        source: KIND_LABELS[n.kind] ?? n.kind,
        isRead: n.read === true,
        isActionable,
        actionLabel: isActionable ? 'View' : undefined,
        actionRoute: isActionable ? (KIND_ROUTES[n.kind] ?? '/ai-world') : undefined,
        priority: n.relevance,
        createdAt: n.createdAt,
      };
    });
  }, [notificationsQuery.data]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.isRead);
    if (filter === 'actionable') return notifications.filter((n) => n.isActionable);
    return notifications;
  }, [notifications, filter]);

  async function handleMarkRead(notification: DrawerNotification): Promise<void> {
    if (notification.isRead || !userId) return;
    await markRead.mutateAsync({ userId, id: notification.id });
    await notificationsQuery.refetch();
  }

  async function handleMarkAllRead(): Promise<void> {
    if (!userId) return;
    const unread = notifications.filter((n) => !n.isRead);
    for (const n of unread) {
      await markRead.mutateAsync({ userId, id: n.id });
    }
    if (unread.length > 0) await notificationsQuery.refetch();
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && notificationsPanelOpen) {
        setNotificationsPanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsPanelOpen, setNotificationsPanelOpen]);

  function handleCloseNotifications(): void {
    setNotificationsPanelOpen(false);
  }

  function handleDrawerOpenChange(open: boolean): void {
    setNotificationsPanelOpen(open);
  }

  return (
    <Drawer open={notificationsPanelOpen} onOpenChange={handleDrawerOpenChange}>
      <DrawerOverlay className="fixed inset-0 z-[100] bg-[rgba(15,23,42,0.5)]" />
      <DrawerContent
        className="fixed z-[100] right-0 top-0 h-full w-[420px] bg-white shadow-xl overflow-y-auto"
        aria-label="Notifications"
      >
        <VisuallyHidden>
          <h2>Notification Center</h2>
        </VisuallyHidden>
        <div className="p-6 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#F5F3FF]">
                <Bell className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <div>
                <h3 className="text-[18px] font-semibold text-[#111827]">Notifications</h3>
                <p className="text-[12px] text-[#94A3B8]">
                  {notificationsQuery.isLoading
                    ? 'Loading…'
                    : unreadCount > 0
                      ? `${String(unreadCount)} unread`
                      : 'All caught up'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseNotifications}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4 text-[#64748B]" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[#E2E8F0]">
            {(
              [
                ['all', 'All'],
                ['unread', 'Unread'],
                ['actionable', 'Actionable'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setFilter(value);
                }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  filter === value
                    ? 'bg-[#EFF4FE] text-[#2B5FD9]'
                    : 'text-[#64748B] hover:bg-[#F1F5F9]'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto">
              <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
            </span>
          </div>

          {/* Notification List */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {notificationsQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-[#FCA5A5] mb-3" />
                <p className="text-[15px] font-medium text-[#991B1B]">
                  Couldn&apos;t load notifications
                </p>
                <p className="text-[13px] text-[#94A3B8] text-center">
                  The notification feed is temporarily unavailable.
                </p>
                <button
                  onClick={() => {
                    void notificationsQuery.refetch();
                  }}
                  className="mt-3 px-4 py-1.5 rounded-full bg-[#FEF2F2] text-[#B91C1C] text-[12px] font-medium hover:bg-[#FEE2E2] transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : !notificationsQuery.isLoading && visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-[#CBD5E1] mb-3" />
                <p className="text-[15px] font-medium text-[#64748B]">No notifications</p>
                <p className="text-[13px] text-[#94A3B8]">You&apos;re all caught up!</p>
              </div>
            ) : notificationsQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-[#CBD5E1] mb-3 animate-pulse" />
                <p className="text-[13px] text-[#94A3B8]">Loading notifications…</p>
              </div>
            ) : (
              visible.map((notif) => {
                const style = TYPE_STYLES[notif.type];
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      void handleMarkRead(notif);
                      if (notif.actionRoute) {
                        window.location.href = notif.actionRoute;
                      }
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      notif.isRead
                        ? 'border-[#F1F5F9] bg-white hover:border-[#E2E8F0]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1.5 rounded-lg ${style.bg} shrink-0`}>{style.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-[14px] ${notif.isRead ? 'font-medium text-[#374151]' : 'font-semibold text-[#111827]'}`}
                          >
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`} />
                          )}
                        </div>
                        <p className="text-[13px] text-[#64748B] mt-0.5">{notif.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-[#94A3B8]">
                            {new Date(notif.createdAt).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <Badge variant="default" size="sm">
                            {notif.source}
                          </Badge>
                          {notif.isActionable && notif.actionLabel && (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9]">
                              {notif.actionLabel} <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 mt-4 border-t border-[#E2E8F0] text-center">
            <button
              onClick={() => {
                void handleMarkAllRead();
              }}
              disabled={unreadCount === 0 || !userId}
              className="text-[13px] font-medium text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              Mark all as read
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
