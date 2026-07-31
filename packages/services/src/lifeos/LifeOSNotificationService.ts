// ──────────────────────────────────────────────────────────────────
// VedMoulya — Life OS Global Notification Service
// BLD-015 — Life OS Integration & Unified Experience
// ──────────────────────────────────────────────────────────────────

import type { LifeOSNotificationDTO, LifeOSModule } from './LifeOSDTO.js';

export class LifeOSNotificationService {
  aggregateNotifications(
    sources: Array<{
      module: LifeOSModule;
      notifications: Array<{
        type: LifeOSNotificationDTO['type'];
        title: string;
        message: string;
        isRead: boolean;
        isActionable: boolean;
        actionLabel?: string;
        actionRoute?: string;
        createdAt: string;
        expiresAt?: string;
      }>;
    }>,
  ): LifeOSNotificationDTO[] {
    const all: LifeOSNotificationDTO[] = [];
    for (const source of sources) {
      for (const n of source.notifications) {
        all.push({
          id: `lnotif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
          type: n.type,
          title: n.title,
          message: n.message,
          source: source.module,
          isRead: n.isRead,
          isActionable: n.isActionable,
          actionLabel: n.actionLabel,
          actionRoute: n.actionRoute,
          priority: this.getPriority(n.type),
          createdAt: n.createdAt,
          expiresAt: n.expiresAt,
        });
      }
    }
    return all.sort(
      (a, b) =>
        b.priority - a.priority ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  getBySeverity(
    notifications: LifeOSNotificationDTO[],
    type: LifeOSNotificationDTO['type'],
  ): LifeOSNotificationDTO[] {
    return notifications.filter((n) => n.type === type);
  }

  getBySource(
    notifications: LifeOSNotificationDTO[],
    source: LifeOSModule,
  ): LifeOSNotificationDTO[] {
    return notifications.filter((n) => n.source === source);
  }

  getUnread(notifications: LifeOSNotificationDTO[]): LifeOSNotificationDTO[] {
    return notifications.filter((n) => !n.isRead);
  }

  markAsRead(notifications: LifeOSNotificationDTO[], id: string): LifeOSNotificationDTO[] {
    return notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  markAllAsRead(notifications: LifeOSNotificationDTO[]): LifeOSNotificationDTO[] {
    return notifications.map((n) => ({ ...n, isRead: true }));
  }

  getUnreadCount(notifications: LifeOSNotificationDTO[]): number {
    return notifications.filter((n) => !n.isRead).length;
  }

  private getPriority(type: LifeOSNotificationDTO['type']): number {
    const priorities = { error: 5, warning: 4, reminder: 3, success: 2, info: 1 };
    return priorities[type];
  }
}
