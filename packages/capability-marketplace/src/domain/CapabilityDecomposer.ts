// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Decomposer
// EPIC-013 — a factory request becomes a capability plan FIRST.
//
// "Create a 60-second educational video" →
//   Research → Script → Fact check → Storyboard → Visuals → Voice →
//   Music → Assembly → Quality → Final export
//
// The decomposer is deterministic (pattern templates + keyword
// capability detection). It identifies which steps can be automated
// (the AutomationBoundaryEngine answers that). The optional AI
// enrichment seam can refine the step list — never required.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '../types/capability-types.js';
import { CapabilityGraph, type CapabilityDetection } from './CapabilityGraph.js';

export interface DecomposedStep {
  id: string;
  title: string;
  capability: CapabilityId;
  purpose: string;
}

export interface Decomposition {
  steps: DecomposedStep[];
  requiredCapabilities: CapabilityId[];
  /** Why the outcome maps to these capabilities (provenance). */
  reasons: Array<{ capability: CapabilityId; matchedKeywords: string[] }>;
}

/** A declarative step template with the capabilities it needs. */
export interface StepTemplate {
  id: string;
  title: string;
  capability: CapabilityId;
  purpose: string;
  /** Keywords that make this step relevant (matched against the outcome). */
  keywords: string[];
}

// ── Template library ──────────────────────────────────────────────
// Ordered, so plans read top-to-bottom like a factory pipeline.

const VIDEO_TEMPLATES: StepTemplate[] = [
  {
    id: 'research',
    title: 'Research',
    capability: 'RESEARCH',
    purpose: 'Gather accurate source material for the content.',
    keywords: ['research', 'find', 'source'],
  },
  {
    id: 'script',
    title: 'Script',
    capability: 'TEXT_GENERATION',
    purpose: 'Draft the narration and on-screen copy.',
    keywords: ['video', 'script', 'write'],
  },
  {
    id: 'fact-check',
    title: 'Fact Check',
    capability: 'QUALITY_EVALUATION',
    purpose: 'Verify the script against evidence before production.',
    keywords: ['fact', 'check', 'verify', 'educational'],
  },
  {
    id: 'storyboard',
    title: 'Storyboard',
    capability: 'REASONING',
    purpose: 'Plan each scene and visual transition.',
    keywords: ['storyboard', 'plan', 'scene'],
  },
  {
    id: 'visuals',
    title: 'Visuals',
    capability: 'IMAGE_GENERATION',
    purpose: 'Generate the visuals for each scene.',
    keywords: ['visual', 'image', 'animation'],
  },
  {
    id: 'voice',
    title: 'Voice',
    capability: 'TEXT_TO_SPEECH',
    purpose: 'Generate the narration audio.',
    keywords: ['voice', 'narration', 'speech'],
  },
  {
    id: 'music',
    title: 'Music',
    capability: 'MUSIC',
    purpose: 'Add background music or audio.',
    keywords: ['music', 'soundtrack', 'audio'],
  },
  {
    id: 'assembly',
    title: 'Assembly',
    capability: 'ASSEMBLY',
    purpose: 'Combine visuals, narration and music into the final video.',
    keywords: ['video', 'assemble', 'edit'],
  },
  {
    id: 'quality',
    title: 'Quality Check',
    capability: 'QUALITY_EVALUATION',
    purpose: 'Evaluate the finished video against the brief.',
    keywords: ['quality', 'check', 'review'],
  },
  {
    id: 'export',
    title: 'Final Export',
    capability: 'DEPLOYMENT',
    purpose: 'Render and publish the final video.',
    keywords: ['export', 'publish', 'render'],
  },
];

const GENERAL_TEMPLATES: StepTemplate[] = [
  {
    id: 'research',
    title: 'Research',
    capability: 'RESEARCH',
    purpose: 'Gather source material.',
    keywords: ['research', 'find'],
  },
  {
    id: 'create',
    title: 'Create',
    capability: 'TEXT_GENERATION',
    purpose: 'Produce the core content.',
    keywords: ['write', 'create', 'generate'],
  },
  {
    id: 'visuals',
    title: 'Visuals',
    capability: 'IMAGE_GENERATION',
    purpose: 'Produce visuals.',
    keywords: ['image', 'visual', 'photo'],
  },
  {
    id: 'quality',
    title: 'Quality Check',
    capability: 'QUALITY_EVALUATION',
    purpose: 'Verify the output.',
    keywords: ['quality', 'check'],
  },
  {
    id: 'finalize',
    title: 'Finalize',
    capability: 'ASSEMBLY',
    purpose: 'Package the result.',
    keywords: ['final', 'assemble', 'package'],
  },
];

const CODING_TEMPLATES: StepTemplate[] = [
  {
    id: 'understand',
    title: 'Understand Requirements',
    capability: 'REASONING',
    purpose: 'Turn the idea into concrete requirements.',
    keywords: ['app', 'build', 'develop'],
  },
  {
    id: 'architecture',
    title: 'Architecture',
    capability: 'REASONING',
    purpose: 'Choose the stack and structure.',
    keywords: ['architecture', 'design', 'plan'],
  },
  {
    id: 'implement',
    title: 'Implement',
    capability: 'CODING',
    purpose: 'Write the code.',
    keywords: ['code', 'build', 'implement'],
  },
  {
    id: 'test',
    title: 'Test & Validate',
    capability: 'QUALITY_EVALUATION',
    purpose: 'Validate the implementation.',
    keywords: ['test', 'validate', 'check'],
  },
  {
    id: 'deploy',
    title: 'Deploy',
    capability: 'DEPLOYMENT',
    purpose: 'Ship the result.',
    keywords: ['deploy', 'publish', 'launch'],
  },
];

export class CapabilityDecomposer {
  private readonly graph: CapabilityGraph;

  constructor(graph: CapabilityGraph = new CapabilityGraph()) {
    this.graph = graph;
  }

  decompose(outcome: string): Decomposition {
    const normalized = outcome.toLowerCase();
    const detections: CapabilityDetection[] = this.graph.detect(outcome);

    // Choose the template family by strongest signal.
    const templates = this.selectTemplates(normalized, detections);

    const steps: DecomposedStep[] = templates.map((template) => ({
      id: template.id,
      title: template.title,
      capability: template.capability,
      purpose: template.purpose,
    }));

    // Every detected capability not covered by a step is still recorded
    // as required so the plan never silently drops a needed capability.
    const stepCapabilities = new Set(steps.map((s) => s.capability));
    const requiredCapabilities = [
      ...new Set([...steps.map((s) => s.capability), ...detections.map((d) => d.capability)]),
    ];

    return {
      steps,
      requiredCapabilities,
      reasons: detections
        .filter((d) => !stepCapabilities.has(d.capability) || detections.length < 15)
        .slice(0, 15),
    };
  }

  private selectTemplates(normalized: string, detections: CapabilityDetection[]): StepTemplate[] {
    const isVideo =
      detections.some((d) => d.capability === 'VIDEO_GENERATION') ||
      detections.some((d) => d.capability === 'VIDEO_EDITING') ||
      /video|reel|animation|clip/.test(normalized);
    if (isVideo) return VIDEO_TEMPLATES;

    const isCoding =
      detections.some((d) => d.capability === 'CODING') ||
      /(build|develop|code|app)\b/.test(normalized);
    if (isCoding) return CODING_TEMPLATES;

    return GENERAL_TEMPLATES;
  }
}
