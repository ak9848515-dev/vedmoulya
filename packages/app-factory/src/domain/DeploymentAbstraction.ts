// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Deployment Abstraction
// EPIC-007 — Phase 16. A vendor-neutral deployment abstraction:
//   Application → DeploymentAdapter (vercel / firebase / cloud_run /
//   local / self_hosted).
// Only adapters that can be safely supported now are implemented; a
// deployment NEVER happens without explicit authorization. The local
// (self-hosted / export) adapter is the always-available default.
// ──────────────────────────────────────────────────────────────────

import type { DeploymentAdapterPort } from '../contracts/factory-ports.js';
import type {
  DeploymentRequest,
  DeploymentResult,
  DeploymentTargetId,
} from '../types/app-types.js';

export const SUPPORTED_DEPLOYMENT_TARGETS: DeploymentTargetId[] = [
  'local',
  'self_hosted',
  'vercel',
  'firebase',
  'cloud_run',
];

export class DeploymentAbstraction {
  constructor(private readonly adapters: Record<string, DeploymentAdapterPort>) {}

  /** Adapters that are actually registered (safe to use now). */
  availableTargets(): DeploymentTargetId[] {
    return SUPPORTED_DEPLOYMENT_TARGETS.filter((t) => this.adapters[t] !== undefined);
  }

  /**
   * Deploy via the target adapter. Requires explicit authorization —
   * a blocked deployment returns status 'blocked' (never silent).
   */
  async deploy(request: DeploymentRequest, workspacePath: string): Promise<DeploymentResult> {
    const adapter = this.adapters[request.target];
    if (!adapter) {
      return {
        target: request.target,
        status: 'blocked',
        message: `no deployment adapter is registered for "${request.target}"`,
        requiresAuthorization: true,
      };
    }
    if (!request.authorized) {
      return {
        target: request.target,
        status: 'blocked',
        message: 'deployment requires explicit authorization',
        requiresAuthorization: true,
      };
    }
    const result = await adapter.deploy({
      applicationId: workspacePath.split('/').pop() ?? workspacePath,
      workspacePath,
      authorized: true,
    });
    return {
      target: request.target,
      status: result.status,
      message: result.message,
      requiresAuthorization: false,
      artifactPath: result.artifactPath,
    };
  }
}
