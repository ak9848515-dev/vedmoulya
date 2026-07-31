import { describe, it, expect } from 'vitest';
import { BusinessConfigurationService } from '../BusinessConfigurationService.js';

describe('BusinessConfigurationService', () => {
  let svc: BusinessConfigurationService;
  beforeEach(() => {
    svc = new BusinessConfigurationService();
  });

  it('getConfig returns default config for new user', () => {
    const cfg = svc.getConfig('user1');
    expect(cfg.userId).toBe('user1');
    expect(cfg.currency).toBe('USD');
    expect(cfg.enableNotifications).toBe(true);
    expect(cfg.reportingPeriod).toBe('monthly');
  });

  it('getConfig returns existing config for returning user', () => {
    const first = svc.getConfig('user1');
    const second = svc.getConfig('user1');
    expect(second).toBe(first);
  });

  it('updateConfig merges partial updates', () => {
    svc.getConfig('user1');
    const updated = svc.updateConfig('user1', { currency: 'EUR', enableNotifications: false });
    expect(updated.currency).toBe('EUR');
    expect(updated.enableNotifications).toBe(false);
    expect(updated.businessName).toBe('');
    expect(updated.reportingPeriod).toBe('monthly');
  });

  it('resetConfig restores defaults', () => {
    svc.getConfig('user1');
    svc.updateConfig('user1', { currency: 'EUR' });
    const reset = svc.resetConfig('user1');
    expect(reset.currency).toBe('USD');
    expect(reset.businessName).toBe('');
  });
});
