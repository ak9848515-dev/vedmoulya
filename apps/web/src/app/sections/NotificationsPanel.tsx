// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Section: Notifications Panel
// Global notifications with type-based colors and action buttons
// BLD-016-B — Dashboard Landing Experience
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React from 'react';
import { Card, Badge } from '@vedmoulya/ui';
import { Bell, Lightbulb, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Notification } from './types.js';
import { notifColors } from './types.js';

export interface NotificationsPanelProps {
  notifications: Notification[];
  unreadCount: number;
}

const notifTypeIcon: Record<string, React.ReactNode> = {
  info: <Lightbulb className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <AlertTriangle className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  reminder: <Clock className="h-4 w-4" />,
};

export function NotificationsPanel({
  notifications,
  unreadCount,
}: NotificationsPanelProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-[20px] font-heading font-semibold text-[#111827] mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-[#F59E0B]" />
        Notifications
        {unreadCount > 0 && (
          <Badge variant="danger" size="sm">
            {unreadCount}
          </Badge>
        )}
      </h2>
      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notif) => {
            const colors = notifColors[notif.type] ??
              notifColors.info ?? {
                bg: 'bg-[#EFF6FF]',
                text: 'text-[#3B82F6]',
                dot: 'bg-[#3B82F6]',
              };
            return (
              <Card key={notif.id} variant="standard" padding="md">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg ${colors.bg} ${colors.text}`}>
                    {notifTypeIcon[notif.type] ?? <Lightbulb className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#111827]">{notif.title}</p>
                      {!notif.isRead && <div className={`w-2 h-2 rounded-full ${colors.dot}`} />}
                    </div>
                    <p className="text-[13px] text-[#64748B] mt-0.5">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-[#94A3B8] capitalize">{notif.source}</span>
                      {notif.isActionable && notif.actionLabel && (
                        <button className="text-[11px] font-medium text-[#2B5FD9] hover:text-[#1E4AA8] transition-colors">
                          {notif.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <p className="text-[14px] text-[#94A3B8] italic">No notifications.</p>
        )}
      </div>
    </section>
  );
}
