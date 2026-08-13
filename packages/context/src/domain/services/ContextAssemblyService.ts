// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Domain Service: Context Assembly
// Builds the Enterprise Context Package from ranked, filtered, and
// compressed context items. The package is the complete input for
// an AI call — goal, capability, memory, knowledge, business, client,
// documents, prompt, and metadata.
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  CompressionStep,
  ContextItem,
  ContextSource,
  ContextCategory,
  EnterpriseContextPackage,
} from '../../types/context-types.js';

// ── Assembly options ────────────────────────────────────────────────────────

export interface AssemblyOptions {
  packageId: string;
  goal: string;
  capability: CapabilityType;
  version?: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

export class ContextAssemblyService {
  /**
   * Build the Enterprise Context Package from processed context items.
   * Items are categorized by source into the appropriate slots.
   */
  assemble(
    items: ContextItem[],
    prompt: string,
    options: AssemblyOptions,
    compressionSteps: CompressionStep[],
  ): EnterpriseContextPackage {
    const categorized = this.categorizeItems(items);

    const totalItems = items.length;
    const estimatedTokens =
      items.reduce((s, i) => s + i.estimatedTokens, 0) + this.estimateTokens(prompt);
    const confidence =
      items.length > 0 ? items.reduce((s, i) => s + i.confidence, 0) / items.length : 0.5;

    const sources = [...new Set(items.map((i) => i.source))] as ContextSource[];
    const categories = [...new Set(items.map((i) => i.category))] as ContextCategory[];

    return {
      packageId: options.packageId,
      goal: options.goal,
      capability: options.capability,
      memory: categorized.memory,
      knowledge: categorized.knowledge,
      business: categorized.business,
      client: categorized.client,
      documents: categorized.documents,
      prompt,
      metadata: {
        totalItems,
        estimatedTokens,
        confidence,
        sources,
        categories,
        compressionSteps,
        assembledAt: new Date().toISOString(),
        version: options.version ?? '1.0.0',
      },
    };
  }

  /**
   * Build a prompt from the assembled context package.
   * This creates a structured prompt string that includes all context
   * sections, each clearly labeled for the AI.
   */
  buildPrompt(pkg: EnterpriseContextPackage): string {
    const sections: string[] = [];

    sections.push(`# Goal\n${pkg.goal}`);
    sections.push(`# Capability\n${pkg.capability}`);

    if (pkg.memory.length > 0) {
      sections.push(`# Memory Context\n${pkg.memory.map((m) => m.content).join('\n\n')}`);
    }

    if (pkg.knowledge.length > 0) {
      sections.push(`# Knowledge Context\n${pkg.knowledge.map((k) => k.content).join('\n\n')}`);
    }

    if (pkg.business.length > 0) {
      sections.push(`# Business Context\n${pkg.business.map((b) => b.content).join('\n\n')}`);
    }

    if (pkg.client.length > 0) {
      sections.push(`# Client Context\n${pkg.client.map((c) => c.content).join('\n\n')}`);
    }

    if (pkg.documents.length > 0) {
      sections.push(`# Documents\n${pkg.documents.map((d) => d.content).join('\n\n')}`);
    }

    sections.push(`# Prompt\n${pkg.prompt}`);

    return sections.join('\n\n---\n\n');
  }

  /**
   * Estimate the total tokens in the assembled package.
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Categorize items by their source into the package slots.
   * Items that don't match a known slot are added to the most appropriate one.
   */
  private categorizeItems(items: ContextItem[]): {
    memory: ContextItem[];
    knowledge: ContextItem[];
    business: ContextItem[];
    client: ContextItem[];
    documents: ContextItem[];
  } {
    const memory: ContextItem[] = [];
    const knowledge: ContextItem[] = [];
    const business: ContextItem[] = [];
    const client: ContextItem[] = [];
    const documents: ContextItem[] = [];

    for (const item of items) {
      switch (item.category) {
        case 'conversation':
        case 'memory':
        case 'user_profile':
          memory.push(item);
          break;
        case 'knowledge':
        case 'strategy':
        case 'system':
          knowledge.push(item);
          break;
        case 'business':
        case 'market':
        case 'brand':
          business.push(item);
          break;
        case 'client':
        case 'project':
          client.push(item);
          break;
        case 'document':
          documents.push(item);
          break;
        case 'capability':
        case 'prompt':
        default:
          // Capability and prompt metadata go into knowledge
          knowledge.push(item);
          break;
      }
    }

    return { memory, knowledge, business, client, documents };
  }
}
