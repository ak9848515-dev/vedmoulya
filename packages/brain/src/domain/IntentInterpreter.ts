// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · IntentInterpreter
// EPIC-016 §5 — Intent understanding.
//
// Distinguishes: WHAT USER SAID → WHAT USER MEANS → WHAT USER WANTS
// PRODUCED → WHAT CONSTRAINTS EXIST → WHAT QUALITY IS REQUIRED →
// WHAT ACTION IS ACTUALLY AUTHORIZED.
//
// Deterministic + evidence-first: material ambiguity is surfaced for a
// concise clarification; non-material ambiguity becomes a bounded,
// recorded assumption. UNKNOWN stays UNKNOWN. Nothing is fabricated.
// ──────────────────────────────────────────────────────────────────

import type {
  IntentProfile,
  QualityTarget,
  PrivacyRequirement,
  Urgency,
  BoundedAssumption,
} from '../types/brain-types.js';

interface IntentDictionaries {
  domains: Record<string, string[]>;
  qualityHigh: string[];
  qualityLow: string[];
  privacy: string[];
  urgencyHigh: string[];
  urgencyLow: string[];
  constraints: string[];
  authorizes: string[];
  sensitiveActions: string[];
}

const DICT: IntentDictionaries = {
  domains: {
    content: ['video', 'youtube', 'script', 'voice', 'thumbnail', 'caption', 'audio', 'music'],
    software: [
      'code',
      'app',
      'application',
      'build',
      'implement',
      'software',
      'program',
      'debug',
      'api',
    ],
    career: ['resume', 'cv', 'career', 'job', 'interview', 'salary', 'freelance', 'portfolio'],
    business: [
      'marketing',
      'campaign',
      'business',
      'content',
      'sales',
      'advertise',
      'brand',
      'client',
    ],
    learning: [
      'learn',
      'study',
      'course',
      'tutorial',
      'explain',
      'teach',
      'education',
      'understand',
    ],
    research: ['research', 'investigate', 'analy', 'report', 'compare', 'summarize'],
    writing: ['write', 'draft', 'edit', 'document', 'email', 'article', 'blog', 'essay'],
  },
  qualityHigh: [
    'professional',
    'accurate',
    'high-quality',
    'precise',
    'excellent',
    'best',
    'polished',
    'publish',
  ],
  qualityLow: ['quick', 'fast', 'draft', 'rough', 'simple', 'casual'],
  privacy: ['private', 'confidential', 'sensitive', 'local', 'offline', 'personal data', 'secret'],
  urgencyHigh: ['urgent', 'asap', 'today', 'now', 'deadline', 'immediately'],
  urgencyLow: ['whenever', 'someday', 'not urgent', 'low priority'],
  constraints: [
    'free',
    'budget',
    'cheap',
    'no cost',
    'local',
    'no subscription',
    'open-source',
    'within budget',
  ],
  authorizes: ['publish', 'send', 'email', 'share', 'deploy', 'post'],
  sensitiveActions: [
    'publish',
    'send',
    'deploy',
    'delete',
    'purchase',
    'subscribe',
    'share',
    'install',
  ],
};

function contains(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((w) => lower.includes(w.toLowerCase()));
}

export class IntentInterpreter {
  interpret(originalInput: string): IntentProfile {
    const lower = originalInput.toLowerCase();

    // ── What the user wants produced ───────────────────────────────
    const action = this.detectAction(originalInput);
    const object = this.detectObject(originalInput, action);

    // ── Domain / constraints / quality / privacy / urgency ─────────
    const domain = this.detectDomain(lower);
    const constraints = contains(lower, DICT.constraints);
    const qualityTarget = this.detectQuality(lower);
    const privacyRequirement = this.detectPrivacy(lower);
    const urgency = this.detectUrgency(lower);
    const authorizedActions = contains(lower, DICT.authorizes);
    const sensitiveMentioned = contains(lower, DICT.sensitiveActions);

    const ambiguities: string[] = [];
    const assumptions: BoundedAssumption[] = [];

    if (!action) {
      ambiguities.push('No actionable verb detected — the objective could not be pinned down.');
    }
    if (!object && !action) {
      ambiguities.push('No output object detected — what should be produced is unclear.');
    }

    // Bounded assumptions (recorded, never fabricated as facts).
    if (privacyRequirement === 'STANDARD') {
      assumptions.push({
        assumption: 'Privacy requirement defaults to STANDARD.',
        reason: 'The input did not state a privacy requirement.',
      });
    }
    if (qualityTarget === 'MEDIUM' && !ambiguities.length) {
      assumptions.push({
        assumption: 'Quality target defaults to MEDIUM.',
        reason: 'The input did not specify quality; MEDIUM is the safe default.',
      });
    }
    if (sensitiveMentioned.length > 0) {
      assumptions.push({
        assumption: 'Sensitive actions mentioned are NOT authorized without approval.',
        reason:
          'Mentioning publish/send/deploy does not grant permission; the Brain still requires explicit approval before acting.',
      });
    }

    const objective = [action, object].filter(Boolean).join(' ');

    return {
      objective: objective || originalInput.trim(),
      domain,
      desiredOutcome: originalInput.trim(),
      constraints,
      qualityTarget,
      privacyRequirement,
      urgency,
      authorizedActions,
      ambiguities,
      assumptions,
    };
  }

