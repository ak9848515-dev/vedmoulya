// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Application Service
// EPIC-009 — the requirements.* execution contract:
//   requirements.start            — understand → extract → analyze →
//                                   questions/defaults (no build)
//   requirements.answer           — user answers → re-derive
//   requirements.acceptAllDefaults / decideDefault — defaults
//   requirements.resolveConflict  — explicit conflict resolution
//   requirements.plan             — generate the full product plan
//   requirements.approve          — Phase 23 approval gate → handoff goal
//   requirements.reject           — user cancels
//   requirements.handoffToFactory — gateway composes factory.create
//   requirements.changeImpact     — Phase 24 mandatory impact analysis
//   requirements.get / list / delete — owner-scoped session management
// Every method is owner-scoped (IDOR enforced at the engine layer).
// ──────────────────────────────────────────────────────────────────

import { NOOP_TELEMETRY } from '@vedmoulya/core';
import type { TelemetryPort } from '@vedmoulya/core';
import type {
  ClockPort,
  RequirementEnrichmentPort,
  RequirementSessionStore,
} from '../contracts/requirement-ports.js';
import { SYSTEM_CLOCK } from '../contracts/requirement-ports.js';
import { ProductIntelligenceEngine } from '../domain/ProductIntelligenceEngine.js';
import { RequirementsMapper } from './RequirementsMapper.js';
import type {
  RequirementsApproveDTO,
  RequirementsHandoffDTO,
  RequirementsSessionDTO,
  RequirementsSessionSummaryDTO,
  RequirementsStartDTO,
} from './RequirementsDTO.js';
import type { ChangeImpact, SafeDefaultStatus } from '../types/requirement-types.js';

export interface RequirementsApplicationServiceOptions {
  store: RequirementSessionStore;
  enrichment?: RequirementEnrichmentPort;
  clock?: ClockPort;
  /**
   * EPIC-012 — optional telemetry port. When provided, requirement-session
   * lifecycle operations emit spans (requirements.start/plan/approve) so the
   * USER IDEA → REQUIREMENTS stage of a trace is reconstructable.
   * Defaults to a zero-overhead NOOP.
   */
  telemetry?: TelemetryPort;
}

export interface RequirementsStartInput {
  idea: string;
  userId: string;
}

export interface RequirementsAnswerInput {
  sessionId: string;
  userId: string;
  answers: Array<{ questionId: string; answer: string }>;
}

export class RequirementsApplicationService {
  private readonly engine: ProductIntelligenceEngine;
  private readonly mapper = new RequirementsMapper();
  private readonly telemetry: TelemetryPort;

  constructor(options: RequirementsApplicationServiceOptions) {
    this.telemetry = options.telemetry ?? NOOP_TELEMETRY;
    this.engine = new ProductIntelligenceEngine({
      store: options.store,
      enrichment: options.enrichment,
      clock: options.clock ?? SYSTEM_CLOCK,
    });
  }

  async start(input: RequirementsStartInput): Promise<RequirementsStartDTO> {
    const session = await this.telemetry.withSpan(
      {
        name: 'requirements.start',
        kind: 'engine',
        userId: input.userId,
        attributes: { idea: input.idea.slice(0, 160) },
      },
      async (span) => {
        const started = await this.engine.start({ idea: input.idea, owner: input.userId });
        span.setAttribute('session_id', started.sessionId);
        span.setAttribute('phase', started.phase);
        return started;
      },
    );
    return this.mapper.toStartDTO(session);
  }

  async get(sessionId: string, userId: string): Promise<RequirementsSessionDTO> {
    return this.mapper.toSessionDTO(await this.engine.get(sessionId, userId));
  }

  async list(userId?: string): Promise<RequirementsSessionSummaryDTO[]> {
    const sessions = await this.engine.list(userId);
    return sessions.map((s) => this.mapper.toSummaryDTO(s));
  }

  async deleteSession(sessionId: string, userId: string): Promise<{ deleted: boolean }> {
    return this.engine.deleteSession(sessionId, userId);
  }

  async answer(input: RequirementsAnswerInput): Promise<RequirementsSessionDTO> {
    const session = await this.engine.answer({
      sessionId: input.sessionId,
      owner: input.userId,
      answers: input.answers,
    });
    return this.mapper.toSessionDTO(session);
  }

  async acceptAllDefaults(sessionId: string, userId: string): Promise<RequirementsSessionDTO> {
    return this.mapper.toSessionDTO(await this.engine.acceptAllDefaults(sessionId, userId));
  }

  async decideDefault(
    sessionId: string,
    userId: string,
    defaultId: string,
    decision: SafeDefaultStatus,
    editedValue?: string,
  ): Promise<RequirementsSessionDTO> {
    return this.mapper.toSessionDTO(
      await this.engine.decideDefault(sessionId, userId, defaultId, decision, editedValue),
    );
  }

  async resolveConflict(
    sessionId: string,
    userId: string,
    conflictId: string,
    choice: string,
  ): Promise<RequirementsSessionDTO> {
    return this.mapper.toSessionDTO(
      await this.engine.resolveConflict(sessionId, userId, conflictId, choice),
    );
  }

  async plan(sessionId: string, userId: string): Promise<RequirementsSessionDTO> {
    const session = await this.telemetry.withSpan(
      {
        name: 'requirements.plan',
        kind: 'engine',
        executionId: sessionId,
        userId,
      },
      async (span) => {
        const planned = await this.engine.plan(sessionId, userId);
        span.setAttribute('phase', planned.phase);
        span.setAttribute('completeness', planned.completeness?.verdict ?? 'none');
        return planned;
      },
    );
    return this.mapper.toSessionDTO(session);
  }

  async approve(sessionId: string, userId: string): Promise<RequirementsApproveDTO> {
    const session = await this.telemetry.withSpan(
      {
        name: 'requirements.approve',
        kind: 'engine',
        executionId: sessionId,
        userId,
      },
      async (span) => {
        const approved = await this.engine.approve(sessionId, userId);
        span.setAttribute('phase', approved.phase);
        span.setAttribute('handoff_goal', approved.handoffGoal ?? '');
        return approved;
      },
    );
    return this.mapper.toApproveDTO(session);
  }

  async reject(
    sessionId: string,
    userId: string,
    reason?: string,
  ): Promise<RequirementsSessionDTO> {
    return this.mapper.toSessionDTO(await this.engine.reject(sessionId, userId, reason));
  }

  async handoffGoal(sessionId: string, userId: string): Promise<RequirementsHandoffDTO> {
    return this.engine.handoffGoal(sessionId, userId);
  }

  async changeImpact(sessionId: string, userId: string, request: string): Promise<ChangeImpact> {
    return this.telemetry.withSpan(
      {
        name: 'requirements.changeImpact',
        kind: 'engine',
        executionId: sessionId,
        userId,
        attributes: { request: request.slice(0, 120) },
      },
      async () => this.engine.changeImpact(sessionId, userId, request),
    );
  }
}
