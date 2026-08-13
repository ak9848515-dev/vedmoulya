// ──────────────────────────────────────────────────────────────────
// VedMoulya — Experience Intelligence: Quality Evaluator
// EPIC-010 — Phase 9. Produces a unified ApplicationQualityEvaluation
// across FUNCTIONAL, UX, VISUAL, ACCESSIBILITY, SECURITY, PERFORMANCE,
// AI, RAG, DATA and ARCHITECTURE. A high aggregate score NEVER hides a
// critical failure: any failing dimension flips the verdict to
// NOT_READY.
// ──────────────────────────────────────────────────────────────────

import type {
  ApplicationQualityEvaluation,
  CriticFinding,
  QualityDimension,
  QualityDimensionResult,
  VisualCriticReport,
} from '../types/experience-types.js';

export interface QualityInput {
  applicationId: string;
  files: Array<{ path: string; content: string }>;
  critic: VisualCriticReport;
  /** External security findings (from the frozen factory security review). */
  securityFindings?: Array<{
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
    filePath?: string;
  }>;
  /** External validation evidence (from the frozen validation pipeline). */
  validationEvidence?: Array<{ gate: string; passed: boolean; detail: string }>;
  createdAt?: string;
}

export const DIMENSIONS: readonly QualityDimension[] = [
  'FUNCTIONAL',
  'UX',
  'VISUAL',
  'ACCESSIBILITY',
  'SECURITY',
  'PERFORMANCE',
  'AI',
  'RAG',
  'DATA',
  'ARCHITECTURE',
];

