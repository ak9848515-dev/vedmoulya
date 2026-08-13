// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrated AI Loop Engine: Goal Catalog
// EPIC-006 — Phase 13: three controlled demonstrations (ABAP Debugger
// Assistant, Restaurant App Builder, General AI App Builder) + a
// generic fallback. The architecture stays generic — these templates
// are declarative data, not special-case code paths.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { GoalPattern, LoopTask } from '../types/loop-types.js';

export interface GoalPatternDef {
  id: GoalPattern;
  label: string;
  description: string;
  /** Keyword rules (case-insensitive substring). Empty = catch-all fallback. */
  keywords: string[];
}

export const GOAL_PATTERNS: readonly GoalPatternDef[] = [
  {
    id: 'abap-debugger',
    label: 'ABAP Debugger Assistant',
    description:
      'Given ABAP code + an error, retrieve SAP knowledge, analyze the source, generate a diagnosis + correction, and validate it.',
    keywords: ['abap', 'debugger', 'debug', 'sap error', 'sap code'],
  },
  {
    id: 'ai-app-builder',
    label: 'AI Application Builder',
    description:
      'From "Build an AI application for X", produce requirements, architecture, AI capabilities and an implementation + validation plan.',
    // ORDER MATTERS: checked before app-builder so "AI application" never
    // falls into the generic app-builder bucket.
    keywords: [
      'ai app',
      'ai application',
      'ai tool',
      'artificial intelligence app',
      'llm app',
      'agent app',
    ],
  },
  {
    id: 'app-builder',
    label: 'Application Builder',
    description:
      'From a product brief ("Build a … app"), produce requirements, architecture, UI plan and an implementation plan, refined by critique.',
    keywords: ['app', 'application', 'website', 'web app', 'mobile app', 'restaurant'],
  },
  {
    id: 'generic',
    label: 'General Goal',
    description:
      'Generic evidence-first loop: understand → retrieve → analyze → produce → validate → critique.',
    keywords: [],
  },
];

/** Capability labels surfaced in the UI — "WHY is VedMoulya doing this?". */
export const SPECIALIST_LABELS: Record<string, string> = {
  reasoning: 'Reasoning Specialist',
  coding: 'Coding Specialist',
  summarization: 'Summarization Specialist',
  classification: 'Classification Specialist',
  content_generation: 'Content Specialist',
  general_conversation: 'General Assistant',
};

/** Human-readable label for a capability. */
export function specialistLabel(capability: CapabilityType): string {
  return SPECIALIST_LABELS[capability] ?? capability;
}

/** Detect the goal pattern deterministically (no LLM, no uncontrolled guessing). */
export function detectGoalPattern(goal: string): GoalPattern {
  const normalized = goal.toLowerCase();
  for (const pattern of GOAL_PATTERNS) {
    if (pattern.keywords.length === 0) continue;
    if (pattern.keywords.some((keyword) => normalized.includes(keyword))) {
      return pattern.id;
    }
  }
  return 'generic';
}

export function patternLabel(pattern: GoalPattern): string {
  return GOAL_PATTERNS.find((p) => p.id === pattern)?.label ?? 'General Goal';
}

/**
 * Capability keywords per goal pattern. Detected deterministically and
 * recorded in `derivationReasons` so every required capability is explained.
 */
export function capabilitiesForPattern(pattern: GoalPattern, _goal: string): CapabilityType[] {
  switch (pattern) {
    case 'abap-debugger':
      return ['coding', 'reasoning', 'summarization', 'classification'];
    case 'ai-app-builder':
      return ['reasoning', 'content_generation', 'classification'];
    case 'app-builder':
      return ['reasoning', 'content_generation'];
    case 'generic':
      return ['reasoning', 'content_generation'];
    default:
      return ['reasoning'];
  }
}

/**
 * Evidence requirement per pattern. The collection is derived from the goal
 * pattern so RAG stays tenant/user-scoped (Phase 6).
 */
export function evidenceForPattern(pattern: GoalPattern, _goal: string): string {
  switch (pattern) {
    case 'abap-debugger':
      return 'SAP/ABAP documentation, error-message catalogs and the user-provided source code';
    case 'ai-app-builder':
      return 'AI platform documentation, model capability notes and product brief context';
    case 'app-builder':
      return 'product brief context, industry reference material and platform documentation';
    default:
      return 'enterprise knowledge base and user-provided context';
  }
}

