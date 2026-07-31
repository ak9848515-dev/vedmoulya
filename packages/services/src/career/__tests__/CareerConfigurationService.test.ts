import { describe, it, expect } from 'vitest';
import { CareerConfigurationService } from '../CareerConfigurationService.js';

describe('CareerConfigurationService', () => {
  it('returns default config for new user', () => {
    const svc = new CareerConfigurationService();
    const config = svc.getConfig('user1');
    expect(config.userId).toBe('user1');
    expect(config.jobSearchActive).toBe(false);
    expect(config.openToOpportunities).toBe(true);
    expect(config.skillAssessmentFrequency).toBe('monthly');
  });

  it('returns existing config for returning user', () => {
    const svc = new CareerConfigurationService();
    const c1 = svc.getConfig('user1');
    const c2 = svc.getConfig('user1');
    expect(c2).toBe(c1);
  });

  it('updates config with partial values', () => {
    const svc = new CareerConfigurationService();
    const updated = svc.updateConfig('user1', {
      jobSearchActive: true,
      openToOpportunities: false,
    });
    expect(updated.jobSearchActive).toBe(true);
    expect(updated.openToOpportunities).toBe(false);
    expect(updated.skillAssessmentFrequency).toBe('monthly');
  });

  it('resetConfig restores defaults', () => {
    const svc = new CareerConfigurationService();
    svc.updateConfig('user1', { jobSearchActive: true });
    const reset = svc.resetConfig('user1');
    expect(reset.jobSearchActive).toBe(false);
    expect(reset.openToOpportunities).toBe(true);
  });
});
