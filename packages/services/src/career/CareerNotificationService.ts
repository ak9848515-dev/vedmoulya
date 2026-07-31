// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Notification Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CareerNotificationDTO } from './CareerDTO.js';

export class CareerNotificationService {
  generateNotifications(input: {
    missingSkills: number;
    interviewScore: number;
    resumeScore: number;
    jobMatches: number;
    applicationsOpen: boolean;
    certsExpiring: string[];
  }): CareerNotificationDTO[] {
    const notifications: CareerNotificationDTO[] = [];

    if (input.missingSkills > 5) {
      notifications.push(
        this.create(
          'warning',
          'Significant Skill Gaps',
          `You have ${String(input.missingSkills)} skill gaps to address. Consider prioritizing learning.`,
          'skills',
          true,
          'View Skills',
          '/career/skills',
        ),
      );
    }
    if (input.interviewScore < 50) {
      notifications.push(
        this.create(
          'warning',
          'Interview Readiness Low',
          'Your interview readiness score needs improvement. Start practicing.',
          'interview',
          true,
          'Practice',
          '/career/interview',
        ),
      );
    }
    if (input.resumeScore < 60) {
      notifications.push(
        this.create(
          'reminder',
          'Resume Needs Optimization',
          'Your resume ATS score is below optimal. Update it to improve job matching.',
          'resume',
          true,
          'Improve Resume',
          '/career/resume',
        ),
      );
    }
    if (input.jobMatches > 0 && input.applicationsOpen) {
      notifications.push(
        this.create(
          'info',
          'Jobs Match Your Profile',
          `${String(input.jobMatches)} job${input.jobMatches > 1 ? 's' : ''} match${input.jobMatches > 1 ? '' : 'es'} your profile. Review and apply.`,
          'jobs',
          true,
          'View Jobs',
          '/career/jobs',
        ),
      );
    }
    if (input.certsExpiring.length > 0) {
      notifications.push(
        this.create(
          'warning',
          'Certifications Expiring',
          `${String(input.certsExpiring.length)} certification${input.certsExpiring.length > 1 ? 's' : ''} ${input.certsExpiring.length > 1 ? 'are' : 'is'} expiring soon.`,
          'certification',
          true,
          'Review',
          '/career/certifications',
        ),
      );
    }

    return notifications;
  }

  markAsRead(notifications: CareerNotificationDTO[], id: string): CareerNotificationDTO[] {
    return notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  markAllAsRead(notifications: CareerNotificationDTO[]): CareerNotificationDTO[] {
    return notifications.map((n) => ({ ...n, isRead: true }));
  }

  getUnreadCount(notifications: CareerNotificationDTO[]): number {
    return notifications.filter((n) => !n.isRead).length;
  }

  private create(
    type: CareerNotificationDTO['type'],
    title: string,
    message: string,
    source: string,
    isActionable: boolean,
    actionLabel?: string,
    actionRoute?: string,
  ): CareerNotificationDTO {
    return {
      id: `cnotif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
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