export interface TaskTemplate {
  title: string;
  description: string;
  capability: CapabilityType;
  phase: LoopTask['phase'];
  /** Prompt template with {goal} and {evidence} placeholders. */
  prompt: string;
  evidence?: boolean;
  groundingRequired?: boolean;
  allowedTools: string[];
  /**
   * Per-tool probe arguments (keyed by tool name) — tools whose schemas
   * require arguments (e.g. calculator needs `expression`) receive valid
   * probe values so the pre-flight security probe passes schema validation.
   */
  toolArguments?: Record<string, Record<string, unknown>>;
  parallelEligible?: boolean;
  expectedOutput: string;
  qualityTier: LoopTask['qualityTier'];
  /** Dependency declaration by template index (earlier task). */
  dependsOn?: number[];
  /** Slot name this template's output feeds into for dependent prompts. */
  slot?: string;
}

/**
 * Declarative task templates for the three controlled demonstrations + the
 * generic fallback. The TaskDecompositionService turns these into LoopTask
 * instances with ids, budgets, retry policies and DAG edges.
 */
export function templatesForPattern(pattern: GoalPattern): TaskTemplate[] {
  switch (pattern) {
    case 'abap-debugger':
      return [
        {
          title: 'Understand the ABAP error',
          description:
            'Parse the user-provided ABAP code + error and restate the failure precisely.',
          capability: 'reasoning',
          phase: 'understand',
          prompt:
            'Goal: {goal}\n\nUnderstand the ABAP program and the reported error. Restate the failure precisely, list the suspicious statements and the affected data objects.',
          allowedTools: [],
          expectedOutput: 'A precise restatement of the ABAP failure with suspicious statements.',
          qualityTier: 'standard',
        },
        {
          title: 'Retrieve SAP/ABAP knowledge',
          description: 'Retrieve relevant SAP/ABAP documentation through RAG (grounding required).',
          capability: 'reasoning',
          phase: 'retrieve',
          evidence: true,
          groundingRequired: true,
          prompt:
            'Goal: {goal}\n\nRetrieve the SAP/ABAP documentation relevant to this error class and summarize what it says about causes, diagnostics and fixes.',
          allowedTools: [],
          parallelEligible: true,
          expectedOutput: 'Grounded SAP/ABAP knowledge relevant to the error.',
          qualityTier: 'standard',
          slot: 'evidence',
        },
        {
          title: 'Analyze the source code',
          description: 'Reason over the user code against the retrieved evidence.',
          capability: 'reasoning',
          phase: 'analyze',
          prompt:
            'Goal: {goal}\n\nEvidence: {evidence}\n\nAnalyze the provided ABAP source against the evidence. Trace the data flow around the error and identify the root cause.',
          allowedTools: [],
          dependsOn: [0, 1],
          expectedOutput: 'Root-cause analysis tracing data flow around the error.',
          qualityTier: 'standard',
          slot: 'analysis',
        },
        {
          title: 'Generate a correction',
          description: 'Produce corrected ABAP code implementing the fix.',
          capability: 'coding',
          phase: 'produce',
          prompt:
            'Goal: {goal}\n\nAnalysis: {analysis}\n\nGenerate the corrected ABAP code. Return the corrected code and a short explanation of each change.',
          allowedTools: [],
          dependsOn: [2],
          expectedOutput: 'Corrected ABAP code plus per-change explanation.',
          qualityTier: 'standard',
          slot: 'fix',
        },
        {
          title: 'Run static validation',
          description: 'Deterministic static checks over the corrected code.',
          capability: 'coding',
          phase: 'validate',
          prompt:
            'Goal: {goal}\n\nCorrected code: {fix}\n\nPerform a static validation pass: syntax risks, null-handling, unreachable branches and missing type declarations.',
          allowedTools: ['calculator'],
          // Valid probe argument: the calculator tool schema requires an
          // `expression` — the pre-flight probe must pass schema validation.
          toolArguments: { calculator: { expression: '1 + 1' } },
          dependsOn: [3],
          expectedOutput: 'Static validation report with PASS/FAIL per check.',
          qualityTier: 'standard',
        },
        {
          title: 'Critic review',
          description: 'Independent critic pass over diagnosis, fix and validation.',
          capability: 'reasoning',
          phase: 'critique',
          prompt:
            'Goal: {goal}\n\nAct as an independent critic. Challenge the diagnosis and the fix. Identify contradictions, unsupported claims and edge cases the fix misses.',
          allowedTools: [],
          dependsOn: [4],
          expectedOutput: 'Critic verdict with contradictions, unsupported claims and edge cases.',
          qualityTier: 'standard',
        },
        {
          title: 'Final answer',
          description: 'Assemble the final diagnosis + explanation + corrected code + validation.',
          capability: 'content_generation',
          phase: 'finalize',
          prompt:
            'Goal: {goal}\n\nAssemble the final ABAP debugging answer. It MUST contain these sections: "Diagnosis", "Explanation", "Corrected Code" and "Validation".',
          allowedTools: [],
          dependsOn: [5],
          expectedOutput:
            'Final answer with Diagnosis, Explanation, Corrected Code and Validation sections.',
          qualityTier: 'standard',
        },
      ];

    case 'ai-app-builder':
      return [
        {
          title: 'Requirements analysis',
          description: 'Derive functional + non-functional requirements for the AI application.',
          capability: 'reasoning',
          phase: 'understand',
          prompt:
            'Goal: {goal}\n\nProduce a requirements analysis for this AI application: users, core workflows, data sources, and AI capabilities needed. Be specific.',
          allowedTools: [],
          expectedOutput:
            'Requirements analysis with users, workflows, data sources and AI capabilities.',
          qualityTier: 'standard',
          slot: 'analysis',
        },
        {
          title: 'Architecture design',
          description: 'Produce the application architecture.',
          capability: 'reasoning',
          phase: 'analyze',
          prompt:
            'Goal: {goal}\n\nRequirements: {analysis}\n\nProduce the application architecture: components, AI integration points, data flow and provider-agnostic seams.',
          allowedTools: [],
          dependsOn: [0],
          expectedOutput: 'Architecture with components, AI integration points and data flow.',
          qualityTier: 'standard',
          slot: 'architecture',
        },
        {
          title: 'AI capability plan',
          description:
            'Map required AI capabilities (retrieval, reasoning, generation, evaluation).',
          capability: 'classification',
          phase: 'produce',
          prompt:
            'Goal: {goal}\n\nArchitecture: {architecture}\n\nMap each AI touchpoint to a capability (retrieval, reasoning, generation, evaluation) and a quality tier, with the evidence each needs.',
          allowedTools: [],
          dependsOn: [1],
          expectedOutput:
            'AI capability plan mapping each touchpoint to capability + quality tier + evidence.',
          qualityTier: 'standard',
          slot: 'plan',
        },
        {
          title: 'Implementation plan',
          description: 'Produce the implementation plan.',
          capability: 'content_generation',
          phase: 'produce',
          prompt:
            'Goal: {goal}\n\nCapability plan: {plan}\n\nProduce the implementation plan: milestones, module order, tests, and launch checklist.',
          allowedTools: [],
          dependsOn: [2],
          expectedOutput:
            'Implementation plan with milestones, module order, tests and launch checklist.',
          qualityTier: 'standard',
        },
        {
          title: 'Independent critique',
          description: 'Independent critic over the plan.',
          capability: 'reasoning',
          phase: 'critique',
          prompt:
            'Goal: {goal}\n\nAct as an independent critic of the AI application plan. Identify gaps, risks, missing tests and unsupported claims.',
          allowedTools: [],
          dependsOn: [3],
          expectedOutput: 'Critique with gaps, risks, missing tests and unsupported claims.',
          qualityTier: 'standard',
        },
        {
          title: 'Validation + final plan',
          description:
            'Validate the refined plan against success criteria and produce the final answer.',
          capability: 'content_generation',
          phase: 'finalize',
          prompt:
            'Goal: {goal}\n\nAssemble the final AI application plan. It MUST contain these sections: "Requirements", "Architecture", "Capabilities" and "Implementation".',
          allowedTools: [],
          dependsOn: [4],
          expectedOutput:
            'Final plan with Requirements, Architecture, Capabilities and Implementation sections.',
          qualityTier: 'standard',
        },
      ];

    case 'app-builder':
      return [
        {
          title: 'Requirements analysis',
          description: 'Derive requirements for the application.',
          capability: 'reasoning',
          phase: 'understand',
          prompt:
            'Goal: {goal}\n\nProduce a requirements analysis: target users, core features, MVP scope and acceptance criteria.',
          allowedTools: [],
          expectedOutput:
            'Requirements analysis with users, features, MVP scope and acceptance criteria.',
          qualityTier: 'standard',
          slot: 'analysis',
        },
        {
          title: 'Architecture design',
          description: 'Produce the application architecture.',
          capability: 'reasoning',
          phase: 'analyze',
          prompt:
            'Goal: {goal}\n\nRequirements: {analysis}\n\nProduce the architecture: stack, components, data model and deployment.',
          allowedTools: [],
          dependsOn: [0],
          expectedOutput: 'Architecture with stack, components, data model and deployment.',
          qualityTier: 'standard',
          slot: 'architecture',
        },
        {
          title: 'UI plan',
          description: 'Produce the UI/UX plan.',
          capability: 'content_generation',
          phase: 'produce',
          prompt:
            'Goal: {goal}\n\nArchitecture: {architecture}\n\nProduce the UI plan: screens, navigation, components and design language.',
          allowedTools: [],
          dependsOn: [1],
          expectedOutput: 'UI plan with screens, navigation, components and design language.',
          qualityTier: 'standard',
          slot: 'ui',
        },
        {
          title: 'Implementation plan',
          description: 'Produce the implementation plan.',
          capability: 'content_generation',
          phase: 'produce',
          prompt:
            'Goal: {goal}\n\nUI plan: {ui}\n\nProduce the implementation plan: milestones, module order, tests and launch checklist.',
          allowedTools: [],
          dependsOn: [2],
          expectedOutput:
            'Implementation plan with milestones, module order, tests and launch checklist.',
          qualityTier: 'standard',
        },
        {
          title: 'Independent critique',
          description: 'Independent critic over the full plan.',
          capability: 'reasoning',
          phase: 'critique',
          prompt:
            'Goal: {goal}\n\nAct as an independent critic of this application plan. Identify scope gaps, risks, missing tests and unsupported claims.',
          allowedTools: [],
          dependsOn: [3],
          expectedOutput: 'Critique with scope gaps, risks, missing tests and unsupported claims.',
          qualityTier: 'standard',
        },
        {
          title: 'Refinement + final plan',
          description: 'Refine and assemble the final plan.',
          capability: 'content_generation',
          phase: 'finalize',
          prompt:
            'Goal: {goal}\n\nAssemble the final application plan. It MUST contain these sections: "Requirements", "Architecture", "UI Plan" and "Implementation Plan".',
          allowedTools: [],
          dependsOn: [4],
          expectedOutput:
            'Final plan with Requirements, Architecture, UI Plan and Implementation Plan sections.',
          qualityTier: 'standard',
        },
      ];

    case 'generic':
    default:
      return [
        {
          title: 'Understand the goal',
          description: 'Restate the goal and identify what must be delivered.',
          capability: 'reasoning',
          phase: 'understand',
          prompt: 'Goal: {goal}\n\nRestate the goal precisely and identify what must be delivered.',
          allowedTools: [],
          expectedOutput: 'A precise restatement of the goal and deliverables.',
          qualityTier: 'standard',
        },
        {
          title: 'Retrieve supporting evidence',
          description: 'Retrieve enterprise knowledge through RAG when available.',
          capability: 'reasoning',
          phase: 'retrieve',
          evidence: true,
          groundingRequired: true,
          prompt:
            'Goal: {goal}\n\nRetrieve the enterprise knowledge relevant to this goal and summarize what it supports.',
          allowedTools: [],
          parallelEligible: true,
          expectedOutput: 'Grounded knowledge relevant to the goal.',
          qualityTier: 'standard',
          slot: 'evidence',
        },
        {
          title: 'Analyze',
          description: 'Analyze the goal against the retrieved evidence.',
          capability: 'reasoning',
          phase: 'analyze',
          prompt:
            'Goal: {goal}\n\nEvidence: {evidence}\n\nAnalyze the goal against the evidence and identify the approach.',
          allowedTools: [],
          dependsOn: [0, 1],
          expectedOutput: 'An analysis of the goal with the chosen approach.',
          qualityTier: 'standard',
          slot: 'analysis',
        },
        {
          title: 'Produce the answer',
          description: 'Produce the deliverable.',
          capability: 'content_generation',
          phase: 'produce',
          prompt: 'Goal: {goal}\n\nAnalysis: {analysis}\n\nProduce the deliverable for this goal.',
          allowedTools: [],
          dependsOn: [2],
          expectedOutput: 'The complete deliverable.',
          qualityTier: 'standard',
          slot: 'produced',
        },
        {
          title: 'Validate',
          description: 'Deterministic validation checks over the deliverable.',
          capability: 'reasoning',
          phase: 'validate',
          prompt:
            'Goal: {goal}\n\nDeliverable: {produced}\n\nValidate the deliverable: completeness, consistency and support.',
          allowedTools: ['calculator'],
          // Valid probe argument (calculator requires `expression`).
          toolArguments: { calculator: { expression: '2 + 2' } },
          dependsOn: [3],
          expectedOutput: 'Validation report.',
          qualityTier: 'standard',
        },
        {
          title: 'Critique',
          description: 'Independent critique of the deliverable.',
          capability: 'reasoning',
          phase: 'critique',
          prompt:
            'Goal: {goal}\n\nAct as an independent critic of the deliverable. Identify contradictions, gaps and unsupported claims.',
          allowedTools: [],
          dependsOn: [4],
          expectedOutput: 'Critique of the deliverable.',
          qualityTier: 'standard',
        },
        {
          title: 'Final answer',
          description: 'Assemble the final answer.',
          capability: 'content_generation',
          phase: 'finalize',
          prompt:
            'Goal: {goal}\n\nAssemble the final answer for this goal, incorporating the critique.',
          allowedTools: [],
          dependsOn: [5],
          expectedOutput: 'The final answer.',
          qualityTier: 'standard',
        },
      ];
  }
}
