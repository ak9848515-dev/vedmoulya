// ──────────────────────────────────────────────────────────────────
// VedMoulya — Learning Notification Service
// BLD-012 — Learning Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { LearningNotificationDTO } from './LearningDTO.js';

export class LearningNotificationService {
  generateNotifications(input: {
    revisionDueToday: number;
    streakAtRisk: boolean;
    weeklyProgress: number;
    assessmentsPending: number;
  }): LearningNotificationDTO[] {
    const notifs: LearningNotificationDTO[] = [];

    if (input.revisionDueToday > 0) {
      notifs.push(
        this.create(
          'reminder',
          'Revision Due Today',
          `${String(input.revisionDueToday)} topic${input.revisionDueToday > 1 ? 's' : ''} need${input.revisionDueToday > 1 ? '' : 's'} revision today.`,
          'revision',
          true,
          'Start',
          '/learning/revision',
        ),
      );
    }
    if (input.streakAtRisk) {
      notifs.push(
        this.create(
          'warning',
          'Learning Streak at Risk',
          "Your learning streak will break if you don't study today.",
          'progress',
          true,
          'Learn Now',
          '/learning',
        ),
      );
    }
    if (input.assessmentsPending > 0) {
      notifs.push(
        this.create(
          'info',
          'Pending Assessments',
          `You have ${String(input.assessmentsPending)} assessment${input.assessmentsPending > 1 ? 's' : ''} to complete.`,
          'assessment',
          true,
          'View',
          '/learning/assessments',
        ),
      );
    }
    if (input.weeklyProgress > 80) {
      notifs.push(
        this.create(
          'success',
          'Great Weekly Progress',
          `You've achieved ${String(input.weeklyProgress)}% of your weekly goal. Keep going!`,
          'progress',
          false,
        ),
      );
    }

    return notifs;
  }

  markAsRead(notifs: LearningNotificationDTO[], id: string): LearningNotificationDTO[] {
    return notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  markAllAsRead(notifs: LearningNotificationDTO[]): LearningNotificationDTO[] {
    return notifs.map((n) => ({ ...n, isRead: true }));
  }

  getUnreadCount(notifs: LearningNotificationDTO[]): number {
    return notifs.filter((n) => !n.isRead).length;
  }

  private create(
    type: LearningNotificationDTO['type'],
    title: string,
    message: string,
    source: string,
    isActionable: boolean,
    actionLabel?: string,
    actionRoute?: string,
  ): LearningNotificationDTO {
    return {
      id: `lnotif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
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
