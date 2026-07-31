import { describe, it, expect } from 'vitest';
import { BusinessNotificationService } from '../BusinessNotificationService.js';

describe('BusinessNotificationService', () => {
  let svc: BusinessNotificationService;
  beforeEach(() => {
    svc = new BusinessNotificationService();
  });

  it('generateNotifications with no triggers returns empty', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    expect(n).toEqual([]);
  });

  it('generates KPI warning when kpisAtRisk > 0', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 3,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    expect(n.some((x) => x.type === 'warning' && x.source === 'kpis')).toBe(true);
  });

  it('generates critical risk warning', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: true,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    expect(n.some((x) => x.source === 'risks')).toBe(true);
  });

  it('generates new opportunities info', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: true,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    expect(n.some((x) => x.source === 'opportunities')).toBe(true);
  });

  it('generates project delay reminder', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 2,
      goalProgress: 50,
    });
    expect(n.some((x) => x.source === 'projects')).toBe(true);
  });

  it('generates goal success when progress > 80', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 90,
    });
    expect(n.some((x) => x.type === 'success' && x.source === 'goals')).toBe(true);
  });

  it('uses singular text for single KPI at risk', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 1,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    const msg = n.find((x) => x.source === 'kpis')?.message ?? '';
    expect(msg).toContain('KPI is');
  });

  it('uses plural text for multiple KPIs at risk', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 3,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    const msg = n.find((x) => x.source === 'kpis')?.message ?? '';
    expect(msg).toContain('KPIs are');
  });

  it('uses singular text for single project delayed', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 1,
      goalProgress: 50,
    });
    const msg = n.find((x) => x.source === 'projects')?.message ?? '';
    expect(msg).toContain('project is');
  });

  it('markAsRead updates single notification', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 1,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    const updated = svc.markAsRead(n, n[0].id);
    expect(updated[0].isRead).toBe(true);
  });

  it('markAllAsRead marks all', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 1,
      hasCriticalRisks: true,
      hasNewOpportunities: true,
      projectsDelayed: 0,
      goalProgress: 90,
    });
    const updated = svc.markAllAsRead(n);
    expect(updated.every((x) => x.isRead)).toBe(true);
  });

  it('getUnreadCount returns correct count', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 1,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 0,
      goalProgress: 50,
    });
    expect(svc.getUnreadCount(n)).toBe(1);
    const read = svc.markAsRead(n, n[0].id);
    expect(svc.getUnreadCount(read)).toBe(0);
  });

  it('generates all 5 notifications when all conditions met', () => {
    const n = svc.generateNotifications({
      kpisAtRisk: 2,
      hasCriticalRisks: true,
      hasNewOpportunities: true,
      projectsDelayed: 3,
      goalProgress: 95,
    });
    expect(n.length).toBe(5);
  });

  it('generateNotifications with single project delayed uses singular in projects notification', () => {
    // This exercises the singular branch in the project delay notification specifically
    const n = svc.generateNotifications({
      kpisAtRisk: 0,
      hasCriticalRisks: false,
      hasNewOpportunities: false,
      projectsDelayed: 1,
      goalProgress: 50,
    });
    const msg = n.find((x) => x.source === 'projects')?.message ?? '';
    expect(msg).toContain('1 project is');
  });
});
