// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Security-by-Design Planner
// EPIC-009 — Phase 20. Security is planned BEFORE generation:
// authentication, authorization, roles, ownership, tenancy, secrets,
// PII, API security, file access, tool permissions, audit and logging.
// Security-critical unknowns become BLOCKING questions.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { SecurityPlan } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface SecurityInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Unanswered security-sensitive questions → blocking security unknowns. */
  unansweredSecurityQuestions: string[];
  /** Whether the app handles online payments. */
  handlesPayments: boolean;
}

export class SecurityPlanner {
  plan(input: SecurityInput): SecurityPlan {
    const k = knowledgeFor(input.archetype);
    const security = k.security;

    const securityCriticalUnknowns = input.unansweredSecurityQuestions.map(
      (q) => `Unanswered security-sensitive question: ${q}`,
    );
    if (input.handlesPayments && securityCriticalUnknowns.length === 0) {
      securityCriticalUnknowns.push(
        'Payment processing security (provider tokenization, PCI scope) must be confirmed before build',
      );
    }

    return {
      authentication: security.authentication,
      authorization: security.authorization,
      roles: security.roles,
      ownership: security.ownership,
      tenancy: security.tenancy,
      secrets: security.secrets,
      pii: security.pii,
      apiSecurity: security.apiSecurity,
      fileAccess: security.fileAccess,
      toolPermissions: security.toolPermissions,
      audit: security.audit,
      logging: security.logging,
      securityCriticalUnknowns,
      blockingQuestions: securityCriticalUnknowns,
    };
  }
}
