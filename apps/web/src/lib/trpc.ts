// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — tRPC Client
// Type-safe communication between frontend and backend services
// BLD-016-A — Application Shell & Foundation
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@vedmoulya/api';

// ── tRPC Client ─────────────────────────────────────────────────────────────

export const api = createTRPCReact<AppRouter>();
