// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Notification Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceNotificationDTO } from './MarketplaceDTO.js';

export class MarketplaceNotificationService {
  generateNotifications(input: {
    availableUpdates: number;
    installErrors: number;
    newAssetsCount: number;
    compatibilityIssues: number;
    providerErrors: number;
    pendingActivations: number;
  }): MarketplaceNotificationDTO[] {
    const notifs: MarketplaceNotificationDTO[] = [];

    if (input.availableUpdates > 0) {
      notifs.push(
        this.create(
          'info',
          'Updates Available',
          `${String(input.availableUpdates)} update${input.availableUpdates > 1 ? 's' : ''} available for installed assets.`,
          'updates',
          true,
          'View Updates',
          '/marketplace/updates',
        ),
      );
    }
    if (input.installErrors > 0) {
      notifs.push(
        this.create(
          'error',
          'Installation Errors',
          `${String(input.installErrors)} installation${input.installErrors > 1 ? 's' : ''} failed. Review and retry.`,
          'installations',
          true,
          'View Details',
          '/marketplace/installations',
        ),
      );
    }
    if (input.newAssetsCount > 0) {
      notifs.push(
        this.create(
          'info',
          'New Assets Available',
          `${String(input.newAssetsCount)} new asset${input.newAssetsCount > 1 ? 's' : ''} added to the catalog.`,
          'catalog',
          true,
          'Browse',
          '/marketplace/catalog',
        ),
      );
    }
    if (input.compatibilityIssues > 0) {
      notifs.push(
        this.create(
          'warning',
          'Compatibility Issues',
          `${String(input.compatibilityIssues)} asset${input.compatibilityIssues > 1 ? 's' : ''} ha${input.compatibilityIssues > 1 ? 've' : 's'} compatibility concerns.`,
          'compatibility',
          true,
          'Review',
          '/marketplace/compatibility',
        ),
      );
    }
    if (input.providerErrors > 0) {
      notifs.push(
        this.create(
          'error',
          'Provider Errors',
          `${String(input.providerErrors)} provider${input.providerErrors > 1 ? 's' : ''} reporting errors. Check provider status.`,
          'providers',
          true,
          'View Providers',
          '/marketplace/providers',
        ),
      );
    }
    if (input.pendingActivations > 0) {
      notifs.push(
        this.create(
          'reminder',
          'Pending Activations',
          `${String(input.pendingActivations)} asset${input.pendingActivations > 1 ? 's' : ''} pending activation.`,
          'activations',
          true,
          'Activate',
          '/marketplace/activations',
        ),
      );
    }

    return notifs;
  }

  markAsRead(notifs: MarketplaceNotificationDTO[], id: string): MarketplaceNotificationDTO[] {
    return notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  }

  markAllAsRead(notifs: MarketplaceNotificationDTO[]): MarketplaceNotificationDTO[] {
    return notifs.map((n) => ({ ...n, isRead: true }));
  }

  getUnreadCount(notifs: MarketplaceNotificationDTO[]): number {
    return notifs.filter((n) => !n.isRead).length;
  }

  private create(
    type: MarketplaceNotificationDTO['type'],
    title: string,
    message: string,
    source: string,
    isActionable: boolean,
    actionLabel?: string,
    actionRoute?: string,
  ): MarketplaceNotificationDTO {
    return {
      id: `mnotif_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
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
