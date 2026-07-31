// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Notification Service Tests
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { MarketplaceNotificationService } from '../MarketplaceNotificationService.js';

describe('MarketplaceNotificationService', () => {
  it('generateNotifications returns empty for no triggers', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs).toEqual([]);
  });

  it('generates update notification when updates available', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 3,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toContain('Updates');
    expect(notifs[0].type).toBe('info');
  });

  it('generates singular text for single update', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 1,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs[0].message).toContain('update');
    expect(notifs[0].message).not.toContain('updates');
  });

  it('generates install error notification', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 2,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('error');
    expect(notifs[0].title).toContain('Installation');
  });

  it('generates new assets notification', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 5,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toContain('New Assets');
  });

  it('generates compatibility warning', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 2,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('warning');
    expect(notifs[0].title).toContain('Compatibility');
  });

  it('generates provider error notification', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 1,
      pendingActivations: 0,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('error');
    expect(notifs[0].title).toContain('Provider');
  });

  it('generates pending activation reminder', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 3,
    });
    expect(notifs.length).toBe(1);
    expect(notifs[0].type).toBe('reminder');
    expect(notifs[0].title).toContain('Pending');
  });

  it('generates multiple notifications for multiple triggers', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 2,
      installErrors: 1,
      newAssetsCount: 3,
      compatibilityIssues: 1,
      providerErrors: 1,
      pendingActivations: 2,
    });
    expect(notifs.length).toBe(6);
  });

  it('uses singular text for single compatibility issue', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 1,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs[0].message).toContain('asset has');
  });

  it('uses plural text for multiple compatibility issues', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 0,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 2,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(notifs[0].message).toContain('assets have');
  });

  it('markAsRead marks single notification', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 1,
      installErrors: 0,
      newAssetsCount: 0,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    const updated = svc.markAsRead(notifs, notifs[0].id);
    expect(updated[0].isRead).toBe(true);
  });

  it('markAllAsRead marks all as read', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 1,
      installErrors: 1,
      newAssetsCount: 1,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    const updated = svc.markAllAsRead(notifs);
    expect(updated.every((n) => n.isRead)).toBe(true);
  });

  it('getUnreadCount returns correct count', () => {
    const svc = new MarketplaceNotificationService();
    const notifs = svc.generateNotifications({
      availableUpdates: 1,
      installErrors: 1,
      newAssetsCount: 1,
      compatibilityIssues: 0,
      providerErrors: 0,
      pendingActivations: 0,
    });
    expect(svc.getUnreadCount(notifs)).toBe(3);
    const read = svc.markAsRead(notifs, notifs[0].id);
    expect(svc.getUnreadCount(read)).toBe(2);
  });
});