  /** True when a material ambiguity would change execution → ask the user. */
  needsClarification(profile: IntentProfile): boolean {
    return profile.ambiguities.length > 0;
  }

  private detectAction(input: string): string | undefined {
    const lower = input.toLowerCase();
    const verbs: Array<[RegExp, string]> = [
      [/\b(create|make|build|produce|generate)\b/, 'Create'],
      [/\b(write|draft|compose)\b/, 'Write'],
      [/\b(research|investigate)\b/, 'Research'],
      [/\b(analy|compare|evaluate)\b/, 'Analyze'],
      [/\b(translate)\b/, 'Translate'],
      [/\b(summarize|explain)\b/, 'Summarize'],
      [/\b(plan|prepare|organize)\b/, 'Plan'],
      [/\b(learn|study)\b/, 'Learn'],
      [/\b(edit|improve|refine)\b/, 'Edit'],
    ];
    for (const [re, label] of verbs) {
      if (re.test(lower)) return label;
    }
    return undefined;
  }

  private detectObject(input: string, action?: string): string | undefined {
    const lower = input.toLowerCase();
    const objects: Array<[RegExp, string]> = [
      [/\b(video|youtube video)\b/, 'a video'],
      [/\b(script)\b/, 'a script'],
      [/\b(article|blog post|blog)\b/, 'an article'],
      [/\b(report|research report)\b/, 'a report'],
      [/\b(resume|cv)\b/, 'a resume'],
      [/\b(email|email draft)\b/, 'an email'],
      [/\b(essay|document|paper)\b/, 'a document'],
      [/\b(code|application|app|program|function)\b/, 'code'],
      [/\b(marketing campaign|campaign)\b/, 'a marketing campaign'],
      [/\b(course|lesson|study plan)\b/, 'a learning plan'],
    ];
    for (const [re, label] of objects) {
      if (re.test(lower)) return label;
    }
    // Fall back to the noun after the verb when present.
    if (action) {
      const trimmed = lower.replace(/^(please\s+|can you\s+|i want to\s+|help me\s+)?/, '').trim();
      if (trimmed.length > 3) return trimmed.slice(0, 60);
    }
    return undefined;
  }

  private detectDomain(lower: string): string {
    let best = 'UNKNOWN';
    let bestHits = 0;
    for (const [domain, keywords] of Object.entries(DICT.domains)) {
      const hits = keywords.filter((k) => lower.includes(k)).length;
      if (hits > bestHits) {
        bestHits = hits;
        best = domain;
      }
    }
    return best;
  }

  private detectQuality(lower: string): QualityTarget {
    const high = contains(lower, DICT.qualityHigh);
    const low = contains(lower, DICT.qualityLow);
    if (high.length > 0) return 'HIGH';
    if (low.length > 0) return 'LOW';
    return 'MEDIUM';
  }

  private detectPrivacy(lower: string): PrivacyRequirement {
    return contains(lower, DICT.privacy).length > 0 ? 'PRIVATE' : 'STANDARD';
  }

  private detectUrgency(lower: string): Urgency {
    if (contains(lower, DICT.urgencyHigh).length > 0) return 'HIGH';
    if (contains(lower, DICT.urgencyLow).length > 0) return 'LOW';
    return 'NORMAL';
  }
}
