// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Explainability Service
// Generates human-readable explanations for every decision.
// Every decision must contain:
// - Decision ID, Version, Inputs Used
// - Knowledge References, Memory References
// - Assumptions, Constraints, Options Considered
// - Scoring Matrix, Reasoning Summary
// - Risk Summary, Opportunity Summary
// - Confidence Score, Recommended Action
// - Alternative Actions, Timestamp
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Decision } from '@vedmoulya/domain';
import { getDecisionConfig } from '../config/DecisionConfig.js';
import type {
  DecisionExplanation,
  ExplanationFormat,
  ExplainabilityRequest,
  ExplainabilityResponse,
} from '../types/DecisionTypes.js';
import type { KnowledgeGraphClient } from '../integration/KnowledgeGraphClient.js';
import type { AIOrchestratorClient } from '../integration/AIOrchestratorClient.js';

export interface ExplainabilityComponent {
  type:
    | 'reason'
    | 'dna_attribution'
    | 'problem_mapping'
    | 'journey_context'
    | 'confidence_display'
    | 'alternatives';
  content: string;
}

export class DecisionExplainabilityService {
  private readonly kgClient: KnowledgeGraphClient | null;
  private readonly aiClient: AIOrchestratorClient | null;

  constructor(kgClient?: KnowledgeGraphClient, aiClient?: AIOrchestratorClient) {
    this.kgClient = kgClient ?? null;
    this.aiClient = aiClient ?? null;
  }

  /** Generate full explanation for a decision */
  async generateExplanation(
    request: ExplainabilityRequest,
    decision: Decision,
  ): Promise<ExplainabilityResponse> {
    const config = getDecisionConfig().explainability;
    const format = request.format ?? config.defaultFormat;
    const includeAlternatives = request.includeAlternatives ?? config.includeAlternatives;
    const maxAlternatives = request.maxAlternatives ?? config.maxAlternatives;

    const components = this.assembleComponents(decision, format);

    const explanation: DecisionExplanation = {
      decisionId: decision.id,
      format,
      summary: this.generateSummary(decision, components),
      reason: this.generatePrimaryReason(decision, components),
      dnaAttribution: this.generateDNAAttribution(decision),
      problemsAddressed: [],
      journeyStage: '',
      confidenceText: this.generateConfidenceText(decision),
      alternatives: includeAlternatives ? this.generateAlternatives(decision, maxAlternatives) : [],
      rawData: format === 'raw' ? this.generateRawData(decision) : undefined,
    };

    // Try AI-powered natural language enhancement for detailed format
    if (format === 'detailed' && this.aiClient?.isEnabled()) {
      const aiExplanation = await this.aiClient.generateExplanation({
        decisionId: decision.id,
        title: decision.title,
        category: decision.category,
        status: decision.status.toString(),
        confidence: decision.confidence.score,
        selectedOption: decision.selectedOption?.label ?? 'None',
        options: decision.options.map((o) => o.label),
      });

      if (aiExplanation) {
        explanation.summary = aiExplanation;
      }
    }

    return {
      decisionId: decision.id,
      explanation,
      format,
      generatedAt: new Date().toISOString(),
    };
  }

  /** Assemble explanation components */
  private assembleComponents(
    decision: Decision,
    _format: ExplanationFormat,
  ): ExplainabilityComponent[] {
    const components: ExplainabilityComponent[] = [];

    // Reason
    const reason = this.determinePrimaryReason(decision);
    if (reason) {
      components.push({ type: 'reason', content: reason });
    }

    // Confidence display
    const confidenceText = this.generateConfidenceText(decision);
    components.push({ type: 'confidence_display', content: confidenceText });

    // Alternatives
    if (decision.options.length > 0) {
      const alternatives = decision.options
        .filter((o) => o.id !== decision.selectedOptionId)
        .slice(0, 3)
        .map((o) => `${o.label}${o.score ? ` (score: ${String(o.score.overall)})` : ''}`)
        .join(', ');
      if (alternatives) {
        components.push({
          type: 'alternatives',
          content: `Alternatives considered: ${alternatives}`,
        });
      }
    }

    return components;
  }

  /** Generate a one-line summary */
  private generateSummary(decision: Decision, _components: ExplainabilityComponent[]): string {
    if (decision.selectedOption) {
      return `Recommended ${decision.selectedOption.label} based on ${decision.category} analysis.`;
    }
    return `Decision analysis for "${decision.title}" with ${String(decision.options.length)} options considered.`;
  }

  /** Generate primary reason for the decision */
  private generatePrimaryReason(
    decision: Decision,
    _components: ExplainabilityComponent[],
  ): string {
    if (decision.reasoning) {
      return decision.reasoning.summary;
    }
    if (decision.selectedOption) {
      return `Selected ${decision.selectedOption.label} as the best option among ${String(decision.options.length)} alternatives.`;
    }
    return 'Decision is pending evaluation.';
  }

  /** Determine the primary reason text */
  private determinePrimaryReason(decision: Decision): string {
    if (decision.selectedOption && decision.reasoning) {
      const topPro = decision.reasoning.pros[0];
      if (topPro) {
        return `We recommend ${decision.selectedOption.label} because ${topPro.toLowerCase()}.`;
      }
      return `We recommend ${decision.selectedOption.label} based on our analysis.`;
    }
    return '';
  }

