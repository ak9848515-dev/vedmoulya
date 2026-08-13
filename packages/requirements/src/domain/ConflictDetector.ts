// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Conflict Detector
// EPIC-009 — Phase 11. Detects contradictory requirements. When a
// conflict is found the system SAYS so, explains it, and offers
// alternatives — it never silently chooses one side.
// ──────────────────────────────────────────────────────────────────

import type {
  Requirement,
  RequirementConflict,
  RequirementSet,
} from '../types/requirement-types.js';

export interface ConflictRule {
  id: string;
  /** Pair of keyword sets that contradict each other. */
  a: string[];
  b: string[];
  explanation: (a: Requirement, b: Requirement) => string;
  alternatives: string[];
  severity: RequirementConflict['severity'];
}

const RULES: ConflictRule[] = [
  {
    id: 'auth-vs-open',
    a: [
      'only employees',
      'only staff',
      'registered users only',
      'login required',
      'must sign in',
      'employees only',
    ],
    b: [
      'anyone can edit',
      'anyone can access',
      'anyone should be able to edit',
      'anyone should be able to access',
      'should be able to edit',
      'open to the public',
      'no login',
      'no sign in',
      'public access',
      'publicly accessible',
    ],
    explanation: (a, b) =>
      `"${a.description}" restricts access, while "${b.description}" opens it to everyone — these requirements conflict.`,
    alternatives: [
      'Restrict access and drop the open-access requirement',
      'Keep open access and drop the restricted-access requirement',
      'Add roles: public read-only + authenticated write',
    ],
    severity: 'CRITICAL',
  },
  {
    id: 'free-vs-paid',
    a: ['free', 'no cost', 'no payment'],
    b: ['payment required', 'pay', 'subscription', 'billing', 'charge'],
    explanation: (a, b) =>
      `"${a.description}" says the product is free, while "${b.description}" requires payment — these requirements conflict.`,
    alternatives: [
      'Free tier + optional paid tier',
      'Entirely free (drop the payment requirement)',
      'Entirely paid (drop the free requirement)',
    ],
    severity: 'HIGH',
  },
  {
    id: 'anonymous-vs-account',
    a: ['no account', 'no login', 'guest', 'anonymous'],
    b: ['account required', 'must create an account', 'login required', 'sign up'],
    explanation: (a, b) =>
      `"${a.description}" wants anonymous use, while "${b.description}" requires an account — these requirements conflict.`,
    alternatives: [
      'Guest checkout + optional account',
      'Accounts required (drop anonymous use)',
      'Anonymous use only (drop accounts)',
    ],
    severity: 'HIGH',
  },
  {
    id: 'public-vs-private-data',
    a: ['public', 'everyone can see', 'shared with everyone'],
    b: ['private', 'confidential', 'only the owner', 'personal data', 'only me'],
    explanation: (a, b) =>
      `"${a.description}" exposes data, while "${b.description}" keeps it private — these requirements conflict.`,
    alternatives: [
      'Public for some records, private for others (per-record visibility)',
      'Private only',
      'Public only',
    ],
    severity: 'CRITICAL',
  },
  {
    id: 'multi-tenant-vs-single',
    a: ['multi-tenant', 'organization', 'teams', 'shared workspace'],
    b: ['single user', 'personal', 'only me'],
    explanation: (a, b) =>
      `"${a.description}" wants shared/tenanted access, while "${b.description}" is single-user — these requirements conflict.`,
    alternatives: ['Multi-tenant with personal spaces', 'Single-user', 'Multi-tenant only'],
    severity: 'MEDIUM',
  },
];

export class ConflictDetector {
  detect(set: RequirementSet): RequirementConflict[] {
    const conflicts: RequirementConflict[] = [];
    const reqs = set.requirements;
    for (let i = 0; i < reqs.length; i += 1) {
      const a = reqs[i];
      if (a === undefined) continue;
      for (let j = i + 1; j < reqs.length; j += 1) {
        const b = reqs[j];
        if (b === undefined) continue;
        for (const rule of RULES) {
          const aMatches = rule.a.some((kw) => a.description.toLowerCase().includes(kw));
          const bMatches = rule.b.some((kw) => b.description.toLowerCase().includes(kw));
          if (
            (aMatches && bMatches) ||
            (rule.b.some((kw) => a.description.toLowerCase().includes(kw)) &&
              rule.a.some((kw) => b.description.toLowerCase().includes(kw)))
          ) {
            conflicts.push({
              id: `CFL-${conflicts.length + 1}`,
              reqAId: a.id,
              reqBId: b.id,
              description: 'These requirements conflict.',
              explanation: rule.explanation(a, b),
              alternatives: rule.alternatives,
              severity: rule.severity,
              status: 'open',
            });
            break;
          }
        }
      }
    }
    return dedupe(conflicts);
  }
}

/** Remove mirror duplicates (A↔B and B↔A for the same rule text). */
function dedupe(conflicts: RequirementConflict[]): RequirementConflict[] {
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = [c.reqAId, c.reqBId, c.explanation].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
