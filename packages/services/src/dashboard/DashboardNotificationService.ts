// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dashboard Notification Service
// Manages notifications for the Dashboard Experience Platform
// BLD-010 — Dashboard Experience Platform
// ──────────────────────────────────────────────────────────────────

import type {
  NotificationDTO,
  DecisionCardDTO,
  ExecutionCardDTO,
  HealthIndicatorDTO,
} from './DashboardDTO.js';

interface NotificationInput {
  decisions: DecisionCardDTO;
  execution: ExecutionCardDTO;
  health: HealthIndicatorDTO;
}

export class DashboardNotificationService {
  private readonly maxNotifications = 50;

  /** Generate notifications from current state */
  generateNotifications(input: NotificationInput): NotificationDTO[] {
    const notifications: NotificationDTO[] = [];

    // Health notifications
    if (input.health.overall === 'critical') {
      notifications.push(
        this.createNotification(
          'error',
          'System Health Critical',
          `One or more services are down: ${input.health.warnings.join(', ')}`,
          'health',
          true,
          'View Health',
          '/health',
        ),
      );
    }

    if (input.health.overall === 'degraded') {
      notifications.push(
        this.createNotification(
          'warning',
          'System Performance Degraded',
          `Some services are experiencing latency: ${input.health.warnings.join(', ')}`,
          'health',
          false,
        ),
      );
    }

    // Decision notifications
    if (input.decisions.pendingDecisions > 3) {
      notifications.push(
        this.createNotification(
          'reminder',
          'Pending Decisions Need Review',
          `You have ${String(input.decisions.pendingDecisions)} decisions awaiting your review.`,
          'decision',
          true,
          'Review',
          '/decisions',
        ),
      );
    }

    if (input.decisions.highRiskDecisions > 0) {
      notifications.push(
        this.createNotification(
          'warning',
          'High Risk Decisions',
          `${String(input.decisions.highRiskDecisions)} decision${input.decisions.highRiskDecisions > 1 ? 's' : ''} ha${input.decisions.highRiskDecisions > 1 ? 've' : 's'} elevated risk levels.`,
          'decision',
          true,
          'Assess Risks',
          '/decisions',
        ),
      );
    }

    // Execution notifications
    if (input.execution.blockedPlans > 0) {
      notifications.push(
        this.createNotification(
          'warning',
          'Blocked Plans',
          `${String(input.execution.blockedPlans)} plan${input.execution.blockedPlans > 1 ? 's are' : ' is'} currently blocked and need attention.`,
          'execution',
          true,
          'Unblock',
          '/execution',
        ),
      );
    }

    if (input.execution.recoverySuggestions.length > 0) {
      notifications.push(
        this.createNotification(
          'info',
          'Recovery Suggestions Available',
          `AI has generated ${String(input.execution.recoverySuggestions.length)} recovery suggestion${input.execution.recoverySuggestions.length > 1 ? 's' : ''} for your plans.`,
          'execution',
          true,
          'View',
          '/execution/recovery',
        ),
      );
    }

    // Success notifications
    if (input.execution.completedToday > 0) {
      notifications.push(
        this.createNotification(
          'success',
          'Tasks Completed',
          `You completed ${String(input.execution.completedToday)} task${input.execution.completedToday > 1 ? 's' : ''} today. Great progress!`,
          'execution',
          false,
        ),
      );
    }

    return notifications;
  }

  /** Mark a notification as read */
  markAsRead(notifications: NotificationDTO[], id: string): NotificationDTO[] {
    return notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  /** Mark all notifications as read */
  markAllAsRead(notifications: NotificationDTO[]): NotificationDTO[] {
    return notifications.map((n) => ({ ...n, isRead: true }));
  }

  /** Get unread notification count */
  getUnreadCount(notifications: NotificationDTO[]): number {
    return notifications.filter((n) => !n.isRead).length;
  }

  /** Get active (non-expired) notifications */
  getActiveNotifications(notifications: NotificationDTO[]): NotificationDTO[] {
    const now = Date.now();
    return notifications.filter((n) => {
      if (!n.expiresAt) return true;
      return new Date(n.expiresAt).getTime() > now;
    });
  }

  /** Prioritize notifications */
  prioritizeNotifications(notifications: NotificationDTO[]): NotificationDTO[] {
    const order: Record<string, number> = {
      error: 0,
      warning: 1,
      reminder: 2,
      success: 3,
      info: 4,
    };
    return [...notifications]
      .filter((n) => !n.isRead)
      .sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99))
      .slice(0, this.maxNotifications);
  }

  private createNotification(
    type: NotificationDTO['type'],
    title: string,
    message: string,
    source: string,
    isActionable: boolean,
    actionLabel?: string,
    actionRoute?: string,
  ): NotificationDTO {
    return {
      id: `notif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      message,
      source,
      isRead: false,
      isActionable,
      actionLabel,
      actionRoute,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h expiry
    };
  }
}
