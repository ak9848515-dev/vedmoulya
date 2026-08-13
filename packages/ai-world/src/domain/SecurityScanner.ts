// ──────────────────────────────────────────────────────────────────
// VedMoulya — SecurityScanner
// EPIC-012C — discovered content is UNTRUSTED input
//
// Protects against prompt injection, malicious links, fake model
// claims, deceptive pricing, poisoned metadata and unsafe install
// instructions. Discovery NEVER executes arbitrary discovered code —
// this scanner only flags risk so the UI can surface it. Flags are
// heuristic (pattern-based) and labelled, never authoritative.
// ──────────────────────────────────────────────────────────────────

import type { RawDiscoveryItem } from '../types/discovery-types.js';

export type SecurityFlag =
  | 'prompt_injection'
  | 'malicious_link'
  | 'fake_claim'
  | 'deceptive_pricing'
  | 'unsafe_instructions'
  | 'suspicious_metadata';

export interface SecurityScanResult {
  flags: SecurityFlag[];
  /** Why each flag was raised (user-friendly + specific). */
  reasons: string[];
}

/** Patterns that indicate an attempt to override instructions. */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore (all )?(previous|prior) (instructions|prompts|rules)\b/i,
  /\bdisregard (all )?(your|the) (instructions|guidelines|system prompt)\b/i,
  /\byou are now (openai|gpt|claude|gemini|a different model)\b/i,
  /\breveal (your )?(system prompt|instructions|api keys?)\b/i,
  /\bprint (your )?(system prompt|hidden instructions)\b/i,
];

/** URL schemes that must never be followed/opened. */
const UNSAFE_URL_SCHEMES: RegExp[] = [/^javascript:/i, /^data:/i, /^vbscript:/i, /^file:/i];

/** Unsafe instruction patterns (arbitrary code execution). */
const UNSAFE_INSTRUCTIONS: RegExp[] = [
  /\bcurl [^|]*\|\s*(ba)?sh\b/i,
  /\bpip install .*--user\b/i,
  /\bwget [^|]*\|\s*(ba)?sh\b/i,
  /\bchmod \+x .* && \.\//,
];

/** Claims that assert capabilities/pricing without evidence. */
const FAKE_CLAIM_PATTERNS: RegExp[] = [
  /\b(best|fastest|most powerful|state.of.the.art)\b.*\b(model|llm|ai)\b/i,
  /\b100%\s*(free|accurate|reliable)\b/i,
  /\bunlimited\s*(free|tokens|usage)\b/i,
];

export class SecurityScanner {
  scan(item: RawDiscoveryItem): SecurityScanResult {
    const flags = new Set<SecurityFlag>();
    const reasons: string[] = [];

    const text = `${item.title}\n${item.summary}`;

    // ── Prompt injection ───────────────────────────────────────────────
    const injection = INJECTION_PATTERNS.find((pattern) => pattern.test(text));
    if (injection) {
      flags.add('prompt_injection');
      reasons.push(
        'Content contains prompt-injection phrasing (instruction-override attempts) — treated as untrusted and never rendered as instructions.',
      );
    }

    // ── Malicious links ────────────────────────────────────────────────
    const unsafeUrl =
      item.sourceUrl && UNSAFE_URL_SCHEMES.some((scheme) => scheme.test(item.sourceUrl ?? ''));
    if (unsafeUrl) {
      flags.add('malicious_link');
      reasons.push('Source URL uses an unsafe scheme (javascript/data/file) — never auto-opened.');
    }

    // ── Fake / unsupported claims ──────────────────────────────────────
    const fakeClaim = FAKE_CLAIM_PATTERNS.some((pattern) => pattern.test(text));
    if (fakeClaim) {
      flags.add('fake_claim');
      reasons.push(
        'Marketing-style superlatives or absolute claims (100% free, unlimited) without evidence — treated as claims, not facts.',
      );
    }

    // ── Deceptive pricing ──────────────────────────────────────────────
    if (/\$0(\.00)?|free/i.test(item.summary) && item.claimedFreeClass === 'PAID') {
      flags.add('deceptive_pricing');
      reasons.push('Free is claimed in the text but the source classifies the resource as paid.');
    }

    // ── Unsafe install instructions ────────────────────────────────────
    const unsafeInstructions = UNSAFE_INSTRUCTIONS.some((pattern) => pattern.test(text));
    if (unsafeInstructions) {
      flags.add('unsafe_instructions');
      reasons.push(
        'Content contains arbitrary-code-execution instruction patterns — never executed by VedMoulya.',
      );
    }

    // ── Suspicious metadata (evidence absent for strong claims) ───────
    // A source-declared provider family ("Configure Provider" hook) is a
    // strong claim too — without evidence it is a poisoning vector that
    // could inflate relevance and reach CONFIGURE. Flag it the same way.
    const strongClaimWithoutEvidence =
      (item.modelFacts && item.modelFacts.capabilities.length > 0) ||
      item.claimedFreeClass === 'FREE_API' ||
      Boolean(item.modelFacts?.suggestedFamily);
    const hasEvidence = (item.evidence?.length ?? 0) > 0;
    if (strongClaimWithoutEvidence && !hasEvidence) {
      flags.add('suspicious_metadata');
      reasons.push(
        'Strong capability/free/provider-family claims carry no evidence — treated as UNKNOWN until verified.',
      );
    }

    return { flags: [...flags], reasons };
  }
}
