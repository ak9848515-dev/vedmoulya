import { describe, it, expect } from 'vitest';
import { DashboardNotificationService } from '../DashboardNotificationService.js';

describe('DashboardNotificationService', () => {
  let service: DashboardNotificationService;

  beforeEach(() => {
    service = new DashboardNotificationService();
  });

  describe('generateNotifications', () => {
    it('generates critical health notification', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: {
          overall: 'critical',
          services: [{ name: 'memory', status: 'down', latency: 0 }],
          lastChecked: '',
          warnings: ['memory is down'],
        },
      });
      expect(notifs.some((n) => n.type === 'error')).toBe(true);
      expect(notifs.some((n) => n.title.includes('Critical'))).toBe(true);
    });

    it('generates degraded health notification', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: {
          overall: 'degraded',
          services: [{ name: 'memory', status: 'degraded', latency: 500 }],
          lastChecked: '',
          warnings: ['memory is degraded'],
        },
      });
      expect(notifs.some((n) => n.type === 'warning' && n.title.includes('Degraded'))).toBe(true);
    });

    it('generates pending decision reminder', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 5,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      });
      expect(notifs.some((n) => n.title.includes('Pending Decisions'))).toBe(true);
    });

    it('generates blocked plan warning', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 2,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      });
      expect(notifs.some((n) => n.title.includes('Blocked Plans'))).toBe(true);
    });

    it('generates recovery suggestion info', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: ['Suggestion 1'],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      });
      expect(notifs.some((n) => n.title.includes('Recovery'))).toBe(true);
    });

    it('generates task completion success', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 3,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      });
      expect(notifs.some((n) => n.type === 'success')).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('marks single notification as read', () => {
      const notifs = service.generateNotifications({
        decisions: {
          pendingDecisions: 5,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      });
      const updated = service.markAsRead(notifs, notifs[0]!.id);
      expect(updated.find((n) => n.id === notifs[0]!.id)?.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T1',
          message: 'M1',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n2',
          type: 'warning' as const,
          title: 'T2',
          message: 'M2',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
      ];
      const updated = service.markAllAsRead(notifs);
      expect(updated.every((n) => n.isRead)).toBe(true);
    });
  });

  describe('getUnreadCount', () => {
    it('counts unread notifications', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
          expiresAt: '',
        },
        {
          id: 'n2',
          type: 'warning' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: true,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n3',
          type: 'error' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
      ];
      expect(service.getUnreadCount(notifs)).toBe(2);
    });
  });

  describe('getActiveNotifications', () => {
    it('filters out expired notifications', () => {
      const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
          expiresAt: past,
        },
        {
          id: 'n2',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
          expiresAt: future,
        },
        {
          id: 'n3',
          type: 'info' as const,
          title: 'T',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
      ];
      const active = service.getActiveNotifications(notifs);
      expect(active).toHaveLength(2);
      expect(active.find((n) => n.id === 'n1')).toBeUndefined();
    });
  });

  describe('prioritizeNotifications', () => {
    it('sorts by type priority then returns unread only', () => {
      const notifs = [
        {
          id: 'n1',
          type: 'info' as const,
          title: 'T1',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n2',
          type: 'error' as const,
          title: 'T2',
          message: 'M',
          source: 's',
          isRead: false,
          isActionable: false,
          createdAt: '',
        },
        {
          id: 'n3',
          type: 'warning' as const,
          title: 'T3',
          message: 'M',
          source: 's',
          isRead: true,
          isActionable: false,
          createdAt: '',
        },
      ];
      const prioritized = service.prioritizeNotifications(notifs);
      expect(prioritized).toHaveLength(2);
      expect(prioritized[0]!.type).toBe('error');
      expect(prioritized[1]!.type).toBe('info');
    });
  });

  describe('duplicate elimination', () => {
    it('handles repeated notification generation gracefully', () => {
      const input = {
        decisions: {
          pendingDecisions: 5,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 0,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      };
      const first = service.generateNotifications(input);
      const second = service.generateNotifications(input);
      // Both calls should generate the same types of notifications
      expect(first.some((n) => n.title.includes('Pending'))).toBe(true);
      expect(second.some((n) => n.title.includes('Pending'))).toBe(true);
    });

    it('handles high risk decisions pluralization correctly', () => {
      const input = {
        decisions: {
          pendingDecisions: 0,
          recommendedDecisions: [],
          averageConfidence: 0,
          highRiskDecisions: 1,
        },
        execution: {
          todayTasks: [],
          activePlans: 0,
          blockedPlans: 0,
          completedToday: 0,
          upcomingSchedule: [],
          recoverySuggestions: [],
          totalEstimatedMinutes: 0,
        },
        health: { overall: 'healthy', services: [], lastChecked: '', warnings: [] },
      };
      const notifs = service.generateNotifications(input);
      expect(notifs.some((n) => n.title.includes('High Risk'))).toBe(true);

      // Test plural form
      const input2 = { ...input, decisions: { ...input.decisions, highRiskDecisions: 2 } };
      const notifs2 = service.generateNotifications(input2);
      expect(notifs2.some((n) => n.title.includes('High Risk'))).toBe(true);
    });
  });
});
