// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Main Router
// Unified tRPC router exposing all certified modules
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { ApiApplicationService } from './services/ApiApplicationService.js';
import { createAppRouter } from './services/RouterRegistry.js';

// ── Global Services Instance ────────────────────────────────────────────────

const services = new ApiApplicationService();

// ── tRPC Context ────────────────────────────────────────────────────────────

export interface TRPCContext {
  userId: string;
  email: string;
  role: string;
}

// ── App Router ──────────────────────────────────────────────────────────────

export const appRouter = createAppRouter(services);
export type AppRouter = ReturnType<typeof createAppRouter>;
