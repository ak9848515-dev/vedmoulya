import { describe, it, expect } from 'vitest';
import { CareerCertificationService } from '../CareerCertificationService.js';

const cert = (
  id: string,
  status: 'planned' | 'in_progress' | 'completed' | 'expired' = 'in_progress',
  progress: number = 50,
  expiryDate?: string,
) => ({
  id,
  name: `Cert ${id}`,
  provider: 'AWS',
  status,
  progress,
  estimatedStudyHours: 100,
  cost: 150,
  skills: ['cloud'],
  isVerified: false,
  ...(expiryDate ? { expiryDate } : {}),
});

describe('CareerCertificationService', () => {
  it('returns empty for new user', () => {
    expect(new CareerCertificationService().getCertifications('u1')).toHaveLength(0);
  });

  it('adds and retrieves certifications', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1'));
    expect(svc.getCertifications('u1')).toHaveLength(1);
  });

  it('getCertification returns specific cert', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1'));
    expect(svc.getCertification('u1', 'c1')!.name).toBe('Cert c1');
  });

  it('updateCertification modifies cert', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1'));
    svc.updateCertification('u1', 'c1', { progress: 90 });
    expect(svc.getCertification('u1', 'c1')!.progress).toBe(90);
  });

  it('updateCertification throws for missing', () => {
    expect(() => new CareerCertificationService().updateCertification('u1', 'missing', {})).toThrow(
      'Certification not found',
    );
  });

  it('deleteCertification removes cert', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1'));
    svc.deleteCertification('u1', 'c1');
    expect(svc.getCertifications('u1')).toHaveLength(0);
  });

  it('getExpiringCertifications finds certs expiring within days', () => {
    const svc = new CareerCertificationService();
    const futureExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    svc.addCertification('u1', cert('c1', 'completed', 100, futureExpiry));
    const expiring = svc.getExpiringCertifications('u1', 90);
    expect(expiring).toHaveLength(1);
  });

  it('getExpiringCertifications ignores certs without expiry', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1'));
    expect(svc.getExpiringCertifications('u1')).toHaveLength(0);
  });

  it('getActiveCertifications returns in_progress or completed', () => {
    const svc = new CareerCertificationService();
    svc.addCertification('u1', cert('c1', 'in_progress'));
    svc.addCertification('u1', cert('c2', 'completed'));
    svc.addCertification('u1', cert('c3', 'planned'));
    expect(svc.getActiveCertifications('u1')).toHaveLength(2);
  });

  it('calculateCertificationProgress returns average', () => {
    const svc = new CareerCertificationService();
    const certs = [cert('c1', 'in_progress', 50), cert('c2', 'completed', 100)];
    expect(svc.calculateCertificationProgress(certs)).toBe(75);
  });

  it('calculateCertificationProgress returns 0 for empty', () => {
    expect(new CareerCertificationService().calculateCertificationProgress([])).toBe(0);
  });
});
