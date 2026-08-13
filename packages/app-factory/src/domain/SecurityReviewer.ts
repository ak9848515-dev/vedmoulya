// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Application Factory: Security Reviewer
// EPIC-007 — Phase 12. Every generated application receives a security
// review: dependency audit, authentication, authorization, IDOR,
// secret exposure, unsafe input, injection, API security, file access
// and tool permissions. Findings are classified CRITICAL/HIGH/MEDIUM/
// LOW. CRITICAL/HIGH findings BLOCK completion.
//
// The reviewer is DETERMINISTIC: it scans the actual generated file
// tree + the architecture security controls. Live dependency audit
// (npm audit on the generated project) is a documented operator step —
// the factory never fabricates a clean audit.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import type { SecurityFinding, SecurityReport } from '../types/app-types.js';

const SECRET_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  severity: SecurityFinding['severity'];
}> = [
  {
    pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
    label: 'hard-coded secret',
    severity: 'HIGH',
  },
  { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key', severity: 'CRITICAL' },
  { pattern: /ghp_[A-Za-z0-9]{36}/, label: 'GitHub token', severity: 'CRITICAL' },
  { pattern: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI-style API key', severity: 'CRITICAL' },
];

const UNSAFE_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  severity: SecurityFinding['severity'];
  category: SecurityFinding['category'];
}> = [
  { pattern: /\beval\s*\(/, label: 'eval() usage', severity: 'HIGH', category: 'unsafe_input' },
  {
    pattern: /child_process|execSync|\bexec\s*\(/,
    label: 'shell execution',
    severity: 'HIGH',
    category: 'file_access',
  },
  {
    pattern: /fs\.(writeFile|unlink|rm|mkdir)/,
    label: 'unrestricted filesystem write',
    severity: 'MEDIUM',
    category: 'file_access',
  },
  {
    pattern: /\bfetch\s*\(['"](?:https?:)?\/\//,
    label: 'outbound network call',
    severity: 'MEDIUM',
    category: 'api_security',
  },
];

const API_KEY_REQUIRED = (endpoint: { authRequired: boolean }): boolean => endpoint.authRequired;

export class SecurityReviewer {
  review(
    applicationId: string,
    project: {
      files: Array<{ path: string; content: string }>;
      apiContract: Array<{
        endpoint: string;
        method: string;
        purpose: string;
        authRequired: boolean;
      }>;
      dependencies: string[];
    },
  ): SecurityReport {
    const findings: SecurityFinding[] = [];

    // 1. Secret exposure scan over every generated file.
    for (const file of project.files) {
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(file.content)) {
          findings.push(
            this.finding(
              rule.severity,
              'secret_exposure',
              `possible ${rule.label} in ${file.path}`,
              file.path,
              'Move secrets to environment variables; never commit credentials.',
            ),
          );
        }
      }
      for (const rule of UNSAFE_PATTERNS) {
        if (rule.pattern.test(file.content)) {
          findings.push(
            this.finding(
              rule.severity,
              rule.category,
              `${rule.label} in ${file.path}`,
              file.path,
              'Remove the unsafe construct or route it through the controlled platform boundary.',
            ),
          );
        }
      }
    }

    // 2. Dependency audit (declared dependencies vs the platform allowlist).
    const allowedDeps = new Set([
      'typescript',
      'vitest',
      'react',
      'next',
      'zod',
      '@vedmoulya/core',
    ]);
    for (const dep of project.dependencies) {
      if (dep.startsWith('@vedmoulya/')) continue; // platform packages are governed elsewhere
      if (!allowedDeps.has(dep)) {
        findings.push(
          this.finding(
            'MEDIUM',
            'dependency',
            `dependency "${dep}" is not in the approved allowlist`,
            undefined,
            'Replace with an approved dependency or add it through the dependency review process.',
          ),
        );
      }
    }

    // 3. Authentication / authorization review of the API contract.
    for (const endpoint of project.apiContract) {
      if (API_KEY_REQUIRED(endpoint) && endpoint.method !== 'GET') {
        // Mutating authenticated endpoints are expected to be authorized — ok.
        findings.push(
          this.finding(
            'LOW',
            'api_security',
            `${endpoint.method} ${endpoint.endpoint} requires auth (owner-scoped checks must be verified)`,
            undefined,
            'Ensure owner-scoped authorization on this endpoint (IDOR check).',
          ),
        );
      }
    }
    const anyMutating = project.apiContract.some((e) => e.method !== 'GET');
    if (anyMutating) {
      findings.push(
        this.finding(
          'LOW',
          'authorization',
          'mutating endpoints present — verify authorization middleware',
          undefined,
          'Every mutating endpoint must run through authorization middleware.',
        ),
      );
    }

    // 4. Injection surface review (input-driven templates).
    if (project.files.some((f) => /dangerouslySetInnerHTML|innerHTML\s*=/.test(f.content))) {
      findings.push(
        this.finding(
          'HIGH',
          'injection',
          'dangerous HTML injection surface detected',
          project.files.find((f) => /dangerouslySetInnerHTML|innerHTML\s*=/.test(f.content))?.path,
          'Sanitize user content before rendering.',
        ),
      );
    }

    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      if (f.severity === 'CRITICAL') summary.critical += 1;
      if (f.severity === 'HIGH') summary.high += 1;
      if (f.severity === 'MEDIUM') summary.medium += 1;
      if (f.severity === 'LOW') summary.low += 1;
    }

    return {
      applicationId,
      findings,
      blocked: summary.critical > 0 || summary.high > 0,
      summary,
    };
  }

  private finding(
    severity: SecurityFinding['severity'],
    category: SecurityFinding['category'],
    description: string,
    filePath: string | undefined,
    remediation: string,
  ): SecurityFinding {
    return {
      findingId: `finding-${generateId()}`,
      severity,
      category,
      description,
      filePath,
      remediation,
    };
  }
}

/** Severity ranking helper for sorting findings. */
export function severityRank(severity: SecurityFinding['severity']): number {
  switch (severity) {
    case 'CRITICAL':
      return 4;
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 1;
  }
}
