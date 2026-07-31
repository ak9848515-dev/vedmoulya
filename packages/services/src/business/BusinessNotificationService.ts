// ──────────────────────────────────────────────────────────────────
// VedMoulya — Business Notification Service
// BLD-013 — Business Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { BusinessNotificationDTO } from './BusinessDTO.js';

export class BusinessNotificationService {
  generateNotifications(input: {
    kpisAtRisk: number;
    hasCriticalRisks: boolean;
    hasNewOpportunities: boolean;
    projectsDelayed: number;
    goalProgress: number;
  }): BusinessNotificationDTO[] {
    const notifs: BusinessNotificationDTO[] = [];

    if (input.kpisAtRisk > 0) {
      notifs.push(
        this.create(
          'warning',
          'KPIs Need Attention',
          `${String(input.kpisAtRisk)} KPI${input.kpisAtRisk > 1 ? 's' : ''} ${input.kpisAtRisk > 1 ? 'are' : 'is'} below target. Review immediately.`,
          'kpis',
          true,
          'View KPIs',
          '/business/kpis',
        ),
      );
    }
    if (input.hasCriticalRisks) {
      notifs.push(
        this.create(
          'warning',
          'Critical Risks Detected',
          'Your business has critical risks that need immediate attention.',
          'risks',
          true,
          'Review Risks',
          '/business/risks',
        ),
      );
    }
    if (input.hasNewOpportunities) {
      notifs.push(
        this.create(
          'info',
          'New Opportunities Found',
          'New business opportunities have been identified. Explore them now.',
          'opportunities',
          true,
          'View Opportunities',
          '/business/opportunities',
        ),
      );
    }
    if (input.projectsDelayed > 0) {
      notifs.push(
        this.create(
          'reminder',
          'Projects Behind Schedule',
          `${String(input.projectsDelayed)} project${input.projectsDelayed > 1 ? 's' : ''} ${input.projectsDelayed > 1 ? 'are' : 'is'} delayed. Review and adjust timelines.`,
          'projects',
          true,
          'View Projects',
          '/business/projects',
        ),
      );
    }
    if (input.goalProgress > 80) {
      notifs.push(
        this.create(
          'success',
          'Excellent Goal Progress',
          `You've achieved ${String(input.goalProgress)}% of your business goals. Outstanding!`,
          'goals',
          false,
        ),
      );
    }

    return notifs;
  }

  markAsRead(notifs: BusinessNotificationDTO[], id: string): BusinessNotificationDTO[] {
    return notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  markAllAsRead(notifs: BusinessNotificationDTO[]): BusinessNotificationDTO[] {
    return notifs.map((n) => ({ ...n, isRead: true }));
  }

  getUnreadCount(notifs: BusinessNotificationDTO[]): number {
    return notifs.filter((n) => !n.isRead).length;
  }

  private create(
    type: BusinessNotificationDTO['type'],
    title: string,
    message: string,
    source: string,
    isActionable: boolean,
    actionLabel?: string,
    actionRoute?: string,
  ): BusinessNotificationDTO {
    return {
      id: `bnotif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      title,
      message,
      source,
      isRead: false,
      isActionable,
      actionLabel,
      actionRoute,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}