export class QualityEvaluator {
  evaluate(input: QualityInput): ApplicationQualityEvaluation {
    const dimensions = DIMENSIONS.map((dimension) => this.evaluateDimension(dimension, input));
    const failing = dimensions.filter((d) => d.failed);
    const blockingDimensions = failing.map((d) => d.dimension);
    const overall = this.overall(dimensions);
    const verdict =
      failing.length > 0 ? 'NOT_READY' : overall >= 0.7 ? 'READY' : 'READY_WITH_FINDINGS';
    return {
      applicationId: input.applicationId,
      overall,
      dimensions,
      verdict,
      blockingDimensions,
      verdictReason: this.verdictReason(verdict, failing, overall, input),
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
  }

  private evaluateDimension(
    dimension: QualityDimension,
    input: QualityInput,
  ): QualityDimensionResult {
    const allContent = input.files.map((f) => f.content).join('\n');
    switch (dimension) {
      case 'FUNCTIONAL': {
        const failed = (input.validationEvidence ?? []).some((v) => !v.passed);
        const passed = (input.validationEvidence ?? []).filter((v) => v.passed).length;
        const total = input.validationEvidence?.length ?? 0;
        return {
          dimension,
          score: total === 0 ? 0.5 : passed / total,
          findings: [],
          evidence: (input.validationEvidence ?? []).map(
            (v) => `${v.gate}: ${v.passed ? 'PASS' : 'FAIL'} — ${v.detail}`,
          ),
          recommendations: failed ? ['Fix the failing validation gates before approval'] : [],
          failed,
        };
      }
      case 'VISUAL': {
        const findings = input.critic.findings.filter((f) => f.area !== 'accessibility');
        return {
          dimension,
          score: input.critic.score,
          findings,
          evidence: findings.map((f) => f.evidence),
          recommendations: findings.map((f) => f.recommendation),
          failed: findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH'),
        };
      }
      case 'ACCESSIBILITY': {
        const findings = input.critic.findings.filter((f) => f.area === 'accessibility');
        const score =
          input.critic.findings.length === 0 ? 1 : Math.max(0, 1 - findings.length * 0.1);
        return {
          dimension,
          score: Number(score.toFixed(2)),
          findings,
          evidence: findings.map((f) => f.evidence),
          recommendations: findings.map((f) => f.recommendation),
          failed: findings.some((f) => f.severity === 'HIGH'),
        };
      }
      case 'SECURITY': {
        const findings = input.securityFindings ?? [];
        const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
        const high = findings.filter((f) => f.severity === 'HIGH').length;
        const failed = critical > 0 || high > 0;
        return {
          dimension,
          score: findings.length === 0 ? 1 : Math.max(0, 1 - (critical * 0.4 + high * 0.2)),
          findings: findings.map((f, i) => ({
            id: `SEC-${String(i + 1).padStart(3, '0')}`,
            severity: f.severity,
            area: 'accessibility' as const,
            location: f.filePath ?? 'unknown',
            issue: f.description,
            evidence: f.description,
            recommendation: 'Resolve the security finding before approval',
            evidenceClass: 'CONFIRMED' as const,
            autoFixable: false,
          })),
          evidence: findings.map((f) => `${f.severity}: ${f.description}`),
          recommendations: failed
            ? ['Block approval until CRITICAL/HIGH security findings are resolved']
            : [],
          failed,
        };
      }
      case 'UX': {
        const findings = input.critic.findings.filter(
          (f) => f.area === 'interaction_clarity' || f.area === 'hierarchy',
        );
        return {
          dimension,
          score: input.critic.score,
          findings,
          evidence: findings.map((f) => f.evidence),
          recommendations: findings.map((f) => f.recommendation),
          failed: findings.some((f) => f.severity === 'CRITICAL'),
        };
      }
      case 'PERFORMANCE': {
        const hasLargeFile = input.files.some((f) => f.content.length > 200_000);
        const hasBundleHints = /lazy|dynamic\(|React\.lazy|import\(/.test(allContent);
        return {
          dimension,
          score: hasLargeFile ? 0.4 : hasBundleHints ? 0.9 : 0.7,
          findings: hasLargeFile
            ? [
                this.syntheticFinding(
                  'PERF-001',
                  'A generated file exceeds 200KB — likely monolithic bundle',
                  'HIGH',
                  'visual_density',
                ),
              ]
            : [],
          evidence: hasLargeFile ? ['file size > 200_000 chars'] : ['no oversized file detected'],
          recommendations: hasLargeFile ? ['Split the file into lazy-loaded modules'] : [],
          failed: hasLargeFile,
        };
      }
      case 'AI': {
        const aiMentioned = /ai|llm|model|provider|runtime/.test(allContent);
        return {
          dimension,
          score: aiMentioned ? 0.9 : 0.8,
          findings: [],
          evidence: [
            aiMentioned
              ? 'AI runtime references present'
              : 'No AI usage detected (application works without AI)',
          ],
          recommendations: [],
          failed: false,
        };
      }
      case 'RAG': {
        const ragMentioned = /rag|retrieval|embedding|vector/.test(allContent);
        return {
          dimension,
          score: ragMentioned ? 0.9 : 0.8,
          findings: [],
          evidence: [ragMentioned ? 'RAG references present' : 'No RAG usage detected'],
          recommendations: [],
          failed: false,
        };
      }
      case 'DATA': {
        const dataMentioned = /schema|model|repository|database|postgres/.test(allContent);
        return {
          dimension,
          score: dataMentioned ? 0.9 : 0.6,
          findings: [],
          evidence: [
            dataMentioned ? 'Data model references present' : 'No explicit data layer detected',
          ],
          recommendations: dataMentioned ? [] : ['Define the data model explicitly'],
          failed: false,
        };
      }
      case 'ARCHITECTURE': {
        const hasSeparation =
          /src\/|components\/|pages\/|lib\/|api\//.test(allContent) || input.files.length > 3;
        return {
          dimension,
          score: hasSeparation ? 0.9 : 0.5,
          findings: [],
          evidence: [hasSeparation ? 'Layered file structure detected' : 'No clear file structure'],
          recommendations: hasSeparation ? [] : ['Organize the application into layers'],
          failed: !hasSeparation && input.files.length === 1,
        };
      }
    }
  }

  private syntheticFinding(
    id: string,
    issue: string,
    severity: CriticFinding['severity'],
    area: CriticFinding['area'],
  ): CriticFinding {
    return {
      id,
      severity,
      area,
      location: 'global',
      issue,
      evidence: issue,
      recommendation: 'Address the finding',
      evidenceClass: 'CONFIRMED',
      autoFixable: false,
    };
  }

  private overall(dimensions: QualityDimensionResult[]): number {
    if (dimensions.length === 0) return 0;
    const sum = dimensions.reduce((acc, d) => acc + d.score, 0);
    return Number((Math.round((sum / dimensions.length) * 100) / 100).toFixed(2));
  }

  private verdictReason(
    verdict: ApplicationQualityEvaluation['verdict'],
    failing: QualityDimensionResult[],
    overall: number,
    _input: QualityInput,
  ): string {
    if (failing.length > 0) {
      return `NOT READY — failing dimension(s): ${failing.map((f) => `${f.dimension} (score ${Math.round(f.score * 100)} but failed)`).join(', ')}. A high aggregate score never overrides a critical failure.`;
    }
    if (verdict === 'READY') {
      return `READY — overall ${Math.round(overall * 100)}/100 with no failing dimensions.`;
    }
    return `READY WITH FINDINGS — overall ${Math.round(overall * 100)}/100; no critical failure but below the readiness bar.`;
  }
}
