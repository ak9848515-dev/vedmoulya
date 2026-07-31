import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareerNotificationService } from '../CareerNotificationService.js';

describe('CareerNotificationService', () => {
  let svc: CareerNotificationService;
  beforeEach(() => {
    vi.useFakeTimers();
    svc = new CareerNotificationService();
  });

  it('generates skill gap notification', () => {
    const n = svc.generateNotifications({
      missingSkills: 6,
      interviewScore: 80,
      resumeScore: 80,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    expect(n.some((x) => x.title.includes('Skill Gaps'))).toBe(true);
  });

  it('does not generate skill gap notification when ≤5 gaps', () => {
    const n = svc.generateNotifications({
      missingSkills: 5,
      interviewScore: 80,
      resumeScore: 80,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    expect(n.some((x) => x.title.includes('Skill Gaps'))).toBe(false);
  });

  it('generates interview readiness notification when score <50', () => {
    const n = svc.generateNotifications({
      missingSkills: 0,
      interviewScore: 40,
      resumeScore: 80,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    expect(n.some((x) => x.title.includes('Readiness Low'))).toBe(true);
  });

  it('generates resume notification when score <60', () => {
    const n = svc.generateNotifications({
      missingSkills: 0,
      interviewScore: 80,
      resumeScore: 50,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    expect(n.some((x) => x.title.includes('Resume Needs'))).toBe(true);
  });

  it('generates job match notification when matches >0 and applicationsOpen', () => {
    const n = svc.generateNotifications({
      missingSkills: 0,
      interviewScore: 80,
      resumeScore: 80,
      jobMatches: 3,
      applicationsOpen: true,
      certsExpiring: [],
    });
    expect(n.some((x) => x.title.includes('Jobs Match'))).toBe(true);
  });

  it('generates expiring certification notification', () => {
    const n = svc.generateNotifications({
      missingSkills: 0,
      interviewScore: 80,
      resumeScore: 80,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: ['AWS'],
    });
    expect(n.some((x) => x.title.includes('Certifications Expiring'))).toBe(true);
  });

  it('markAsRead updates a single notification', () => {
    const n = svc.generateNotifications({
      missingSkills: 6,
      interviewScore: 40,
      resumeScore: 50,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    const id = n[0]!.id;
    const updated = svc.markAsRead(n, id);
    expect(updated.find((x) => x.id === id)!.isRead).toBe(true);
  });

  it('markAllAsRead marks all as read', () => {
    const n = svc.generateNotifications({
      missingSkills: 6,
      interviewScore: 40,
      resumeScore: 50,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    const all = svc.markAllAsRead(n);
    expect(all.every((x) => x.isRead)).toBe(true);
  });

  it('getUnreadCount counts unread', () => {
    const n = svc.generateNotifications({
      missingSkills: 6,
      interviewScore: 40,
      resumeScore: 50,
      jobMatches: 0,
      applicationsOpen: false,
      certsExpiring: [],
    });
    expect(svc.getUnreadCount(n)).toBe(n.length);
    const read = svc.markAllAsRead(n);
    expect(svc.getUnreadCount(read)).toBe(0);
  });
});
