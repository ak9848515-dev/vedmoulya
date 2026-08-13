// ──────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: AI World Scheduler Router
// EPIC-018 — AI World Scheduler & Discovery Engine
//
// The aiWorldScheduler.* namespace: getStatus (the /ai-world Discovery
// Activity view), listSchedules / setSchedule (enable/disable/
// frequency), runNow (manual discovery through the EXACT same bounded
// path as scheduled runs — no privileged shortcut), cancelRun,
// listRuns / getLedger / listSourcePolicies.
// Every procedure is authenticated + rate-limited; ownership is
// enforced at the service boundary (IDOR refused there) AND by the
// auth middleware (input.userId must match the session user).
// ──────────────────────────────────────────────────────────────────

import type { SchedulerApplicationService } from '@vedmoulya/ai-world-scheduler';
import type { DiscoveryJobCategory, ScheduleFrequency } from '@vedmoulya/ai-world-scheduler';
import type { TRPCContext } from '../services/RouterRegistry.js';
import { assertRateLimit, RateLimitTiers } from '../middleware/rate-limit.js';
import type { ApiResponse } from '../services/ResponseMapper.js';
import { fromServiceResult } from '../services/ResponseMapper.js';
import type { SchedulerRuntimeStatus } from '../observability/scheduler-cadence.js';

export interface SchedulerHandlers {
  getStatus: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
  listSchedules: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
  setSchedule: (
    input: {
      userId: string;
      jobCategory: DiscoveryJobCategory;
      enabled?: boolean;
      frequency?: ScheduleFrequency;
    },
    ctx: TRPCContext,
  ) => ApiResponse;
  runNow: (
    input: { userId: string; jobCategory: DiscoveryJobCategory },
    ctx: TRPCContext,
  ) => Promise<ApiResponse>;
  cancelRun: (
    input: { userId: string; jobCategory: DiscoveryJobCategory },
    ctx: TRPCContext,
  ) => ApiResponse;
  listRuns: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
  getLedger: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
  listSourcePolicies: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
  /** EPIC-018 runtime closure: whether automatic discovery is actually active. */
  getRuntimeStatus: (input: { userId: string }, ctx: TRPCContext) => ApiResponse;
}

/**
 * Build the aiWorldScheduler.* handlers. `runtimeStatus` is the optional
 * cadence-driver status accessor (bound by the RouterRegistry to the gateway
 * singleton). When absent (older callers / test mocks) the honest inactive
 * state is reported — the UI never claims automatic discovery is running when
 * the driver is not bound.
 */
export function createSchedulerRouter(
  service: SchedulerApplicationService,
  runtimeStatus?: () => SchedulerRuntimeStatus,
): SchedulerHandlers {
  return {
    getStatus: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.getStatus(input.userId) });
    },

    getRuntimeStatus: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const status = runtimeStatus
        ? runtimeStatus()
        : ({
            active: false,
            reason: 'not_started',
            maxUsersPerTick: 0,
            refreshIntelligenceEnabled: false,
          } satisfies SchedulerRuntimeStatus);
      return fromServiceResult({ success: true, data: status });
    },

    listSchedules: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.listSchedules(input.userId) });
    },

    setSchedule: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      const result = service.setSchedule(input.userId, input.jobCategory, {
        enabled: input.enabled,
        frequency: input.frequency,
      });
      return fromServiceResult(result);
    },

    runNow: async (input, _ctx): Promise<ApiResponse> => {
      assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(await service.runNow(input.userId, input.jobCategory));
    },

    cancelRun: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.heavy);
      return fromServiceResult(service.cancel(input.userId, input.jobCategory));
    },

    listRuns: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.listRuns(input.userId) });
    },

    getLedger: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.getLedger(input.userId) });
    },

    listSourcePolicies: (input, _ctx): ApiResponse => {
      assertRateLimit(input.userId, RateLimitTiers.standard);
      return fromServiceResult({ success: true, data: service.listSourcePolicies() });
    },
  };
}
