// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Graph
// EPIC-013 — the normalized AI capability taxonomy with keyword
// detection. Maps a free-text outcome to the capabilities it
// requires. Deterministic + evidence-annotated; the optional AI
// seam (CapabilityEnrichmentPort) may refine, never replace.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '../types/capability-types.js';

/** Keyword signals per capability (case-insensitive substring match). */
const CAPABILITY_KEYWORDS: Record<CapabilityId, string[]> = {
  TEXT_GENERATION: [
    'write',
    'text',
    'content',
    'article',
    'blog',
    'copy',
    'script',
    'caption',
    'story',
  ],
  REASONING: ['reason', 'analy', 'explain', 'diagnos', 'solve', 'think', 'evaluat', 'plan'],
  CODING: [
    'code',
    'program',
    'develop',
    'app',
    'software',
    'build',
    'implement',
    'fix',
    'debug',
    'scripting',
  ],
  RESEARCH: ['research', 'find', 'source', 'study', 'investigate', 'summarize source'],
  RAG: ['knowledge', 'document', 'retriev', 'ground', 'answer from', 'knowledge base', 'rag'],
  VISION: ['image understand', 'see', 'visual understand', 'recogni', 'ocr', 'inspect image'],
  IMAGE_GENERATION: [
    'image',
    'picture',
    'photo',
    'visual',
    'illustration',
    'art',
    'logo',
    'thumbnail',
  ],
  VIDEO_GENERATION: ['video', 'clip', 'reel', 'animation', 'animated'],
  VIDEO_EDITING: ['edit video', 'cut video', 'trim', 'montage', 'video edit'],
  AUDIO_GENERATION: ['audio', 'sound', 'podcast', 'voiceover', 'narration', 'audio generate'],
  TEXT_TO_SPEECH: ['speak', 'speech', 'voice', 'tts', 'narration', 'voiceover', 'read aloud'],
  SPEECH_TO_TEXT: [
    'transcribe',
    'transcription',
    'speech to text',
    'captions from audio',
    'subtitles',
  ],
  MUSIC: ['music', 'soundtrack', 'score', 'background music', 'song'],
  AVATAR: ['avatar', 'presenter', 'virtual human', 'digital human'],
  TRANSLATION: ['translat', 'localiz', 'language'],
  DOCUMENT_PROCESSING: ['document', 'pdf', 'extract from', 'parse', 'form', 'invoice'],
  EMBEDDINGS: ['embedding', 'vector', 'search', 'similarity'],
  WEB_RESEARCH: ['web', 'search the web', 'browse', 'online', 'url', 'website'],
  BROWSER_AUTOMATION: ['browser', 'automate web', 'click', 'fill form', 'scrape', 'web automation'],
  CODE_EXECUTION: ['run code', 'execute', 'compute', 'data processing', 'transform', 'pipeline'],
  DEPLOYMENT: ['deploy', 'publish', 'ship', 'launch', 'host', 'release'],
  QUALITY_EVALUATION: [
    'quality',
    'check',
    'review',
    'verify',
    'fact-check',
    'fact check',
    'evaluate',
    'test',
  ],
  ASSEMBLY: ['assemble', 'combine', 'merge', 'edit together', 'finalize', 'compile', 'package'],
};

/**
 * Deterministic capability detection from a requested outcome.
 * Every detected capability lists its matching keywords so the UI can
 * explain WHY it was included (provenance, never magic).
 */
export interface CapabilityDetection {
  capability: CapabilityId;
  matchedKeywords: string[];
}

export class CapabilityGraph {
  detect(outcome: string): CapabilityDetection[] {
    const normalized = outcome.toLowerCase();
    const detected: CapabilityDetection[] = [];
    for (const [capability, keywords] of Object.entries(CAPABILITY_KEYWORDS) as Array<
      [CapabilityId, string[]]
    >) {
      const matched = keywords.filter((keyword) => normalized.includes(keyword));
      if (matched.length > 0) {
        detected.push({ capability, matchedKeywords: matched });
      }
    }
    return detected;
  }

  hasCapability(outcome: string, capability: CapabilityId): boolean {
    return this.detect(outcome).some((d) => d.capability === capability);
  }
}