  /** Generate DNA attribution from decision data */
  private generateDNAAttribution(
    decision: Decision,
  ): Array<{ dimension: string; attribute: string }> {
    const attributions: Array<{ dimension: string; attribute: string }> = [];
    if (decision.knowledgeNodeIds.length > 0) {
      attributions.push({
        dimension: 'Knowledge',
        attribute: `Based on ${String(decision.knowledgeNodeIds.length)} knowledge references`,
      });
    }
    if (decision.memoryIds.length > 0) {
      attributions.push({
        dimension: 'Experience',
        attribute: `Informed by ${String(decision.memoryIds.length)} past experiences`,
      });
    }
    attributions.push({ dimension: 'Priority', attribute: decision.priority.toString() });
    return attributions;
  }

  /** Generate confidence explanation text */
  private generateConfidenceText(decision: Decision): string {
    const level = decision.confidence.level;
    const score = decision.confidence.score;

    switch (level) {
      case 'very_high':
        return `We're very confident (${(score * 100).toFixed(0)}%) — strong data supports this decision.`;
      case 'high':
        return `We're confident (${(score * 100).toFixed(0)}%) — good data supports this decision.`;
      case 'medium':
        return `We're moderately confident (${(score * 100).toFixed(0)}%) — reasonable data available.`;
      case 'low':
        return `We're exploring this option (${(score * 100).toFixed(0)}%) — limited data available.`;
      default:
        return 'Confidence level is unknown — additional data needed.';
    }
  }

  /** Generate alternative options */
  private generateAlternatives(
    decision: Decision,
    maxCount: number,
  ): Array<{ optionId: string; label: string; reason: string }> {
    return decision.options
      .filter((o) => o.id !== decision.selectedOptionId && o.score)
      .slice(0, maxCount)
      .map((o) => ({
        optionId: o.id,
        label: o.label,
        reason: o.score
          ? `Score: ${String(o.score.overall)}/10. ${o.risk?.isAcceptable() ? 'Acceptable risk.' : ''} ${o.opportunity?.isSignificant() ? 'Significant opportunity.' : ''}`
          : 'Not scored.',
      }));
  }

  /** Generate raw machine-readable data */
  private generateRawData(decision: Decision): Record<string, unknown> {
    return {
      decisionId: decision.id,
      title: decision.title,
      category: decision.category,
      status: decision.status.toString(),
      version: decision.version.label,
      priority: { level: decision.priority.level, score: decision.priority.score },
      confidence: { level: decision.confidence.level, score: decision.confidence.score },
      optionsCount: decision.options.length,
      evidenceCount: decision.evidence.length,
      constraintCount: decision.constraints.length,
      knowledgeNodeIds: [...decision.knowledgeNodeIds],
      memoryIds: [...decision.memoryIds],
      selectedOptionId: decision.selectedOptionId,
      hasReasoning: !!decision.reasoning,
      hasOutcome: !!decision.outcome,
      createdAt: decision.createdAt,
      updatedAt: decision.updatedAt,
      completedAt: decision.completedAt,
    };
  }

  /** Generate a short one-line explanation */
  generateShortExplanation(decision: Decision): string {
    if (decision.selectedOption && decision.reasoning) {
      return `${decision.selectedOption.label}: ${decision.reasoning.summary}`;
    }
    return `"${decision.title}" — ${String(decision.options.length)} options, confidence ${decision.confidence.level}`;
  }

  /** Generate a standard explanation (2-3 sentences) */
  generateStandardExplanation(decision: Decision): string {
    const parts: string[] = [];

    if (decision.selectedOption) {
      parts.push(`Recommended: ${decision.selectedOption.label}`);
    }

    if (decision.reasoning?.summary) {
      parts.push(`Reason: ${decision.reasoning.summary}`);
    }

    parts.push(
      `Confidence: ${decision.confidence.level} ${'(score: ' + decision.confidence.score.toFixed(2) + ')'}`,
    );

    const alternatives = decision.options
      .filter((o) => o.id !== decision.selectedOptionId)
      .slice(0, 2)
      .map((o) => o.label);

    if (alternatives.length > 0) {
      parts.push(`Alternatives: ${alternatives.join(', ')}`);
    }

    return parts.join('. ');
  }

  /** Generate risk summary text */
  generateRiskSummary(decision: Decision): string {
    const risks = decision.options
      .filter((o) => o.risk && o.risk.isCritical())
      .map((o) => `${o.label}: ${o.risk?.description ?? ''}`);

    if (risks.length === 0) {
      return 'No critical risks identified.';
    }

    return `Risks identified: ${risks.join('; ')}`;
  }

  /** Generate opportunity summary text */
  generateOpportunitySummary(decision: Decision): string {
    const opportunities = decision.options
      .filter((o) => o.opportunity && o.opportunity.isSignificant())
      .map((o) => `${o.label}: ${o.opportunity?.description ?? ''}`);

    if (opportunities.length === 0) {
      return 'No significant opportunities identified.';
    }

    return `Opportunities: ${opportunities.join('; ')}`;
  }
}
