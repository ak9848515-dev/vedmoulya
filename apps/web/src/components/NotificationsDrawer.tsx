'use client';

import React, { useEffect } from 'react';
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

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'reminder';
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

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'info',
    title: 'Career insight available',
    message: 'New skill gap analysis ready for review',
    source: 'Career',
    isRead: false,
    isActionable: true,
    actionLabel: 'View Analysis',
    actionRoute: '/career',
    priority: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Learning streak at risk',
    message: "You haven't completed today's learning goal",
    source: 'Learning',
    isRead: false,
    isActionable: true,
    actionLabel: 'Start Learning',
    actionRoute: '/learning',
    priority: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'n3',
    type: 'success',
    title: 'Project milestone achieved',
    message: 'Q3 Strategy project is 75% complete',
    source: 'Business',
    isRead: true,
    isActionable: false,
    priority: 3,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'n4',
    type: 'reminder',
    title: 'Weekly review pending',
    message: 'Schedule your weekly performance review',
    source: 'Dashboard',
    isRead: false,
    isActionable: true,
    actionLabel: 'Review Now',
    actionRoute: '/',
    priority: 2,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'n5',
    type: 'info',
    title: 'Marketplace update available',
    message: '2 template packs have new versions',
    source: 'Marketplace',
    isRead: true,
    isActionable: true,
    actionLabel: 'View Updates',
    actionRoute: '/marketplace',
    priority: 3,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const TYPE_STYLES: Record<string, { bg: string; icon: React.ReactNode; dot: string }> = {
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
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.isRead).length;

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
                  {unreadCount > 0 ? `${String(unreadCount)} unread` : 'All caught up'}
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
            <button className="px-3 py-1.5 rounded-full text-[12px] font-medium bg-[#EFF4FE] text-[#2B5FD9]">
              All
            </button>
            <button className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
              Unread
            </button>
            <button className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
              Actionable
            </button>
            <span className="ml-auto">
              <Sparkles className="h-3.5 w-3.5 text-[#7C3AED]" />
            </span>
          </div>

          {/* Notification List */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {MOCK_NOTIFICATIONS.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-[#CBD5E1] mb-3" />
                <p className="text-[15px] font-medium text-[#64748B]">No notifications</p>
                <p className="text-[13px] text-[#94A3B8]">You&apos;re all caught up!</p>
              </div>
            ) : (
              MOCK_NOTIFICATIONS.map((notif) => {
                const style = TYPE_STYLES[notif.type] ??
                  TYPE_STYLES.info ?? {
                    bg: 'bg-[#EFF6FF]',
                    icon: <Lightbulb className="h-4 w-4 text-[#3B82F6]" />,
                    dot: 'bg-[#3B82F6]',
                  };
                return (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-colors ${notif.isRead ? 'border-[#F1F5F9] bg-white' : 'border-[#E2E8F0] bg-[#F8FAFC]'}`}
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
                            <button className="flex items-center gap-1 text-[11px] font-medium text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors">
                              {notif.actionLabel} <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 mt-4 border-t border-[#E2E8F0] text-center">
            <button className="text-[13px] font-medium text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors">
              Mark all as read
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
