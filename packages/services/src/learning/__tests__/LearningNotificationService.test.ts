import { describe, it, expect } from 'vitest';
import { LearningNotificationService } from '../LearningNotificationService.js';

describe('LearningNotificationService', () => {
  it('generates revision reminder when due today', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 3,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    expect(notifs.some((n) => n.type === 'reminder')).toBe(true);
  });

  it('generates streak warning when at risk', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 0,
      streakAtRisk: true,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    expect(notifs.some((n) => n.type === 'warning' && n.title.includes('Streak'))).toBe(true);
  });

  it('generates assessment info when pending', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 0,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 2,
    });
    expect(notifs.some((n) => n.type === 'info' && n.title.includes('Assessment'))).toBe(true);
  });

  it('generates success notification when weekly progress > 80', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 0,
      streakAtRisk: false,
      weeklyProgress: 90,
      assessmentsPending: 0,
    });
    expect(notifs.some((n) => n.type === 'success')).toBe(true);
  });

  it('markAsRead updates single notification', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 1,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    const id = notifs[0].id;
    const updated = svc.markAsRead(notifs, id);
    expect(updated.find((n) => n.id === id)?.isRead).toBe(true);
  });

  it('markAllAsRead updates all', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 2,
      streakAtRisk: true,
      weeklyProgress: 90,
      assessmentsPending: 0,
    });
    const updated = svc.markAllAsRead(notifs);
    expect(updated.every((n) => n.isRead)).toBe(true);
  });

  it('getUnreadCount returns correct count', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 1,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    expect(svc.getUnreadCount(notifs)).toBe(notifs.length);
    const read = svc.markAllAsRead(notifs);
    expect(svc.getUnreadCount(read)).toBe(0);
  });

  it('generates no notifications when nothing triggers', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 0,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    expect(notifs.length).toBe(0);
  });

  it('revision singular format when exactly 1 due', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 1,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('reminder');
    expect(notifs[0].message).toContain('topic needs'); // singular
  });

  it('assessments singular format when exactly 1 pending', () => {
    const svc = new LearningNotificationService();
    const notifs = svc.generateNotifications({
      revisionDueToday: 0,
      streakAtRisk: false,
      weeklyProgress: 50,
      assessmentsPending: 1,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('info');
    expect(notifs[0].message).toContain('assessment'); // singular
  });
});
