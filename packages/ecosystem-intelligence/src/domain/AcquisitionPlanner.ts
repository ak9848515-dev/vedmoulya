// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/ecosystem-intelligence
// AcquisitionPlanner — EPIC-015
//
// Controlled repository acquisition:
//   DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL → ACQUIRE →
//   SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION.
// READ ≠ CLONE ≠ EXECUTE ≠ INSTALL ≠ CONFIGURE ≠ USE IN FACTORY —
// each is a separate permissioned action. Security BLOCKED always
// stops the pipeline; declined approval resolves to a fallback, never
// to silent execution.
// ──────────────────────────────────────────────────────────────────

import type {
  AcquisitionPlan,
  AcquisitionState,
  LicenseIntelligence,
  RepositorySecurityAssessment,
} from '../types/intelligence-types.js';
import type { ClockPort } from '../contracts/intelligence-ports.js';

export interface AcquisitionInput {
  repository: string;
  visibility: 'public' | 'private';
  security: RepositorySecurityAssessment;
  license?: LicenseIntelligence;
  /** Why this repo matters (relevance evidence). */
  relevance: string[];
  /** Whether the user pre-authorized repo read (GitHub grant). */
  repoReadAuthorized: boolean;
}

const ORDER: readonly AcquisitionState[] = [
  'DISCOVERED',
  'SECURITY_REVIEW',
  'RELEVANCE',
  'APPROVAL_REQUIRED',
  'APPROVED',
  'ACQUIRED',
  'SANDBOXED',
  'ANALYZED',
  'STORED',
  'CONFIGURED',
] as const;

export class AcquisitionPlanner {
  constructor(private readonly clock: ClockPort) {}

  plan(input: AcquisitionInput): AcquisitionPlan {
    const base: AcquisitionPlan = {
      repository: input.repository,
      state: 'DISCOVERED',
      security: input.security,
      license: input.license,
      relevance: input.relevance,
      requiresApprovalFor: [],
      updatedAt: this.clock.now(),
    };

    // ── Gate 1: security ──────────────────────────────────────────
    if (input.security.classification === 'BLOCKED') {
      return {
        ...base,
        state: 'BLOCKED',
        requiresApprovalFor: [],
        fallback:
          'This repository is blocked by the security gate — it will never be executed or installed.',
      };
    }

    base.state = 'SECURITY_REVIEW';

    // ── Gate 2: license ───────────────────────────────────────────
    if (input.license && input.license.verdict === 'LICENSE_UNKNOWN') {
      base.relevance = [
        ...(base.relevance ?? []),
        'License could not be established — commercial factory integration is NOT auto-approved.',
      ];
    }

    base.state = 'RELEVANCE';

    // ── Gate 3: approval boundaries ───────────────────────────────
    // Acquiring (cloning into a sandbox) always needs approval; using
    // in a factory always needs approval; executing/installing/
    // configuring always need approval. Reading is covered by the
    // GitHub grant (repoReadAuthorized) — but read never implies run.
    const requiresApprovalFor: AcquisitionPlan['requiresApprovalFor'] = [];
    requiresApprovalFor.push('acquire');
    if (input.security.sandboxRequired && !input.security.sandboxAvailable) {
      requiresApprovalFor.push('execute');
    } else if (
      input.security.classification === 'TRUSTED_WITH_REVIEW' ||
      input.security.classification === 'SECURITY_REVIEW_REQUIRED'
    ) {
      requiresApprovalFor.push('execute');
    }
    requiresApprovalFor.push('install', 'configure', 'use_in_factory');

    base.state = 'APPROVAL_REQUIRED';
    base.requiresApprovalFor = requiresApprovalFor;
    base.fallback =
      'If declined, execution continues with the best available configured capability — the repository is never used.' +
      (input.security.classification === 'TRUSTED_WITH_REVIEW'
        ? ' Security review findings remain attached to the record.'
        : '');
    return base;
  }

  approve(
    plan: AcquisitionPlan,
    granted: Array<'acquire' | 'clone' | 'execute' | 'install' | 'configure' | 'use_in_factory'>,
  ): AcquisitionPlan {
    if (plan.state === 'BLOCKED') return plan;
    const stillRequired = plan.requiresApprovalFor.filter((a) => !granted.includes(a));
    if (stillRequired.length > 0) {
      return { ...plan, requiresApprovalFor: stillRequired, updatedAt: this.clock.now() };
    }
    return {
      ...plan,
      state: 'APPROVED',
      requiresApprovalFor: [],
      updatedAt: this.clock.now(),
    };
  }

  reject(plan: AcquisitionPlan): AcquisitionPlan {
    if (plan.state === 'BLOCKED') return plan;
    return { ...plan, state: 'REJECTED', updatedAt: this.clock.now() };
  }

  advance(plan: AcquisitionPlan): AcquisitionPlan {
    if (plan.state === 'BLOCKED' || plan.state === 'REJECTED') return plan;
    const idx = ORDER.indexOf(plan.state);
    if (idx < 0 || idx >= ORDER.length - 1) return plan;
    const next = ORDER[idx + 1] as AcquisitionState;
    return { ...plan, state: next, updatedAt: this.clock.now() };
  }

  /** Sandbox decision: the repo may only execute when a sandbox exists and review cleared it. */
  mayExecute(plan: AcquisitionPlan): boolean {
    return (
      (plan.state === 'SANDBOXED' ||
        plan.state === 'ANALYZED' ||
        plan.state === 'STORED' ||
        plan.state === 'CONFIGURED') &&
      plan.security?.classification !== 'BLOCKED' &&
      plan.security?.classification !== 'SECURITY_REVIEW_REQUIRED'
    );
  }
}
