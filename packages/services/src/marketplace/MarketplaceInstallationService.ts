/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Marketplace Installation Service
// BLD-014 — Marketplace Platform
// ──────────────────────────────────────────────────────────────────

import type { MarketplaceInstallationDTO, InstallationStepDTO } from './MarketplaceDTO.js';

export class MarketplaceInstallationService {
  private readonly installations = new Map<string, MarketplaceInstallationDTO>();

  startInstallation(
    assetId: string,
    assetName: string,
    assetType: MarketplaceInstallationDTO['assetType'],
    version: string,
  ): MarketplaceInstallationDTO {
    const steps: InstallationStepDTO[] = [
      { name: 'Download', status: 'pending' },
      { name: 'Verify', status: 'pending' },
      { name: 'Extract', status: 'pending' },
      { name: 'Configure', status: 'pending' },
      { name: 'Register', status: 'pending' },
    ];
    const installation: MarketplaceInstallationDTO = {
      id: `minst_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
      assetId,
      assetName,
      assetType,
      version,
      status: 'pending',
      startedAt: new Date().toISOString(),
      steps,
    };
    this.installations.set(installation.id, installation);
    return installation;
  }

  updateStep(
    installationId: string,
    stepIndex: number,
    status: InstallationStepDTO['status'],
    duration?: number,
    error?: string,
  ): void {
    const inst = this.installations.get(installationId);
    if (!inst) return;
    const steps = [...inst.steps];
    if (steps[stepIndex]) steps[stepIndex] = { ...steps[stepIndex], status, duration, error };
    this.installations.set(installationId, { ...inst, steps });
  }

  completeInstallation(installationId: string): void {
    const inst = this.installations.get(installationId);
    if (!inst) return;
    this.installations.set(installationId, {
      ...inst,
      status: 'completed',
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(inst.startedAt).getTime(),
      steps: inst.steps.map((s) => ({ ...s, status: 'completed' as const })),
    });
  }

  failInstallation(installationId: string, error: string): void {
    const inst = this.installations.get(installationId);
    if (!inst) return;
    this.installations.set(installationId, {
      ...inst,
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(inst.startedAt).getTime(),
    });
  }

  getInstallation(installationId: string): MarketplaceInstallationDTO | undefined {
    return this.installations.get(installationId);
  }

  getInstallationsByAsset(assetId: string): MarketplaceInstallationDTO[] {
    return Array.from(this.installations.values()).filter((i) => i.assetId === assetId);
  }

  getAllInstallations(): MarketplaceInstallationDTO[] {
    return Array.from(this.installations.values());
  }

  getInstallationHistory(): MarketplaceInstallationDTO[] {
    return Array.from(this.installations.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  getSuccessRate(): number {
    const all = Array.from(this.installations.values());
    if (all.length === 0) return 1;
    return all.filter((i) => i.status === 'completed').length / all.length;
  }

  getErrorCount(): number {
    return Array.from(this.installations.values()).filter((i) => i.status === 'failed').length;
  }
}
