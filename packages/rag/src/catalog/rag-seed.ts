// ──────────────────────────────────────────────────────────────────
// VedMoulya — RAG Seed Catalog
// Realistic enterprise knowledge documents for the /rag explorer and
// the demo collections, referencing the Content Agency (EPIC-003)
// business vocabulary so vector retrieval has meaningful content.
// AI-RUNTIME-002.
// ──────────────────────────────────────────────────────────────────

import type { RagDocument } from '../types/rag-types.js';

export interface RagSeedEntry {
  collection: string;
  document: RagDocument;
}

export const RAG_SEED_DOCUMENTS: RagSeedEntry[] = [
  {
    collection: 'org:vedmoulya',
    document: {
      sourceId: 'kb-content-agency-onboarding',
      title: 'Content Agency — Client Onboarding Playbook',
      content: [
        'The Content Agency onboards every new client through a five-stage workflow: lead capture, brand definition, project scoping, calendar planning, and AI content generation.',
        'During brand definition the agency records the client voice, tone, target audience, and visual identity. These attributes are carried into every content brief so generated drafts match the brand.',
        'Projects are planned on a publishing calendar. Each calendar slot references the client, the brand voice, and the required content format such as blog post, social media post, or email newsletter.',
        'AI generation assembles context from the client profile, brand guidelines, project brief, and prior approved content. Drafts are reviewed by the account manager before approval.',
        'Approved content is delivered to the client and tracked in the invoicing pipeline. Payment terms are defined per client and invoices are raised automatically on delivery.',
      ].join('\n\n'),
      metadata: { category: 'playbook', owner: 'content-agency', tags: ['onboarding', 'workflow'] },
    },
  },
  {
    collection: 'org:vedmoulya',
    document: {
      sourceId: 'kb-brand-guidelines',
      title: 'Brand Guidelines — Voice & Tone',
      content: [
        'Every client brand defines a voice: professional, friendly, technical, or conversational. The voice determines word choice, sentence length, and the level of formality in generated content.',
        'Tone adapts to the content format. Newsletters may be warm and personal while case studies remain factual and measured. Tone must never contradict the brand voice.',
        'Visual identity includes the primary palette, typography, and logo usage rules. Generated text references the identity but never invents logos or artwork.',
        'The brand guidelines document is considered stable context: it rarely changes and can be reused across many generation runs without re-retrieval.',
      ].join('\n\n'),
      metadata: { category: 'brand', owner: 'content-agency', tags: ['brand', 'voice', 'tone'] },
    },
  },
  {
    collection: 'org:vedmoulya',
    document: {
      sourceId: 'kb-ai-generation-policy',
      title: 'AI Content Generation Policy',
      content: [
        'All AI-generated content is reviewed by a human account manager before client delivery. Automated publishing to client channels requires an explicit approval record.',
        'Generated drafts must cite their source context when it influences factual claims. Claims about the client or their market must trace to the client brief or approved knowledge.',
        'The generation pipeline enforces an input-token budget. When the assembled context exceeds the budget the pipeline ranks, filters, deduplicates, and compresses the context before retrying.',
        'Provider selection is deterministic: the runtime scores eligible providers on capability, health, cost, and benchmark quality and documents the selection reason.',
      ].join('\n\n'),
      metadata: { category: 'policy', owner: 'content-agency', tags: ['policy', 'ai', 'approval'] },
    },
  },
];
