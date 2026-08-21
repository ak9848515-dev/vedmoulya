// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · BusinessUnit
// SPRINT-032 — configurable business units (NEVER hard-coded businesses).
//
// A business unit is a typed, owner-scoped record: identity, purpose, target
// customer, offerings, workflows, opportunities, costs, revenue, KPIs,
// automation level (0–5), AI capabilities, human responsibilities and
// approval requirements. Units are CONFIGURATION — nothing here spends,
// earns, launches or executes. Profitability is never assumed: evaluations
// come from evidence (see OpportunityEconomics).
// ─────────────────────────────────────────────────────────────────────────────

import type { AutomationLevel, BusinessUnit } from '../types/world-types.js';

export type BusinessUnitResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): BusinessUnitResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code: string): BusinessUnitResult<T> {
  return { success: false, error, code };
}

const MAX_OFFERINGS = 25;
const MAX_KPIS = 20;
const MAX_AI_CAPABILITIES = 30;
const MAX_HUMAN_RESPONSIBILITIES = 30;
const MAX_APPROVAL_REQUIREMENTS = 20;

export class BusinessUnitValidator {
  /** Validate a business unit shape. A unit is never assumed profitable —
   *  offerings/revenue/cost strings are descriptors, not claims. */
  validate(input: {
    ownerId: string;
    id?: string;
    name: string;
    purpose: string;
    targetCustomer?: string;
    offerings?: string[];
    workflowIds?: string[];
    opportunityIds?: string[];
    costs?: string[];
    revenue?: string[];
    kpis?: string[];
    automationLevel?: number;
    aiCapabilities?: string[];
    humanResponsibilities?: string[];
    approvalRequirements?: string[];
    status?: BusinessUnit['status'];
  }): BusinessUnitResult<BusinessUnit> {
    const name = input.name.trim();
    if (name.length === 0) return err('A business unit needs a name.', 'INVALID_NAME');
    if (name.length > 80) return err('Business unit name is too long.', 'INVALID_NAME');
    if (input.purpose.trim().length === 0) {
      return err('A business unit needs a purpose.', 'INVALID_PURPOSE');
    }
    if (input.purpose.length > 500) return err('Purpose is too long.', 'INVALID_PURPOSE');
    if (input.offerings && input.offerings.length > MAX_OFFERINGS) {
      return err('Too many offerings.', 'TOO_MANY_OFFERINGS');
    }
    if (input.kpis && input.kpis.length > MAX_KPIS) return err('Too many KPIs.', 'TOO_MANY_KPIS');
    if (input.aiCapabilities && input.aiCapabilities.length > MAX_AI_CAPABILITIES) {
      return err('Too many AI capabilities.', 'TOO_MANY_AI_CAPABILITIES');
    }
    if (
      input.humanResponsibilities &&
      input.humanResponsibilities.length > MAX_HUMAN_RESPONSIBILITIES
    ) {
      return err('Too many human responsibilities.', 'TOO_MANY_HUMAN_RESPONSIBILITIES');
    }
    if (
      input.approvalRequirements &&
      input.approvalRequirements.length > MAX_APPROVAL_REQUIREMENTS
    ) {
      return err('Too many approval requirements.', 'TOO_MANY_APPROVALS');
    }
    const automationLevel: AutomationLevel =
      input.automationLevel === undefined ? 0 : clampAutomationLevel(input.automationLevel);
    const status: BusinessUnit['status'] = input.status ?? 'ACTIVE';
    const ts = new Date().toISOString();

    return ok({
      id: input.id ?? `bu-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.ownerId,
      stableKey: `${input.ownerId}:business-unit:${slug(name)}`,
      name,
      purpose: input.purpose.trim(),
      targetCustomer: input.targetCustomer?.slice(0, 200),
      offerings: (input.offerings ?? []).slice(0, MAX_OFFERINGS),
      workflowIds: (input.workflowIds ?? []).slice(0, 50),
      opportunityIds: (input.opportunityIds ?? []).slice(0, 50),
      costs: (input.costs ?? []).slice(0, 20),
      revenue: (input.revenue ?? []).slice(0, 20),
      kpis: (input.kpis ?? []).slice(0, MAX_KPIS),
      automationLevel,
      aiCapabilities: (input.aiCapabilities ?? []).slice(0, MAX_AI_CAPABILITIES),
      humanResponsibilities: (input.humanResponsibilities ?? []).slice(
        0,
        MAX_HUMAN_RESPONSIBILITIES,
      ),
      approvalRequirements: (input.approvalRequirements ?? []).slice(0, MAX_APPROVAL_REQUIREMENTS),
      status,
      createdAt: ts,
      updatedAt: ts,
    });
  }
}

function clampAutomationLevel(level: number): AutomationLevel {
  if (level < 0) return 0;
  if (level > 5) return 5;
  return Math.floor(level) as AutomationLevel;
}

/** Deterministic slug for stable keys — strips punctuation, keeps letters. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
