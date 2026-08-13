// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Requirement Change Control
// EPIC-009 — Phase 26. When a confirmed requirement changes: mark the
// previous version, create a new requirement version, and record the
// change. The historical record is NEVER silently mutated.
// ──────────────────────────────────────────────────────────────────

import type { Requirement, RequirementVersion } from '../types/requirement-types.js';

export interface RequirementVersionControlOptions {
  now?: () => string;
}

export class RequirementVersionControl {
  private readonly now: () => string;

  constructor(options: RequirementVersionControlOptions = {}) {
    this.now = options.now ?? ((): string => new Date().toISOString());
  }

  /** Create a new version of a requirement (the old record is untouched). */
  newVersion(
    current: Requirement,
    change: string,
    approve?: { approvedBy: string; approvedAt: string },
  ): { version: RequirementVersion; updated: Requirement } {
    const version: RequirementVersion = {
      version: current.version,
      requirementId: current.id,
      description: current.description,
      change,
      approvedBy: approve?.approvedBy,
      approvedAt: approve?.approvedAt,
      timestamp: this.now(),
    };
    return { version, updated: { ...current, version: current.version + 1 } };
  }

  /** Record a user answer as a versioned requirement change. */
  recordAnswer(
    current: Requirement | undefined,
    description: string,
    source: Requirement['source'],
    owner: string,
  ): { recorded: RequirementVersion; requirement: Requirement } {
    if (current) {
      const { version, updated } = this.newVersion(
        current,
        `requirement updated to: ${description}`,
        { approvedBy: owner, approvedAt: this.now() },
      );
      return {
        recorded: version,
        requirement: { ...updated, description, status: 'CONFIRMED', source },
      };
    }
    const fresh: Requirement = {
      id: `REQ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      description,
      category: 'functional',
      priority: 'HIGH',
      confidence: 0.9,
      source,
      dependencies: [],
      risks: [],
      status: 'CONFIRMED',
      version: 1,
    };
    return {
      recorded: {
        version: 1,
        requirementId: fresh.id,
        description,
        change: 'requirement created from a user answer',
        approvedBy: owner,
        approvedAt: this.now(),
        timestamp: this.now(),
      },
      requirement: fresh,
    };
  }

  /** Latest version number for a requirement id. */
  latestVersion(versions: RequirementVersion[], requirementId: string): number {
    const matches = versions.filter((v) => v.requirementId === requirementId);
    return matches.length === 0 ? 0 : Math.max(...matches.map((v) => v.version));
  }
}
