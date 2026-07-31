// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Identity Router
// Identity Engine procedures
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import type { IdentityApplicationService } from '@vedmoulya/services';
import type { ApiResponse } from '../services/ResponseMapper.js';

export function createIdentityRouter(identityService: IdentityApplicationService): {
  getProfile: (userId: string) => Promise<ApiResponse>;
  updateProfile: (userId: string, updates: Record<string, unknown>) => Promise<ApiResponse>;
} {
  return {
    getProfile: async (userId: string): Promise<ApiResponse> => {
      // IdentityApplicationService exposes getUser as the primary method
      const result = await identityService.getUserById(userId);
      return {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
    updateProfile: async (
      userId: string,
      updates: Record<string, unknown>,
    ): Promise<ApiResponse> => {
      const result = await identityService.updateProfile(userId, updates);
      return {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString(), duration: 0, version: '1.0.0' },
      };
    },
  };
}
