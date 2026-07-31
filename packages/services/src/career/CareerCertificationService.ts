// ──────────────────────────────────────────────────────────────────
// VedMoulya — Career Certification Service
// BLD-011 — Career Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { CertificationDTO } from './CareerDTO.js';

export class CareerCertificationService {
  private readonly certStores = new Map<string, Map<string, CertificationDTO>>();

  private getStore(userId: string): Map<string, CertificationDTO> {
    let store = this.certStores.get(userId);
    if (!store) {
      store = new Map();
      this.certStores.set(userId, store);
    }
    return store;
  }

  getCertifications(userId: string): CertificationDTO[] {
    return Array.from(this.getStore(userId).values());
  }

  getCertification(userId: string, certId: string): CertificationDTO | undefined {
    return this.getStore(userId).get(certId);
  }

  addCertification(userId: string, cert: CertificationDTO): void {
    this.getStore(userId).set(cert.id, cert);
  }

  updateCertification(
    userId: string,
    certId: string,
    updates: Partial<CertificationDTO>,
  ): CertificationDTO {
    const store = this.getStore(userId);
    const existing = store.get(certId);
    if (!existing) throw new Error(`Certification not found: ${certId}`);
    const updated = { ...existing, ...updates };
    store.set(certId, updated);
    return updated;
  }

  deleteCertification(userId: string, certId: string): void {
    this.getStore(userId).delete(certId);
  }

  getExpiringCertifications(userId: string, withinDays: number = 90): CertificationDTO[] {
    const now = Date.now();
    const deadline = now + withinDays * 24 * 60 * 60 * 1000;
    return this.getCertifications(userId).filter((c) => {
      if (!c.expiryDate) return false;
      const expiry = new Date(c.expiryDate).getTime();
      return expiry > now && expiry < deadline;
    });
  }

  getActiveCertifications(userId: string): CertificationDTO[] {
    return this.getCertifications(userId).filter(
      (c) => c.status === 'in_progress' || c.status === 'completed',
    );
  }

  calculateCertificationProgress(certs: CertificationDTO[]): number {
    if (certs.length === 0) return 0;
    const totalProgress = certs.reduce((s, c) => s + c.progress, 0);
    return Math.round(totalProgress / certs.length);
  }
}
